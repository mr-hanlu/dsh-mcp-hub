/**
 * 模拟来源的功能验收（接口层）：用一个「装了各种客户端」的假 HOME 走完整链路。
 *
 * 与 `web-profile.e2e.mjs` 的区别：那边从一个空 profile 开始，用 API 手工拼配置；
 * 这里从**各应用真实的写法**出发（明文密钥、`${env:X}`、`${X}`、`{env:X}`、
 * Codex 的 Bearer / env 请求头 / env_vars、停用项、未知字段、缺变量），
 * 验证「扫描 → 导入 → 密钥写入凭证服务 → 真连接 → 导出」在页面上看到的效果。
 *
 * 用法：npm run test:simulated
 * 依赖本机 dsh；不碰用户 profile，也不写假 HOME 之外的任何位置。
 */
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { bootProfile, createApi, createProfile, findDsh, skip, sleep } from './support/profile.mjs';
import { SIMULATED_ENV, buildSimulatedHome } from './support/simulated-home.mjs';

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const stdioFixture = repoRoot + '/tests/manual/echo-server.mjs';
const httpFixture = repoRoot + '/tests/manual/echo-http-server.mjs';
const report = [];
const step = (name, value) => report.push({ name, ...value });

function startHttpFixture(env = {}) {
  const child = spawn(process.execPath, [httpFixture], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
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

const digest = async path => createHash('sha256').update(await readFile(path)).digest('hex');
const isReference = value => /^\$\{credential:MCPHUB_[A-Z0-9_]+\}$/.test(String(value ?? ''));
const isReferenceWithScheme = value => /^Bearer \$\{credential:MCPHUB_[A-Z0-9_]+\}$/.test(String(value ?? ''));

async function main() {
  const bin = findDsh();
  if (!bin) { skip('模拟来源验收：本机没有可执行的 dsh（可用 DSH_BIN 指定）。'); return; }

  const profile = await createProfile({ bin, repoRoot });
  const fakeHome = await mkdtemp(join(tmpdir(), 'dsh-mcp-hub-simhome-'));
  let session, authServer, openServer;
  try {
    authServer = await startHttpFixture({ TOKEN: SIMULATED_ENV.DOCS_TOKEN });
    openServer = await startHttpFixture();
    const authUrl = `http://127.0.0.1:${authServer.port}/mcp`;
    const openUrl = `http://127.0.0.1:${openServer.port}/mcp`;
    const built = await buildSimulatedHome({ root: fakeHome, stdioFixture, cwd: repoRoot, authUrl, openUrl });
    const before = Object.fromEntries(await Promise.all(built.files.map(async path => [path, await digest(path)])));
    step('fixtures', { home: fakeHome, files: built.files.length, authPort: authServer.port, openPort: openServer.port });

    // HOME 换到假目录：扫描读的是「装了这些客户端」的那台机器，DSH_HOME 仍是临时 profile。
    session = await bootProfile({ bin, profile: profile.name, env: { ...profile.env, HOME: fakeHome, ...SIMULATED_ENV } });
    const call = createApi(session);
    const servers = async () => (await call('/servers')).body;
    const revision = async () => (await servers()).revision;
    const statusView = async () => (await call('/status')).body;
    const waitConnected = async (name, timeoutMs = 60000) => {
      const started = Date.now();
      for (;;) {
        const row = (await statusView()).servers.find(item => item.name === name);
        if (row?.state === 'connected') return Date.now() - started;
        if (Date.now() - started > timeoutMs) throw new Error(name + ' 没有连上：' + JSON.stringify(row));
        await sleep(250);
      }
    };
    // 扫描是单独的一步：`/sources` 只呈现已经扫过的分组（页面加载时自己会扫一次）。
    const sourceOf = async () => {
      const scanned = await call('/scan', {});
      assert.equal(scanned.status, 200, '扫描失败：' + JSON.stringify(scanned.body));
      return scanned.body.sources;
    };
    const candidatesOf = async () => (await sourceOf()).flatMap(source => source.candidates.map(row => ({ ...row, sourceId: source.id })));
    const candidate = async name => {
      const found = (await candidatesOf()).find(row => row.name === name);
      assert.ok(found, '扫描结果里没有 ' + name);
      return found;
    };
    const save = async (name, extra = {}) => {
      const found = await candidate(name);
      return call('/mutate', { action: 'save', revision: await revision(), name, entry: found.entry, candidateId: found.id, ...extra });
    };

    // ---------- 1. 扫描：九个来源、各种密钥写法都在 ----------
    const sources = await sourceOf();
    const ids = sources.filter(source => source.candidates.length).map(source => source.id);
    assert.deepEqual(ids.sort(), ['claude', 'claude-desktop', 'codex', 'copilot-cli', 'cursor', 'gemini', 'opencode', 'vscode', 'windsurf']);
    const all = await candidatesOf();
    assert.equal(all.length, 15, '候选数量不对：' + all.map(row => row.name).join('、'));
    assert.ok(all.every(row => row.entry), '候选条目被清空了');
    step('sources', { groups: ids.length, candidates: all.length, names: all.map(row => row.name) });

    // 停用项：状态保留，导入时默认仍按来源配置走（保存时可显式保持停用）。
    const disabled = await candidate('sim-desktop-disabled');
    assert.equal(disabled.entry.enabled, false, 'Claude Desktop 的 disabled: true 没有保留');

    // 需要核对字段：VS Code 的 envFile、Gemini 的 timeout / trust。
    const vscode = await candidate('sim-vscode-local');
    assert.match(vscode.issues.join(' '), /envFile/);
    const gemini = await candidate('sim-gemini-http');
    assert.match(gemini.issues.join(' '), /timeout/);
    assert.match(gemini.issues.join(' '), /trust/);
    step('issues', { vscode: vscode.issues, gemini: gemini.issues });

    // ---------- 2. 明文密钥：写入凭证服务，配置只留引用 ----------
    const plain = await save('sim-desktop-plain');
    assert.equal(plain.body?.saved, true, '明文密钥的服务没保存成功：' + JSON.stringify(plain.body));
    assert.ok(plain.body.credentials?.stored?.length >= 1, '保存结果里没有写入凭证的记录');
    const plainMs = await waitConnected('sim-desktop-plain');
    const plainRow = (await servers()).servers.find(row => row.name === 'sim-desktop-plain');
    assert.ok(isReference(plainRow.entry.env.WIKI_API_KEY), '配置里不是凭证引用：' + plainRow.entry.env.WIKI_API_KEY);
    const revealed = await call('/reveal', { field: 'env', key: 'WIKI_API_KEY', originalName: 'sim-desktop-plain' });
    assert.equal(revealed.body?.value, 'sk-live-desktop-secret', '读回的密钥不对：' + JSON.stringify(revealed.body));
    assert.ok(!JSON.stringify(plainRow).includes('sk-live-desktop-secret'), '列表接口泄漏了明文密钥');
    step('plain-secret', { ms: plainMs, credential: plain.body.credentials.stored[0].name, reference: plainRow.entry.env.WIKI_API_KEY });

    // ---------- 3. `${env:X}` 与 `${X}` 两种引用 ----------
    const envRef = await save('sim-claude-ref');
    assert.equal(envRef.body?.saved, true, 'env 引用的服务没保存成功：' + JSON.stringify(envRef.body));
    const envRefMs = await waitConnected('sim-claude-ref');
    const envRefValue = await call('/reveal', { field: 'env', key: 'GITHUB_TOKEN', originalName: 'sim-claude-ref' });
    assert.equal(envRefValue.body?.value, 'shared-secret-value', '`${env:X}` 没有解析成宿主环境里的值');
    const bare = await save('sim-claude-bare');
    assert.equal(bare.body?.saved, true, '`${X}` 简写没保存成功：' + JSON.stringify(bare.body));
    const bareMs = await waitConnected('sim-claude-bare');
    const bareValue = await call('/reveal', { field: 'env', key: 'TOKEN', originalName: 'sim-claude-bare' });
    assert.equal(bareValue.body?.value, 'bare-secret-value', '`${X}` 简写没有解析成宿主环境里的值');
    step('env-references', { envRefMs, bareMs });

    // ---------- 4. Codex：Bearer 环境变量 + env 请求头 + env_vars ----------
    const codexHttp = await save('sim-codex-http');
    assert.equal(codexHttp.body?.saved, true, 'Codex HTTP 服务没保存成功：' + JSON.stringify(codexHttp.body));
    const codexHttpMs = await waitConnected('sim-codex-http');
    const codexRow = (await servers()).servers.find(row => row.name === 'sim-codex-http');
    assert.ok(isReferenceWithScheme(codexRow.entry.headers.Authorization), 'Bearer 头不是凭证引用：' + codexRow.entry.headers.Authorization);
    assert.ok(isReference(codexRow.entry.headers['X-Tenant-Id']), 'env_http_headers 不是凭证引用：' + codexRow.entry.headers['X-Tenant-Id']);
    assert.equal((await call('/tools', { name: 'sim-codex-http' })).body.tools.length, 1, 'HTTP 服务没有注册工具');
    step('codex-http', { ms: codexHttpMs, authorization: codexRow.entry.headers.Authorization, tenant: codexRow.entry.headers['X-Tenant-Id'] });

    const codexStdio = await save('sim-codex-stdio');
    assert.equal(codexStdio.body?.saved, true, 'Codex stdio 服务没保存成功：' + JSON.stringify(codexStdio.body));
    await waitConnected('sim-codex-stdio');
    const codexStdioRow = (await servers()).servers.find(row => row.name === 'sim-codex-stdio');
    assert.ok(isReference(codexStdioRow.entry.env.SHARED_TOKEN), 'env_vars 没有变成凭证引用：' + codexStdioRow.entry.env.SHARED_TOKEN);
    assert.equal(codexStdioRow.entry.env.SIM_MODE, '1', '普通环境变量不该被凭证化');
    step('codex-env-vars', { shared: codexStdioRow.entry.env.SHARED_TOKEN, mode: codexStdioRow.entry.env.SIM_MODE });

    // ---------- 5. 重复识别：Copilot 与 Codex 是同一条连接 ----------
    const copilot = await candidate('sim-copilot-http');
    assert.equal(copilot.duplicate, 'sim-codex-http', '跨来源的相同连接没有被认成重复：' + JSON.stringify({ duplicate: copilot.duplicate, nameConflict: copilot.nameConflict }));
    step('duplicate', { duplicate: copilot.duplicate });

    // ---------- 6. 缺变量：不给导入，并指出缺哪一项 ----------
    const missing = await save('sim-vscode-missing');
    assert.equal(missing.body?.saved, false, '缺变量的服务不该保存成功');
    const missingDetail = missing.body.checks.find(item => item.label === '变量引用')?.detail ?? '';
    assert.match(missingDetail, /SIM_NOT_CONFIGURED/, '没有指出缺哪个变量：' + missingDetail);
    assert.ok(!(await servers()).servers.some(row => row.name === 'sim-vscode-missing'), '缺变量的条目被写进了配置');
    step('missing-variable', { detail: missingDetail });

    // ---------- 7. 需要核对字段：不确认就不写 ----------
    const unconfirmed = await save('sim-gemini-http');
    assert.equal(unconfirmed.body?.code, 'CONFIG_INVALID', '未确认的未知字段应被拒绝：' + JSON.stringify(unconfirmed.body));
    const geminiSaved = await save('sim-gemini-http', { acceptUnsupported: true });
    assert.equal(geminiSaved.body?.saved, true, '确认后仍没保存成功：' + JSON.stringify(geminiSaved.body));
    const geminiMs = await waitConnected('sim-gemini-http');
    const geminiRow = (await servers()).servers.find(row => row.name === 'sim-gemini-http');
    assert.ok(isReferenceWithScheme(geminiRow.entry.headers.Authorization), 'Gemini 的 Bearer 引用没落成凭证');
    step('needs-review', { ms: geminiMs });

    // ---------- 8. 相对命令：本机跑不起来就明确拒绝 ----------
    const relative = await save('sim-codex-relative');
    assert.equal(relative.body?.saved, false, '相对命令的服务不该保存成功');
    const commandCheck = relative.body.checks.find(item => item.label === '启动命令');
    assert.equal(commandCheck?.ok, false, '相对命令没有被指出：' + JSON.stringify(relative.body.checks));
    assert.ok(!(await servers()).servers.some(row => row.name === 'sim-codex-relative'), '相对命令的条目被写进了配置');
    step('relative-command', { detail: commandCheck.detail });

    // ---------- 9. 其余来源也能导入并连上 ----------
    for (const name of ['sim-opencode-local', 'sim-opencode-remote', 'sim-vscode-local', 'sim-windsurf-local', 'sim-cursor-local']) {
      const saved = await save(name, { acceptUnsupported: true });
      assert.equal(saved.body?.saved, true, name + ' 没保存成功：' + JSON.stringify(saved.body));
      await waitConnected(name);
    }
    const cursorRow = (await servers()).servers.find(row => row.name === 'sim-cursor-local');
    assert.ok(isReference(cursorRow.entry.env.CURSOR_TOKEN), 'Cursor 的明文密钥没有凭证化');
    step('other-sources', { imported: 5 });

    // ---------- 10. 导出：默认不含密钥，勾选后才内联 ----------
    const safe = await call('/export', { includeSecrets: false });
    assert.ok(!JSON.stringify(safe.body).includes('sk-live-desktop-secret'), '默认导出里出现了明文密钥');
    const withSecrets = await call('/export', { includeSecrets: true });
    assert.ok(JSON.stringify(withSecrets.body).includes('sk-live-desktop-secret'), '勾选包含密钥后没有内联明文');
    assert.deepEqual(withSecrets.body.credentialsMissing ?? [], [], '导出时报告了不存在的缺失凭证');
    step('export', { safeServers: Object.keys(safe.body.backup ?? {}).length, withSecrets: Object.keys(withSecrets.body.backup ?? {}).length });

    // ---------- 11. 来源文件没有被写回 ----------
    for (const path of built.files) assert.equal(await digest(path), before[path], '来源文件被改写了：' + path);
    step('sources-untouched', { files: built.files.length });

    // ---------- 12. 删除：引用回收提示 ----------
    const current = await servers();
    const removed = await call('/mutate', { action: 'remove', revision: current.revision, name: 'sim-desktop-plain' });
    assert.equal(removed.body?.ok, true, '删除失败：' + JSON.stringify(removed.body));
    assert.ok((removed.body.cleanup ?? []).length >= 1, '删除后没有提示已无引用的凭证');
    step('remove', { cleanup: removed.body.cleanup });

    const final = await servers();
    step('final', { rows: final.servers.length });
  } finally {
    authServer?.stop();
    openServer?.stop();
    if (session) await session.stop();
    await profile.cleanup();
    await rm(fakeHome, { recursive: true, force: true });
  }
  console.log(JSON.stringify({ ok: true, steps: report }, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({ ok: false, steps: report, error: String(error?.message ?? error) }, null, 2));
  process.exitCode = 1;
});