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
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { bootProfile, createApi, createProfile, findDsh, runDsh, skip, sleep } from './support/profile.mjs';

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
    let call = createApi(session);
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

    // 正在运行的服务仍然是重名：放宽的只能是「已删除、清理中」那一行。
    const duplicate = await call('/mutate', { action: 'save', revision: (await servers()).revision, name: 'hubaccept', entry: stdioEntry });
    assert.equal(duplicate.body?.code, 'NAME_TAKEN', '运行中的同名服务没有被判为重名：' + JSON.stringify(duplicate.body));
    step('duplicate-guard', { code: duplicate.body.code });

    // 删除接口返回 200 之后，官方 Manager 仍会保留一段「已删除，清理中」的实例
    // （实测重启后立即删除约 200ms）。名字在配置里已经空出来，所以紧接着用同一个
    // 名字重新添加不该被当成「重名」：Host 用 NAME_CLEANING 区分，调用方短暂重试即可。
    revision = (await servers()).revision;
    const removedFirst = await call('/mutate', { action: 'remove', revision, name: 'hubaccept' });
    assert.equal(removedFirst.body?.ok, true, '删除失败：' + JSON.stringify(removedFirst.body));
    const readd = { attempts: 0, cleaning: 0, cleanupRows: 0, ms: 0 };
    const readdStart = Date.now();
    for (;;) {
      const current = await servers();
      if (current.servers.some(row => row.name === 'hubaccept' && row.managed === 'cleanup')) readd.cleanupRows += 1;
      const reply = await call('/mutate', { action: 'save', revision: current.revision, name: 'hubaccept', entry: stdioEntry });
      readd.attempts += 1;
      if (reply.body?.saved) { readd.ms = Date.now() - readdStart; break; }
      const code = reply.body?.code;
      if (code === 'NAME_CLEANING' || code === 'REVISION_CONFLICT') {
        if (code === 'NAME_CLEANING') {
          readd.cleaning += 1;
          assert.match(String(reply.body?.error ?? reply.body?.message), /清理中/, '清理期的提示应说明正在清理上一个连接：' + JSON.stringify(reply.body));
        }
        if (readd.attempts >= 40) assert.fail('删除后同名重新添加一直失败：' + JSON.stringify(reply.body));
        await sleep(150);
        continue;
      }
      assert.fail('删除后同名重新添加被拒：' + JSON.stringify(reply.body));
    }
    step('readd-while-cleaning', readd);
    const readded = await waitState('hubaccept', row => row?.state === 'connected', 'readd-connect', 60000);
    step('readd-connect', { state: readded.row.state, ms: readded.ms });

    await removeRow('hubaccept');
    const afterStdio = await servers();
    assert.equal(afterStdio.servers.length, baseline.servers.length, '删除后仍在列表里');
    step('remove', { count: afterStdio.servers.length, revision: afterStdio.revision });

    // ---------- 阶段 1.5：启动/发现慢与重连退避 ----------
    // 首次跑 npx 的包要下载依赖，握手可能明显慢于本地进程；只要在声明的启动预算内
    // 就该等到成功，而不是按「必须秒连上」判失败。
    const slowEntry = {
      transport: 'stdio', command: process.execPath, args: [stdioFixture], cwd: repoRoot,
      env: { MCP_ECHO_DELAY: '2500' }, startupTimeoutMs: 15000,
    };
    const slowTest = await call('/test', { name: 'hubslow', entry: slowEntry });
    assert.equal(slowTest.body?.ok, true, '慢握手测试失败：' + JSON.stringify(slowTest.body));
    revision = (await servers()).revision;
    assert.equal((await call('/mutate', { action: 'save', revision, name: 'hubslow', entry: slowEntry })).body.saved, true);
    const slowVerified = await waitState('hubslow', row => row?.verification && row.verification.state !== 'verifying', 'slow-verify', 60000);
    assert.equal(slowVerified.row.verification.state, 'ok', '慢握手验证未通过：' + JSON.stringify(slowVerified.row.verification));
    assert.ok(slowVerified.ms >= 2500, '慢握手的验证结束得太早（' + slowVerified.ms + ' ms），说明没有真的等到服务完成握手');
    step('slow-start', { state: 'ok', ms: slowVerified.ms, detail: slowVerified.row.verification.detail });
    await removeRow('hubslow');

    // 握手很快、工具发现慢：验证必须停在「同步工具」而不是提前判失败。
    const slowToolsEntry = {
      transport: 'stdio', command: process.execPath, args: [stdioFixture], cwd: repoRoot,
      env: { MCP_ECHO_TOOLS_DELAY: '2000' }, startupTimeoutMs: 15000,
    };
    revision = (await servers()).revision;
    assert.equal((await call('/mutate', { action: 'save', revision, name: 'hubtools', entry: slowToolsEntry })).body.saved, true);
    const slowToolsVerified = await waitState('hubtools', row => row?.verification && row.verification.state !== 'verifying', 'slow-tools-verify', 60000);
    assert.equal(slowToolsVerified.row.verification.state, 'ok', '慢工具发现验证未通过：' + JSON.stringify(slowToolsVerified.row.verification));
    assert.ok(slowToolsVerified.ms >= 2000, '工具发现慢时验证结束得太早（' + slowToolsVerified.ms + ' ms）');
    step('slow-tools', { state: 'ok', ms: slowToolsVerified.ms, detail: slowToolsVerified.row.verification.detail });
    await removeRow('hubtools');

    // 连上后进程退出：应进入重连退避并暴露第几次重试，而不是直接判「已连接」。
    const unstableEntry = {
      transport: 'stdio', command: process.execPath, args: [stdioFixture], cwd: repoRoot,
      env: { MCP_ECHO_EXIT_AFTER_INIT: '300' },
    };
    revision = (await servers()).revision;
    assert.equal((await call('/mutate', { action: 'save', revision, name: 'hubunstable', entry: unstableEntry })).body.saved, true);
    const reconnecting = await waitState('hubunstable', row => row?.state === 'reconnecting' && (row.attempt ?? 0) >= 1, 'reconnect', 30000);
    assert.ok((reconnecting.row.attempt ?? 0) >= 1, '重连状态应带上第几次重试：' + JSON.stringify(reconnecting.row));
    step('reconnect', { state: 'reconnecting', attempt: reconnecting.row.attempt, maxAttempts: reconnecting.row.maxAttempts });
    revision = (await servers()).revision;
    assert.equal((await call('/mutate', { action: 'toggle', revision, name: 'hubunstable', enabled: false })).body.ok, true);
    await waitState('hubunstable', row => row?.state === 'disabled', 'reconnect-disabled');
    await removeRow('hubunstable');

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

    // 永久性连接错误：禁用端口（bad port）没有重试价值，应在几秒内结算，而不是
    // 一直显示「第 N 次重试」直到启动预算耗尽。
    const deadPortEntry = { transport: 'streamable-http', url: 'http://127.0.0.1:1/mcp', headers: {} };
    revision = (await servers()).revision;
    assert.equal((await call('/mutate', { action: 'save', revision, name: 'hubbed', entry: deadPortEntry })).body.saved, true);
    const deadPort = await waitState('hubbed', row => row?.verification && row.verification.state !== 'verifying', 'dead-endpoint', 20000);
    assert.equal(deadPort.row.verification.state, 'failed', '不可达地址应记为失败：' + JSON.stringify(deadPort.row.verification));
    const deadDetail = String(deadPort.row.verification.detail);
    assert.match(deadDetail, /连接地址不可用|bad port/, '失败原因应说明地址不可用：' + deadDetail);
    assert.ok(deadPort.ms < 8000, '不可达地址应快速结算，实际 ' + deadPort.ms + ' ms');
    step('dead-endpoint', { state: 'failed', detail: deadDetail, ms: deadPort.ms });
    await removeRow('hubbed');
    await removeRow('hubcred');

    // ---------- 阶段 3：宿主重启后恢复 ----------
    // 桌面验收 2.x 的核心：重启 DSH 后配置、连接、工具、来源记录和上次失败原因都要回来，
    // 而不是把「已保存」当成「已恢复」。这里停掉真实 Host 再用同一个 profile 起来。
    revision = (await servers()).revision;
    assert.equal((await call('/mutate', { action: 'save', revision, name: 'hubrestart', entry: stdioEntry })).body.saved, true);
    const beforeRestart = await waitState('hubrestart', row => row?.state === 'connected', 'restart-connect');
    step('restart-connect', { state: beforeRestart.row.state });

    // 一个认证失败的条目：它的失败原因必须跨宿主重启保留下来。
    // 用 401 而不是 bad port，顺便覆盖认证原因的持久化路径。
    const deadEntry = { ...badEntry };
    revision = (await servers()).revision;
    assert.equal((await call('/mutate', { action: 'save', revision, name: 'hubdead', entry: deadEntry })).body.saved, true);
    const deadFailed = await waitState('hubdead', row => row?.verification && row.verification.state !== 'verifying', 'restart-failure', 30000);
    assert.equal(deadFailed.row.verification.state, 'failed', '连不上的条目应记为失败：' + JSON.stringify(deadFailed.row.verification));
    const failureDetail = String(deadFailed.row.verification.detail);
    step('restart-failure', { state: 'failed', detail: failureDetail });

    // 手动导入的来源记录也存在 sources.json 里，重启后必须还能看到。
    const imported = await call('/parse', { text: JSON.stringify({ mcpServers: { 'restart-import': { command: 'node', args: ['server.js'] } } }), filename: 'restart-import.json' });
    assert.equal(imported.status, 200, '导入来源失败：' + JSON.stringify(imported.body));
    const source = imported.body?.sources?.[0];
    assert.ok(source?.id?.startsWith('file-'), '导入来源应带 file- 前缀：' + JSON.stringify(imported.body));
    assert.equal(source.candidates.length, 1);
    step('restart-import', { id: source.id, candidates: source.candidates.length });

    await session.stop();
    session = await bootProfile({ bin, profile: profile.name, env: profile.env });
    call = createApi(session);
    const recovered = await waitState('hubrestart', row => row?.state === 'connected', 'restart-recover', 90000);
    step('restart-recover', { state: recovered.row.state, ms: recovered.ms });
    const recoveredTools = await call('/tools', { name: 'hubrestart' });
    assert.equal(recoveredTools.body?.tools?.length, 1, '重启后工具没有恢复注册：' + JSON.stringify(recoveredTools.body));

    const afterRestart = await servers();
    const deadRow = afterRestart.servers.find(item => item.name === 'hubdead');
    assert.equal(deadRow?.verification?.state, 'failed', '重启后上次失败原因没有恢复：' + JSON.stringify(deadRow));
    assert.equal(String(deadRow.verification.detail), failureDetail, '重启后的失败原因文本应保持一致');
    const sourceList = await call('/sources');
    const restoredSource = (sourceList.body?.sources ?? []).find(item => item.id === source.id);
    assert.ok(restoredSource, '重启后手动导入的来源丢失');
    assert.equal(restoredSource.candidates.length, 1);
    step('restart-persist', { verification: deadRow.verification.state, source: restoredSource.id });

    await removeRow('hubrestart');
    await removeRow('hubdead');
    const sourceRemoved = await call('/source-remove', { id: source.id });
    assert.equal(sourceRemoved.body?.sources?.some?.(item => item.id === source.id) ?? false, false, '来源删除后不应再出现');

    // ---------- 阶段 4：删除后重新导入 / 外部配置变更 / 连续操作 ----------
    // 4.1 删除服务后，同一条手动来源必须重新变成「可导入」：来源记录不因服务删除失效，
    // 重复识别也不能留下指向已删除条目的幽灵标记。
    const reimport = await call('/parse', {
      text: JSON.stringify({ mcpServers: { 'reimport-one': { command: process.execPath, args: [stdioFixture] } } }),
      filename: 'reimport.json',
    });
    assert.equal(reimport.status, 200, '导入来源失败：' + JSON.stringify(reimport.body));
    const reimportSource = reimport.body.sources[0];
    const reimportCandidate = reimportSource.candidates[0];
    revision = (await servers()).revision;
    const reimportSaved = await call('/mutate', { action: 'save', revision, name: 'reimport-one', candidateId: reimportCandidate.id, entry: reimportCandidate.entry });
    assert.equal(reimportSaved.body?.saved, true, '从来源导入失败：' + JSON.stringify(reimportSaved.body));
    await waitState('reimport-one', row => row?.state === 'connected', 'reimport-connect');
    const marked = (await call('/sources')).body.sources.find(item => item.id === reimportSource.id)?.candidates[0];
    assert.equal(marked?.duplicate, 'reimport-one', '已导入的来源应标记重复：' + JSON.stringify(marked));
    await removeRow('reimport-one');
    const cleared = (await call('/sources')).body.sources.find(item => item.id === reimportSource.id)?.candidates[0];
    assert.equal(cleared?.duplicate, undefined, '删除服务后来源仍被标记为已导入：' + JSON.stringify(cleared));
    assert.equal(cleared?.nameConflict, false);
    revision = (await servers()).revision;
    const reimportAgain = await call('/mutate', { action: 'save', revision, name: 'reimport-one', candidateId: reimportCandidate.id, entry: reimportCandidate.entry });
    assert.equal(reimportAgain.body?.saved, true, '删除后重新导入失败：' + JSON.stringify(reimportAgain.body));
    await waitState('reimport-one', row => row?.state === 'connected', 'reimport-again');
    step('reimport-after-delete', { duplicate: marked.duplicate, cleared: cleared.duplicate, source: reimportSource.id });
    await removeRow('reimport-one');
    await call('/source-remove', { id: reimportSource.id });

    // 4.2 外部配置变更：绕过本插件直接改 profile 的 cordis.patch.yml，模拟官方 Manager
    // 或用户手改。正在运行的 Manager 应热加载新条目并真正连上，删除后也不能留幽灵行。
    const patchPath = join(profile.home, 'profiles', profile.name, 'cordis.patch.yml');
    const originalPatch = await readFile(patchPath, 'utf8');
    const external = { transport: 'stdio', command: process.execPath, args: [stdioFixture] };
    const inlineServers = '    servers: {}\n';
    const blockServers = '    servers:\n';
    const externalText = `      extedit:\n        transport: ${external.transport}\n        command: ${JSON.stringify(external.command)}\n        args:\n          - ${JSON.stringify(external.args[0])}\n        enabled: true\n`;
    let patchedPatch;
    if (originalPatch.includes(inlineServers)) patchedPatch = originalPatch.replace(inlineServers, blockServers + externalText);
    else if (originalPatch.includes(blockServers)) patchedPatch = originalPatch.replace(blockServers, blockServers + externalText);
    else patchedPatch = originalPatch;
    assert.notEqual(patchedPatch, originalPatch, '找不到 mcp-manager 的 servers 位置，无法模拟外部写入');
    await writeFile(patchPath, patchedPatch);
    const externalAdded = await waitState('extedit', row => row?.state === 'connected', 'external-add', 30000);
    const externalRow = (await servers()).servers.find(item => item.name === 'extedit');
    // 直接写 cordis.patch.yml 等于写进 mcp-manager 的宿主层配置，插件无法区分「用户手改」
    // 与「官方 Manager 注册」；按既有边界展示为不可编辑的宿主行，而不是伪造可编辑状态。
    assert.ok(['inherited', 'plugin'].includes(externalRow?.managed), '外部写入的条目应按宿主配置展示：' + JSON.stringify(externalRow));
    assert.equal(externalRow?.editable, false);
    assert.equal(externalRow?.removable, false);
    step('external-config-add', { state: externalAdded.row.state, ms: externalAdded.ms, managed: externalRow.managed });
    await writeFile(patchPath, originalPatch);
    const externalRemovedMs = await (async () => {
      const started = Date.now();
      while (Date.now() - started < 15000) {
        if (!(await servers()).servers.some(item => item.name === 'extedit')) return Date.now() - started;
        await sleep(300);
      }
      assert.fail('外部删除后列表仍有残留条目');
    })();
    step('external-config-remove', { ms: externalRemovedMs });

    // 4.3 连续操作：同一个 revision 并发保存三条配置，只能有一条成功，其余必须明确报
    // 冲突；写队列不能互相覆盖，也不能留下半条状态。
    revision = (await servers()).revision;
    const burstNames = ['burst-a', 'burst-b', 'burst-c'];
    const burstEntry = { transport: 'stdio', command: process.execPath, args: [stdioFixture], cwd: repoRoot, env: {} };
    const burst = await Promise.all(burstNames.map(name => call('/mutate', { action: 'save', revision, name, entry: burstEntry })));
    const burstCodes = burst.map(reply => reply.body?.saved ? 'saved' : reply.body?.code);
    assert.equal(burstCodes.filter(code => code === 'saved').length, 1, '并发保存应只有一条成功：' + JSON.stringify(burstCodes));
    assert.equal(burstCodes.filter(code => code === 'REVISION_CONFLICT').length, 2, '其余并发保存应报 revision 冲突：' + JSON.stringify(burstCodes));
    for (const name of burstNames) await removeRow(name);
    step('burst-saves', { codes: burstCodes });

    const final = await servers();
    assert.equal(final.servers.length, baseline.servers.length, '清理后仍有残留条目');
    step('cleanup', { count: final.servers.length });
    // ---------- 阶段 5：验证过程中关闭 / 测试期间卸载 ----------
    // 5.1 保存后验证还在跑就把 Host 停掉。重启后不能出现「验证成功」的假象：
    // 要么是明确的中断/取消，要么没有结论，但绝不能是 ok；条目本身仍应连上。
    const stopEntry = { transport: 'stdio', command: process.execPath, args: [stdioFixture], cwd: repoRoot, env: { MCP_ECHO_DELAY: '2500' }, startupTimeoutMs: 15000 };
    revision = (await servers()).revision;
    const stopSaved = await call('/mutate', { action: 'save', revision, name: 'hubstop', entry: stopEntry });
    assert.equal(stopSaved.body?.verifying, true, '慢验证应立即返回进行中：' + JSON.stringify(stopSaved.body));
    await sleep(250);
    await session.stop();
    session = await bootProfile({ bin, profile: profile.name, env: profile.env });
    call = createApi(session);
    const stopRow = await waitState('hubstop', row => row && row.state !== 'disabled' && (row.verification?.state ?? 'none') !== 'verifying', 'stop-during-verify', 30000);
    assert.notEqual(stopRow.row.verification?.state, 'ok', '关闭时的验证不应记为成功：' + JSON.stringify(stopRow.row.verification));
    const stopRecovered = await waitState('hubstop', row => row?.state === 'connected', 'stop-recover', 60000);
    const stopTools = await call('/tools', { name: 'hubstop' });
    assert.equal(stopTools.body?.tools?.length, 1, '关闭后重启的工具没有恢复：' + JSON.stringify(stopTools.body));
    step('stop-during-verify', { verification: stopRow.row.verification?.state ?? 'none', detail: stopRow.row.verification?.detail ?? null, recovered: stopRecovered.ms });
    await removeRow('hubstop');

    // 5.2 测试期间卸载插件：移除包并重启后，插件路由必须整体消失，而不是残留半套 API。
    await session.stop();
    session = null;
    runDsh(bin, ['plugin', '--profile', profile.name, 'remove', 'dsh-mcp-hub'], profile.env);
    const dumped = runDsh(bin, ['--profile', profile.name, '--dump-config'], profile.env);
    assert.equal(dumped.includes('# == dsh-mcp-hub'), false, '卸载后组合配置里不应再有插件层');
    session = await bootProfile({ bin, profile: profile.name, env: profile.env, probe: false });
    const gone = await fetch(session.base + '/api/dsh-mcp-hub/servers', { headers: { cookie: session.cookies } });
    assert.equal(gone.status, 404, '卸载后插件路由应返回 404，实际 ' + gone.status);
    step('uninstall', { status: gone.status, layer: false });

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