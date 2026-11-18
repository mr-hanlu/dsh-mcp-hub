import { createInterface } from 'node:readline';
import { writeFileSync } from 'node:fs';

/**
 * 手工验收用的受控 MCP 服务：只实现 initialize 与 tools/list，
 * 用来在真实 profile 里验证「测试连接 → 添加 → 验证 → 工具注册」。
 * 它不读写任何外部资源，也不会被真实使用，验收脚本结束时会删除对应条目。
 */
const input = createInterface({ input: process.stdin });
// 验收晚页面上的「取消测试」时可以显式放慢握手（毫秒）。
const DELAY = Number(process.env.MCP_ECHO_DELAY ?? 0);
// 只放慢工具发现，用来验证「握手很快、工具同步慢」不会让验证提前失败。
const TOOLS_DELAY = Number(process.env.MCP_ECHO_TOOLS_DELAY ?? 0);
// 握手成功后主动退出，用来验证重连退避与「第几次重试」的状态展示。
const EXIT_AFTER_INIT = Number(process.env.MCP_ECHO_EXIT_AFTER_INIT ?? 0);
// 故意忽略 SIGTERM，配合 PID_FILE 验证「清理未完成」行的状态展示。
if (process.env.MCP_ECHO_IGNORE_SIGTERM === '1') process.on('SIGTERM', () => {});
if (process.env.MCP_ECHO_PID_FILE) writeFileSync(process.env.MCP_ECHO_PID_FILE, String(process.pid));

input.on('line', line => {
  if (!line.trim()) return;
  let request;
  try { request = JSON.parse(line); } catch { return; }
  if (request.id === undefined) return;
  let result;
  if (request.method === 'initialize') {
    result = {
      protocolVersion: request.params?.protocolVersion ?? '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: { name: 'hub-accept-fixture', version: '1.0.0' },
    };
    if (EXIT_AFTER_INIT) setTimeout(() => process.exit(1), EXIT_AFTER_INIT).unref();
  } else if (request.method === 'tools/list') {
    result = {
      tools: [{
        name: 'echo',
        description: '返回传入的文本，仅用于验收',
        inputSchema: { type: 'object', properties: { text: { type: 'string' } } },
      }],
    };
  } else {
    result = {};
  }
  const payload = JSON.stringify({ jsonrpc: '2.0', id: request.id, result }) + '\n';
  const wait = DELAY + (request.method === 'tools/list' ? TOOLS_DELAY : 0);
  if (wait) setTimeout(() => { try { process.stdout.write(payload); } catch { /* 已退出 */ } }, wait);
  else process.stdout.write(payload);
});