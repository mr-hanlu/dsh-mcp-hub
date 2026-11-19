/**
 * 端到端验收（OAuth）：本地假授权服务器 + 假 MCP，走真实 DSH rc.5 的
 * authorization / credentials 服务与 mcp-manager，覆盖保存、授权、回调、
 * 自动重连、重启后免重授权、临近过期刷新、删除清理。
 *
 * 不访问真实 OAuth 服务：这里验证协议与宿主接线，Notion 等真实服务留人工验收。
 * 用法：npm run test:oauth（需要本机有 dsh；没有时 SKIP）。
 */
import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { bootProfile, createApi, createProfile, findDsh, skip, sleep } from './support/profile.mjs';

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const port = 3221;
const report = [];
const step = (name, value) => report.push({ name, ...value });

function startFixture() {
  const child = spawn(process.execPath, ['tests/manual/oauth-fixture.mjs'], {
    cwd: repoRoot,
    env: { ...process.env, TOKEN_TTL_MS: '60000' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('授权 fixture 启动超时：' + output.slice(-400))), 10000);
    const scan = chunk => {
      output += chunk;
      const match = output.match(/BASE=(\S+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    };
    child.stdout.on('data', scan);
    child.stderr.on('data', scan);
    child.on('exit', code => reject(new Error('授权 fixture 提前退出（' + code + '）：' + output.slice(-400))));
  });
  return { ready, stop: () => { try { child.kill(); } catch {} } };
}

async function waitFor(fn, { tries = 80, interval = 250, label = '状态' } = {}) {
  let last;
  for (let i = 0; i < tries; i += 1) {
    last = await fn();
    if (last) return last;
    await sleep(interval);
  }
  throw new Error('等待' + label + '超时');
}

async function main() {
  const bin = findDsh();
  if (!bin) { skip('没有找到 dsh'); return; }
  const fixture = startFixture();
  let profile;
  let session;
  try {
    const base = await fixture.ready;
    const state = async () => (await fetch(base + '/state')).json();
    profile = await createProfile({ bin, repoRoot, name: 'oauth-e2e' });
    session = await bootProfile({ bin, profile: profile.name, env: profile.env, extraArgs: ['--no-open', '--port', String(port)] });
    let call = createApi(session);

    let list = await call('/servers');
    const saved = await call('/mutate', {
      action: 'save', name: 'oauthsvc', revision: list.body.revision,
      entry: { transport: 'streamable-http', url: base + '/mcp' }, auth: 'oauth',
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.ok, true);
    assert.equal(saved.body.oauth.state, 'needs-auth');
    assert.equal(saved.body.entry.headers.Authorization, 'Bearer ${credential:MCPHUB_OAUTHSVC_ACCESS_TOKEN}');
    assert.ok(saved.body.checks.some(check => check.label === '变量引用' && check.ok));
    step('oauth-save', { oauth: saved.body.oauth.state, checks: saved.body.checks.length });

    list = await call('/servers');
    let row = list.body.servers.find(item => item.name === 'oauthsvc');
    assert.equal(row.oauth.state, 'needs-auth');
    assert.equal(row.verification.state, 'failed');
    assert.match(row.verification.detail, /登录授权/);
    step('oauth-pending', { oauth: row.oauth.state, verification: row.verification.state });

    const started = await call('/oauth-start', { name: 'oauthsvc' });
    assert.equal(started.status, 200);
    assert.equal(started.body.state, 'authorizing');
    assert.match(started.body.url, /response_type=code/);
    assert.match(started.body.url, /code_challenge_method=S256/);
    const authorize = await fetch(started.body.url, { redirect: 'manual' });
    assert.equal(authorize.status, 302);
    const callback = await fetch(authorize.headers.get('location'));
    assert.equal(callback.status, 200);
    step('oauth-authorize', { status: authorize.status, callback: callback.status });

    const authorized = await waitFor(async () => {
      const status = await call('/oauth-status', { name: 'oauthsvc' });
      if (status.body.state === 'failed') throw new Error('OAuth 失败：' + status.body.error);
      return status.body.state === 'authorized' ? status.body : null;
    }, { label: 'OAuth 授权完成' });
    assert.equal(authorized.ref, 'MCPHUB_OAUTHSVC_ACCESS_TOKEN');
    step('oauth-authorized', { ref: authorized.ref, scope: authorized.scope });

    row = await waitFor(async () => {
      const current = await call('/servers');
      const found = current.body.servers.find(item => item.name === 'oauthsvc');
      return found?.status.state === 'connected' ? found : null;
    }, { tries: 120, label: 'OAuth 服务连接' });
    assert.equal(row.toolCount, 1);
    const tools = await call('/tools', { name: 'oauthsvc' });
    assert.equal(tools.body.tools[0].name, 'whoami');
    step('oauth-connected', { toolCount: row.toolCount });

    await session.stop();
    session = await bootProfile({ bin, profile: profile.name, env: profile.env, extraArgs: ['--no-open', '--port', String(port)] });
    call = createApi(session);
    row = await waitFor(async () => {
      const current = await call('/servers');
      const found = current.body.servers.find(item => item.name === 'oauthsvc');
      return found?.status.state === 'connected' ? found : null;
    }, { tries: 120, label: '重启后自动连接' });
    const persisted = await call('/oauth-status', { name: 'oauthsvc' });
    assert.equal(persisted.body.state, 'authorized');
    const after = await state();
    assert.ok(after.refreshRequests >= 1, '临近过期时应刷新一次');
    step('oauth-restart', { refreshRequests: after.refreshRequests, connected: row.status.state });

    const removed = await call('/mutate', { action: 'remove', name: 'oauthsvc', revision: (await call('/servers')).body.revision });
    assert.equal(removed.body.ok, true);
    assert.ok(removed.body.cleanup.includes('MCPHUB_OAUTHSVC_ACCESS_TOKEN'));
    const cleared = await call('/oauth-status', { name: 'oauthsvc' });
    assert.equal(cleared.body.state, 'none');
    step('oauth-remove', { cleanup: removed.body.cleanup, status: cleared.body.state });

    const missing = await call('/oauth-start', { name: 'ghost' });
    assert.equal(missing.status, 404);
    step('oauth-missing', { code: missing.body.code });

    console.log(JSON.stringify({ ok: true, steps: report }, null, 2));
  } finally {
    if (session) await session.stop();
    if (profile) await profile.cleanup();
    fixture.stop();
  }
}

main().catch(error => {
  console.error(JSON.stringify({ ok: false, steps: report, error: String(error?.message ?? error) }, null, 2));
  process.exitCode = 1;
});
