/**
 * 端到端验收（接口层）：临时 DSH_HOME 里起真实 profile，用真实的
 * `/api/dsh-mcp-hub/*` 跑完整条链路，不写用户 profile，也不需要人工点页面。
 *
 * 阶段 1（stdio）：列表 → 扫描 → 测试 → 添加 → 后台验证 → 工具 → 启停 → 重启 → 删除。
 * 阶段 2（Streamable HTTP + 凭证）：
 *   - 静态 Bearer 头：测试 / 保存 / 验证 / 工具
 *   - `${credential:…}` 模板：配置里不落明文、能连上
 *   - 凭证轮换：改 `.credentials.yaml` 后客户端重连（connectedAt 变化）
 *   - 错误 token：验证失败，错误文本能看出 401
 *
 * 用法：npm run test:e2e
 *      DSH_BIN=/path/to/dsh npm run test:e2e
 * 找不到 dsh 时打印 SKIP 并以 0 退出；CI 里设 `DSH_E2E_REQUIRED=1` 让 SKIP 变成失败，
 * 避免「环境没装 DSH」被当成通过。页面级流程见 `ui-page.e2e.mjs`。
 */
import { spawn } from 'node:child_process';
import { chmod, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { bootProfile, createApi, createProfile, findDsh, skip, sleep } from './support/profile.mjs';

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const stdioFixture = repoRoot + '/tests/manual/echo-server.mjs';
const httpFixture = repoRoot + '/tests/manual/echo-http-server.mjs';
const report = [];
const step = (name, value) => report.push({ name, ...value });

function startHttpFixture(tokenFile) {
  const child = spawn(process.execPath, [httpFixture], { env: { ...process.env, TOKEN_FILE: tokenFile }, stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('HTTP fixture 启动超时：' + output)), 15000);
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/PORT=(\d+)/);
      if (match) { clearTimeout(timer); resolve({ port: Number(match[1]), stop: () => child.kill('SIGTERM') }); }
    });
    child.stderr.on('data', chunk => { output += chunk; });
    child.on('exit', code => { clearTimeout(timer); reject(new Error('HTTP fixture 退出：' + code + ' ' + output)); });
  });
}

async function main() {
  const bin = findDsh();
  if (!bin) {
    skip('端到端验收：本机没有可执行的 dsh（可用 DSH_BIN 指定）。');
    return;
  }
  const profile = await createProfile({ bin, repoRoot });
  let session, httpServer;
  try {
    step('install', { ok: true, home: profile.home });
    session = await bootProfile({ bin, profile: profile.name, env: profile.env });
    const call = createApi(session);
    const servers = async () => (await call('/servers')).body;
    // 轮询走轻量推送视图：状态与验证结论都在顶层，不必每次深拷贝工具 schema。
    const statusView = async () => (await call('/status')).body;
    const waitState = async (name, predicate, label, timeoutMs = 60000) => {
      const started = Date.now();
      for (;;) {
        const view = await statusView();
        const row = view.servers.find(item => item.name === name);
        if (predicate(row, view)) return { label, row, ms: Date.now() - started };
        if (Date.now() - started > timeoutMs) throw new Error(label + ' 超时：' + JSON.stringify(row));
        await sleep(300);
      }
    };
    /**
     * 验证失败会自动停用，那次写入会推进 revision；删除要容忍这种并发。
     *
     * 删除接口返回 200 之后，官方 Manager 仍可能保留一段 `managed: 'cleanup'`
     * 的「已删除，清理中」行（实测重启后立即删除约 200ms）。接口成功不等于列表
     * 已干净，所以这里等行真正消失，而不是拿到 200 就断言长度。
     */
    const removeRow = async name => {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const current = await servers();
        if (!current.servers.some(item => item.name === name)) return;
        const removed = await call('/mutate', { action: 'remove', revision: current.revision, name });
        if (removed.body?.ok) {
          const started = Date.now();
          while (Date.now() - started < 15000) {
            const view = await servers();
            if (!view.servers.some(item => item.name === name)) return;
            await sleep(200);
          }
          assert.fail('删除 ' + name + ' 后仍残留未清理的行');
        }
        if (removed.body?.code !== 'REVISION_CONFLICT') {
          assert.fail('删除 ' + name + ' 失败：' + JSON.stringify(removed.body));
        }
        await sleep(400);
      }
      assert.fail('删除 ' + name + ' 连续冲突，无法清理');
    };

    // ---------- 阶段 1：stdio 全链路 ----------
    const baseline = await servers();
    assert.equal(Array.isArray(baseline.servers), true);
    assert.equal(baseline.profile, profile.name);
    step('servers', { count: baseline.servers.length, revision: baseline.revision, storage: baseline.referenceStorage });

    const sources = await call('/sources');
    assert.equal(sources.status, 200);
    assert.equal(Array.isArray(sources.body?.sources), true);
    step('sources', { count: sources.body.sources.length });

    const stdioEntry = { transport: 'stdio', command: process.execPath, args: [stdioFixture], cwd: repoRoot, env: {} };
    const tested = await call('/test', { name: 'hubaccept', entry: stdioEntry });
    assert.equal(tested.body?.ok, true, '测试连接未通过：' + JSON.stringify(tested.body));
    step('test', { ok: true, stage: tested.body.stage, checks: tested.body.checks.length });

    const saved = await call('/mutate', { action: 'save', revision: baseline.revision, name: 'hubaccept', entry: stdioEntry });
    assert.equal(saved.body?.saved, true, '保存失败：' + JSON.stringify(saved.body));
    step('save', { ok: true, verifying: saved.body.verifying });

    const verified = await waitState('hubaccept', row => row?.verification && row.verification.state !== 'verifying', 'verify');
    assert.equal(verified.row.verification.state, 'ok', '后台验证未通过：' + JSON.stringify(verified.row.verification));
    step('verify', { state: verified.row.verification.state, detail: verified.row.verification.detail, ms: verified.ms });

    const tools = await call('/tools', { name: 'hubaccept' });
    assert.equal(tools.body?.tools?.length, 1);
    assert.equal(tools.body.tools[0].name, 'echo');
    step('tools', { count: tools.body.tools.length });

    let revision = (await servers()).revision;
    assert.equal((await call('/mutate', { action: 'toggle', revision, name: 'hubaccept', enabled: false })).body.ok, true);
    await waitState('hubaccept', row => row?.state === 'disabled', 'disable');
    step('disable', { state: 'disabled' });

    revision = (await servers()).revision;
    assert.equal((await call('/mutate', { action: 'toggle', revision, name: 'hubaccept', enabled: true })).body.ok, true);
    const reconnected = await waitState('hubaccept', row => row?.state === 'connected', 'enable');
    step('enable', { state: 'connected', ms: reconnected.ms });

    // 重启不需要 revision：这里故意传一个过期值，确保它不会被误判成保存冲突。
    const restarted = await call('/mutate', { action: 'restart', revision: 0, name: 'hubaccept' });
    assert.equal(restarted.status, 200, '重启被拒绝：' + JSON.stringify(restarted.body));
    step('restart', { status: restarted.status });

    await removeRow('hubaccept');
    const afterStdio = await servers();
    assert.equal(afterStdio.servers.length, baseline.servers.length, '删除后仍在列表里');
    step('remove', { count: afterStdio.servers.length, revision: afterStdio.revision });

    // ---------- 阶段 2：Streamable HTTP + 凭证 ----------
    const tokenFile = join(profile.home, 'http-token.txt');
    await writeFile(tokenFile, 'first-token');
    httpServer = await startHttpFixture(tokenFile);
    const url = `http://127.0.0.1:${httpServer.port}/mcp`;
    step('http-fixture', { port: httpServer.port });

    const staticEntry = { transport: 'streamable-http', url, headers: { Authorization: 'Bearer first-token' } };
    const httpTested = await call('/test', { name: 'hubhttp', entry: staticEntry });
    assert.equal(httpTested.body?.ok, true, 'HTTP 测试连接未通过：' + JSON.stringify(httpTested.body));
    step('http-test', { ok: true });

    revision = (await servers()).revision;
    assert.equal((await call('/mutate', { action: 'save', revision, name: 'hubhttp', entry: staticEntry })).body.saved, true);
    const httpVerified = await waitState('hubhttp', row => row?.verification && row.verification.state !== 'verifying', 'http-verify');
    assert.equal(httpVerified.row.verification.state, 'ok', 'HTTP 验证未通过：' + JSON.stringify(httpVerified.row.verification));
    assert.equal((await call('/tools', { name: 'hubhttp' })).body.tools.length, 1);
    step('http-verify', { state: 'ok', detail: httpVerified.row.verification.detail });
    await removeRow('hubhttp');

    // 凭证引用：配置里只留模板，真实值在 DSH 凭证服务里。
    const credentialsPath = join(profile.home, '.credentials.yaml');
    const writeCredentials = async value => {
      await writeFile(credentialsPath, `version: 1\nrefs:\n  E2E_MCP_TOKEN: ${value}\n`, { mode: 0o600 });
      await chmod(credentialsPath, 0o600);
    };
    await writeCredentials('first-token');
    await sleep(800);
    const credentialEntry = {
      transport: 'streamable-http',
      url,
      headers: { Authorization: 'Bearer ${credential:E2E_MCP_TOKEN}' },
    };
    const credentialTest = await call('/test', { name: 'hubcred', entry: credentialEntry });
    assert.equal(credentialTest.body?.ok, true, '凭证引用测试连接未通过：' + JSON.stringify(credentialTest.body));
    const referenceCheck = credentialTest.body.checks.find(check => check.label === '变量引用');
    assert.equal(referenceCheck?.ok, true);
    step('credential-test', { ok: true, detail: referenceCheck.detail });

    revision = (await servers()).revision;
    assert.equal((await call('/mutate', { action: 'save', revision, name: 'hubcred', entry: credentialEntry })).body.saved, true);
    const credentialVerified = await waitState('hubcred', row => row?.verification && row.verification.state !== 'verifying', 'credential-verify');
    assert.equal(credentialVerified.row.verification.state, 'ok', '凭证服务连接未通过：' + JSON.stringify(credentialVerified.row.verification));
    const stored = (await servers()).servers.find(item => item.name === 'hubcred');
    assert.match(String(stored?.entry?.headers?.Authorization ?? ''), /\$\{credential:E2E_MCP_TOKEN\}/, '配置里应保留凭证模板而不是明文');
    const before = (await statusView()).servers.find(item => item.name === 'hubcred')?.connectedAt;
    step('credential-save', { state: 'ok', connectedAt: before, template: true });

    // 凭证轮换：同时换服务端接受的 token 与凭证文件，客户端应自行重连。
    await writeFile(tokenFile, 'second-token');
    await writeCredentials('second-token');
    const rotated = await waitState('hubcred', row => row?.state === 'connected' && row.connectedAt !== before, 'credential-rotate', 90000);
    step('credential-rotate', { state: rotated.row.state, ms: rotated.ms, connectedAt: rotated.row.connectedAt });

    // 错误 token：验证应失败，且错误文本能看出 401（未来 needs-auth 归类的依据）。
    const badEntry = { transport: 'streamable-http', url, headers: { Authorization: 'Bearer wrong-token' } };
    revision = (await servers()).revision;
    const badSaved = await call('/mutate', { action: 'save', revision, name: 'hubbad', entry: badEntry });
    assert.equal(badSaved.status, 200, '错误 token 的保存请求本身应成功：' + JSON.stringify(badSaved.body));
    const badVerified = await waitState('hubbad', row => row?.verification && row.verification.state !== 'verifying', 'http-401');
    assert.equal(badVerified.row.verification.state, 'failed', '错误 token 不应验证通过');
    const badDetail = String(badVerified.row.verification.detail);
    step('http-401-raw', { detail: badDetail, ms: badVerified.ms });
    assert.match(badDetail, /需要认证|401/, '失败原因应能看出是认证问题：' + badDetail);
    // 认证失败应立即结算，不再等满验证预算。
    assert.ok(badVerified.ms < 15000, '认证失败应快速结算，实际 ' + badVerified.ms + ' ms');
    step('http-401', { state: 'failed', detail: badDetail, ms: badVerified.ms });
    await removeRow('hubbad');
    await removeRow('hubcred');

    const final = await servers();
    assert.equal(final.servers.length, baseline.servers.length, '清理后仍有残留条目');
    step('cleanup', { count: final.servers.length });
  } finally {
    httpServer?.stop();
    if (session) await session.stop();
    await profile.cleanup();
  }
  console.log(JSON.stringify({ ok: true, steps: report }, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({ ok: false, steps: report, error: String(error?.message ?? error) }, null, 2));
  process.exitCode = 1;
});