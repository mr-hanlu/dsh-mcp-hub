/**
 * 来源兼容矩阵：把各应用真实写法的脱敏样本摆进临时 HOME，走真实的扫描路径。
 *
 * 覆盖 P0-2 的几条：四个来源的实际字段、Codex 的 CODEX_HOME / env_vars / Bearer、
 * OpenCode 的 JSONC 与路径覆盖、重复与同名不同配置、停用项、未知字段，
 * 以及相对命令 / 相对参数 / 空 PATH 这些「换台机器就跑不起来」的场景。
 */
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { connectionFingerprint, preflight, scanSources } from '../src/host/config.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, 'fixtures', 'sources');
const MAC = 'Library/Application Support';

/** 一份「装了所有来源」的临时 HOME；文件内容见 tests/fixtures/sources。 */
async function materialize() {
  const home = await mkdtemp(join(tmpdir(), 'mcp-hub-sources-'));
  const put = async (target, file) => {
    await mkdir(dirname(join(home, target)), { recursive: true });
    await copyFile(join(fixtures, file), join(home, target));
  };
  await put('.claude.json', 'claude-code.json');
  await put('.codex/config.toml', 'codex-config.toml');
  await put(`${MAC}/Claude/claude_desktop_config.json`, 'claude-desktop.json');
  await put('.config/opencode/opencode.jsonc', 'opencode.jsonc');
  await put('.gemini/settings.json', 'gemini-settings.json');
  await put(`${MAC}/Code/User/mcp.json`, 'vscode-mcp.json');
  await put('.codeium/windsurf/mcp_config.json', 'windsurf-mcp.json');
  await put('.copilot/mcp-config.json', 'copilot-mcp.json');
  await mkdir(join(home, '.cursor'), { recursive: true });
  await writeFile(join(home, '.cursor/mcp.json'), JSON.stringify({ mcpServers: { 'cursor-demo': { command: 'node', args: ['cursor.js'] } } }));
  return home;
}

const home = await materialize();
after(() => rm(home, { recursive: true, force: true }));

const scan = (env = {}) => scanSources({ home, env, platform: 'darwin' });
const group = (sources, id) => {
  const found = sources.find(source => source.id === id);
  assert.ok(found, '扫描结果里没有来源 ' + id);
  return found;
};
const candidate = (source, name) => {
  const found = source.candidates.find(row => row.name === name);
  assert.ok(found, `${source.id} 里没有候选 ${name}，实际有：` + source.candidates.map(row => row.name).join('、'));
  return found;
};
const check = (checked, label) => checked.checks.find(item => item.label === label);

test('Claude Code：项目级服务被发现，顶层空 mcpServers 数组不算解析失败', async () => {
  const claude = group(await scan(), 'claude');
  assert.equal(claude.files[0].state, 'read', '真实的 "mcpServers": [] 被当成了读取错误');
  assert.equal(claude.files[0].count, 4);
  assert.deepEqual(claude.candidates.map(row => row.name).sort(), ['internal-docs', 'legacy-sse', 'playwright', 'warehouse']);
  const docs = candidate(claude, 'internal-docs');
  assert.equal(docs.entry.transport, 'streamable-http');
  // 来源文件的写法原样保留，`${env:}` 改写发生在保存时（planReferences）。
  assert.equal(docs.entry.headers.Authorization, 'Bearer ${DOCS_TOKEN}');
  assert.match(String(docs.detail), /shop-api$/, '项目级来源没有带上项目目录');
  const warehouse = candidate(claude, 'warehouse');
  assert.equal(warehouse.entry.env.WAREHOUSE_DSN, '${WAREHOUSE_DSN}');
  const sse = candidate(claude, 'legacy-sse');
  assert.equal(sse.entry.transport, 'sse');
  assert.match(sse.issues.join(' '), /暂不支持此传输方式/);
});

test('Codex：相对命令、env_vars 转发、Bearer 与 env 请求头都迁移', async () => {
  const codex = group(await scan(), 'codex');
  assert.equal(codex.files[0].state, 'read');
  assert.equal(codex.files[0].count, 3);

  const tool = candidate(codex, 'computer-use');
  assert.equal(tool.entry.transport, 'stdio');
  assert.equal(tool.entry.command, './Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient');
  assert.deepEqual(tool.entry.args, ['mcp']);
  assert.deepEqual(tool.issues, [], '真实样本不该有待核对字段：' + tool.issues.join('；'));

  const repl = candidate(codex, 'repl');
  assert.equal(repl.entry.env.BROWSER_USE_ACCESS_PIPE_PATH, '${env:BROWSER_USE_ACCESS_PIPE_PATH}', 'env_vars 没有迁移成引用');
  assert.equal(repl.entry.env.NODE_REPL_TRUSTED_SERVICES, '${env:NODE_REPL_TRUSTED_SERVICES}');
  assert.equal(repl.entry.env.NODE_REPL_NATIVE_PIPE_CONNECT_TIMEOUT_MS, '2000', '显式 env 表不应被 env_vars 覆盖');
  assert.equal(repl.entry.startupTimeoutMs, 120000);
  assert.deepEqual(repl.issues, []);

  const docs = candidate(codex, 'docs');
  assert.equal(docs.entry.transport, 'streamable-http');
  assert.equal(docs.entry.headers.Authorization, 'Bearer ${env:DOCS_TOKEN}');
  assert.equal(docs.entry.headers['X-Tenant-Id'], '${env:TENANT_ID}', 'env_http_headers 没有迁移成引用');
  assert.equal(docs.entry.startupTimeoutMs, 20000);
});

test('Codex 的 CODEX_HOME 会被优先读取，默认位置仍会一起看', async () => {
  const alt = await mkdtemp(join(tmpdir(), 'mcp-hub-codexhome-'));
  try {
    await writeFile(join(alt, 'config.toml'), '[mcp_servers.alt]\ncommand = "/opt/example/bin/alt"\n');
    const codex = group(await scan({ CODEX_HOME: alt }), 'codex');
    assert.match(codex.files[0].path, /mcp-hub-codexhome-/, 'CODEX_HOME 里的 config.toml 没有排在最前');
    assert.ok(codex.candidates.some(row => row.name === 'alt'));
    assert.ok(codex.candidates.some(row => row.name === 'repl'), '默认位置的文件也应一起扫描');
  } finally { await rm(alt, { recursive: true, force: true }); }
});

test('Claude Desktop：已停用条目保留状态，路径参数原样保留', async () => {
  const desktop = group(await scan(), 'claude-desktop');
  assert.equal(desktop.files[0].state, 'read');
  const filesystem = candidate(desktop, 'filesystem');
  assert.deepEqual(filesystem.entry.args, ['-y', '@modelcontextprotocol/server-filesystem', '/Users/example/Documents']);
  const wiki = candidate(desktop, 'company-wiki');
  assert.equal(wiki.entry.enabled, false, 'disabled: true 没有被保留');
});

test('OpenCode：JSONC、新容器、单花括号引用与停用项', async () => {
  const opencode = group(await scan(), 'opencode');
  assert.ok(opencode.files.some(file => file.state === 'read' && file.path.endsWith('opencode.jsonc')), '没有读到 opencode.jsonc');
  assert.equal(opencode.candidates.length, 3);
  const math = candidate(opencode, 'math');
  assert.equal(math.entry.command, 'node');
  assert.deepEqual(math.entry.args, ['math-server.js']);
  assert.equal(math.entry.env.MATH_TOKEN, '${MATH_TOKEN}');
  const catalog = candidate(opencode, 'catalog');
  assert.equal(catalog.entry.transport, 'streamable-http');
  assert.equal(catalog.entry.headers['X-Api-Key'], '{env:CATALOG_KEY}');
  assert.equal(candidate(opencode, 'retired').entry.enabled, false);
});

test('OpenCode 的 OPENCODE_CONFIG 与 XDG_CONFIG_HOME 覆盖默认路径', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mcp-hub-opencode-'));
  try {
    const custom = join(dir, 'custom.json');
    await writeFile(custom, JSON.stringify({ mcp: { solo: { type: 'local', command: ['node', 'solo.js'] } } }));
    const byFile = group(await scan({ OPENCODE_CONFIG: custom }), 'opencode');
    assert.equal(byFile.files[0].path, custom, 'OPENCODE_CONFIG 没有排在最前');
    assert.ok(byFile.candidates.some(row => row.name === 'solo'));
    const byXdg = group(await scan({ XDG_CONFIG_HOME: dir }), 'opencode');
    assert.match(byXdg.files[0].path, /opencode\/opencode\.(json|jsonc)$/, 'XDG_CONFIG_HOME 没有参与路径计算');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('Gemini CLI：httpUrl 走 HTTP，单位不明的 timeout 与 trust 需要核对', async () => {
  const gemini = group(await scan(), 'gemini');
  const search = candidate(gemini, 'search');
  assert.equal(search.entry.transport, 'streamable-http');
  assert.equal(search.entry.url, 'https://search.example.com/mcp');
  assert.equal(search.entry.headers.Authorization, 'Bearer ${SEARCH_TOKEN}');
  const issues = search.issues.join(' ');
  assert.match(issues, /timeout/, 'timeout 单位不明，应交给用户核对');
  assert.match(issues, /trust/);
});

test('VS Code / Copilot：type 决定连接方式，envFile 不被静默丢弃', async () => {
  const vscode = group(await scan(), 'vscode');
  const local = candidate(vscode, 'local-tools');
  assert.equal(local.entry.transport, 'stdio');
  assert.equal(local.entry.command, 'node');
  assert.match(local.issues.join(' '), /envFile/, 'envFile 没有出现在待核对字段里');
  const remote = candidate(vscode, 'remote-tools');
  assert.equal(remote.entry.transport, 'streamable-http');
  assert.equal(remote.entry.headers['X-Api-Key'], '${TOOLS_KEY}');

  const copilot = group(await scan(), 'copilot-cli');
  assert.equal(candidate(copilot, 'github').entry.headers.Authorization, 'Bearer ${GITHUB_PAT}');
  assert.equal(candidate(copilot, 'local-notes').entry.command, 'node');

  const windsurf = group(await scan(), 'windsurf');
  assert.equal(candidate(windsurf, 'postgres').entry.env.DBHUB_DISABLE_TELEMETRY, '1');

  const cursor = group(await scan(), 'cursor');
  assert.equal(candidate(cursor, 'cursor-demo').entry.command, 'node');
});

test('同名不同配置、相同 URL 不同认证都算不同连接', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mcp-hub-dupes-'));
  try {
    const desktopPath = join(dir, MAC, 'Claude');
    const windsurfPath = join(dir, '.codeium/windsurf');
    await mkdir(desktopPath, { recursive: true });
    await mkdir(windsurfPath, { recursive: true });
    await writeFile(join(desktopPath, 'claude_desktop_config.json'), JSON.stringify({ mcpServers: { shared: { command: 'node', args: ['one.js'] } } }));
    await writeFile(join(windsurfPath, 'mcp_config.json'), JSON.stringify({ mcpServers: { shared: { command: 'node', args: ['one.js'] } } }));
    const sources = await scanSources({ home: dir, env: {}, platform: 'darwin' });
    const a = candidate(group(sources, 'claude-desktop'), 'shared').entry;
    const b = candidate(group(sources, 'windsurf'), 'shared').entry;
    assert.equal(connectionFingerprint(a), connectionFingerprint(b), '完全相同的配置应判为同一个连接（界面显示已添加）');

    await writeFile(join(windsurfPath, 'mcp_config.json'), JSON.stringify({ mcpServers: { shared: { command: 'node', args: ['two.js'] } } }));
    const changed = await scanSources({ home: dir, env: {}, platform: 'darwin' });
    assert.notEqual(connectionFingerprint(candidate(group(changed, 'claude-desktop'), 'shared').entry), connectionFingerprint(candidate(group(changed, 'windsurf'), 'shared').entry), '同名不同配置不能被当成同一个');

    const sameUrl = { transport: 'streamable-http', url: 'https://mcp.example.com/api', headers: { Authorization: 'Bearer one' } };
    const otherAuth = { ...sameUrl, headers: { Authorization: 'Bearer two' } };
    const noAuth = { transport: 'streamable-http', url: 'https://mcp.example.com/api', headers: {} };
    assert.notEqual(connectionFingerprint(sameUrl), connectionFingerprint(otherAuth), '相同地址不同认证必须区分');
    assert.notEqual(connectionFingerprint(sameUrl), connectionFingerprint(noAuth));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('相对命令、相对参数与空 PATH 都被明确指出来', async () => {
  const sources = await scan();
  const tool = candidate(group(sources, 'codex'), 'computer-use');
  const relative = await preflight('computer-use', tool.entry, { env: { PATH: '' }, cwd: home, home });
  assert.equal(relative.ok, false);
  assert.equal(check(relative, '启动命令').ok, false, '相对命令落到别的机器上必然失效，应判失败');
  assert.ok(isAbsolute(relative.entry.command), '相对命令没有被解析成绝对路径：' + relative.entry.command);

  const local = candidate(group(sources, 'vscode'), 'local-tools');
  const argsCheck = await preflight('local-tools', local.entry, { env: { PATH: '' }, cwd: home, home });
  assert.match(String(check(argsCheck, '相对路径')?.detail ?? ''), /工作目录/, '参数里的相对路径应要求填写工作目录');

  const absolute = { transport: 'stdio', command: '/opt/example/bin/server', args: [] };
  const pathOnly = await preflight('absolute', absolute, { env: { PATH: '' }, cwd: home, home });
  assert.match(String(check(pathOnly, '启动命令').detail), /PATH/, '空 PATH 时应提示 DSH 的 PATH 里找不到命令');
});