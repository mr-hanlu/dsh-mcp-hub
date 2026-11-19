/**
 * 可选端到端验收：真实客户端留下的 MCP 配置文件。
 *
 * 插件按用户真实 home 扫描（与 DSH_HOME 无关）；本机装着 Codex / Claude Code / Cursor /
 * Windsurf / Copilot / VS Code 时才有意义。它验证两件事：文档里的目录约定确实指向真实
 * 文件，以及真实文件形状能被解析成可导入的服务，而不是拿手写样本自证。
 *
 * 默认跳过；显式开启：DSH_E2E_REAL_SOURCES=1 npm run test:real-sources
 */
import { access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { bootProfile, createApi, createProfile, findDsh, skip } from './support/profile.mjs';

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const CANDIDATES = [
  '.codex/config.toml',
  '.claude.json',
  '.cursor/mcp.json',
  '.codeium/windsurf/mcp_config.json',
  '.codeium/windsurf-next/mcp_config.json',
  'Library/Application Support/Code/User/mcp.json',
  'Library/Application Support/Code - Insiders/User/mcp.json',
  '.vscode-server/data/User/mcp.json',
  '.copilot/mcp-config.json',
];
const report = [];
const step = (name, value) => report.push({ name, ...value });

async function main() {
  if (process.env.DSH_E2E_REAL_SOURCES !== '1') {
    console.log('SKIP 真实来源验收：设置 DSH_E2E_REAL_SOURCES=1 后运行 npm run test:real-sources');
    return;
  }
  const bin = findDsh();
  if (!bin) {
    skip('真实来源验收：本机没有可执行的 dsh（可用 DSH_BIN 指定）。');
    return;
  }
  const home = homedir();
  const found = [];
  for (const relative of CANDIDATES) {
    const absolute = join(home, relative);
    try { await access(absolute); found.push({ relative, absolute }); } catch {}
  }
  if (found.length === 0) {
    skip('真实来源验收：本机没有找到 Codex / Claude Code / Cursor / Windsurf / Copilot / VS Code 的 MCP 配置文件。');
    return;
  }
  const profile = await createProfile({ bin, repoRoot });
  let session;
  try {
    session = await bootProfile({ bin, profile: profile.name, env: profile.env });
    const call = createApi(session);
    const scanned = await call('/scan', {});
    assert.equal(scanned.status, 200, '扫描失败：' + JSON.stringify(scanned.body).slice(0, 500));
    const sources = scanned.body?.sources ?? [];
    const rows = found.map(file => {
      const source = sources.find(item => (item.files ?? []).some(entry => String(entry.path).endsWith(file.relative)));
      return { file: file.relative, id: source?.id ?? null, state: source?.files?.[0]?.state ?? 'missing', services: source?.candidates?.length ?? 0 };
    });
    assert.equal(rows.every(row => row.id), true, '真实文件没有对应的来源：' + JSON.stringify(rows));
    const parsed = rows.filter(row => row.state === 'read');
    assert.equal(parsed.length, rows.length, '真实文件没有被读取：' + JSON.stringify(rows));
    assert.ok(rows.some(row => row.services >= 1), '真实文件没有解析出任何服务：' + JSON.stringify(rows));
    step('real-sources', { files: rows });
    console.log(JSON.stringify({ ok: true, steps: report }, null, 2));
  } finally {
    if (session) await session.stop();
    await profile.cleanup();
  }
}

main().catch(error => {
  console.error(JSON.stringify({ ok: false, steps: report, error: String(error?.message ?? error) }, null, 2));
  process.exitCode = 1;
});
