import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

/**
 * 手工 / 端到端验收用的受控 Streamable HTTP MCP 服务。
 *
 * - 只实现 initialize、tools/list、tools/call（echo），不访问网络或磁盘。
 * - 带 `TOKEN` 环境变量时要求 `Authorization: Bearer <TOKEN>`，否则返回 401，
 *   用来验证「需要认证的服务」与凭证引用链路。
 * - 监听 0.0.0.0 的随机端口，第一行打印 `PORT=<n>` 供测试读取。
 */
import { readFileSync } from 'node:fs';

const fixedToken = process.env.TOKEN || '';
const tokenFile = process.env.TOKEN_FILE || '';
const sessions = new Set();

/** 凭证轮换验收：TOKEN_FILE 每次请求现读，改文件即等于换 token。 */
function currentToken() {
  if (tokenFile) {
    try { return readFileSync(tokenFile, 'utf8').trim(); } catch { return ''; }
  }
  return fixedToken;
}

const server = createServer(async (req, res) => {
  if (req.method !== 'POST' || !req.url?.startsWith('/mcp')) {
    // Streamable HTTP 客户端会用 DELETE 结束会话。
    if (req.method === 'DELETE') { res.writeHead(200, { 'mcp-session-id': req.headers['mcp-session-id'] ?? '' }); return res.end(); }
    res.writeHead(404, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ error: 'not found' }));
  }
  const token = currentToken();
  if (token) {
    const header = req.headers.authorization ?? '';
    if (header !== 'Bearer ' + token) {
      res.writeHead(401, {
        'content-type': 'application/json',
        'www-authenticate': 'Bearer realm="hub-e2e", error="invalid_token"',
      });
      return res.end(JSON.stringify({ error: 'invalid token' }));
    }
  }
  let text = '';
  for await (const chunk of req) text += chunk;
  let request;
  try { request = JSON.parse(text); } catch {
    res.writeHead(400, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ error: 'invalid json' }));
  }
  const reply = result => {
    const headers = { 'content-type': 'application/json' };
    const session = req.headers['mcp-session-id'];
    if (session) headers['mcp-session-id'] = session;
    res.writeHead(200, headers);
    res.end(JSON.stringify({ jsonrpc: '2.0', id: request.id ?? null, result }));
  };
  if (request.id === undefined) { res.writeHead(202); return res.end(); }
  if (request.method === 'initialize') {
    const id = randomUUID();
    sessions.add(id);
    const headers = { 'content-type': 'application/json', 'mcp-session-id': id };
    res.writeHead(200, headers);
    return res.end(JSON.stringify({
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: request.params?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'hub-e2e-http', version: '1.0.0' },
      },
    }));
  }
  if (request.method === 'tools/list') {
    return reply({
      tools: [{
        name: 'echo',
        description: '返回传入的文本，仅用于验收',
        inputSchema: { type: 'object', properties: { text: { type: 'string' } } },
      }],
    });
  }
  if (request.method === 'tools/call') {
    return reply({ content: [{ type: 'text', text: String(request.params?.arguments?.text ?? '') }] });
  }
  return reply({});
});

server.listen(0, '127.0.0.1', () => {
  const { port } = server.address();
  console.log('PORT=' + port);
});