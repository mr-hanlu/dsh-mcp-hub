import { createInterface } from 'node:readline';

/**
 * 手工验收用的受控 MCP 服务：只实现 initialize 与 tools/list，
 * 用来在真实 profile 里验证「测试连接 → 添加 → 验证 → 工具注册」。
 * 它不读写任何外部资源，也不会被真实使用，验收脚本结束时会删除对应条目。
 */
const input = createInterface({ input: process.stdin });
// 验收晚页面上的「取消测试」时可以显式放慢握手（毫秒）。
const DELAY = Number(process.env.MCP_ECHO_DELAY ?? 0);

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
  if (DELAY) setTimeout(() => process.stdout.write(payload), DELAY);
  else process.stdout.write(payload);
});