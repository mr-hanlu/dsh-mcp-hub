/**
 * 手工 / 技术验证用的最小 OAuth 2.1 授权服务器 + 受保护 MCP 服务。
 *
 * 一个进程同时扮演：
 * - Protected Resource Metadata（RFC 9728）
 * - Authorization Server Metadata（RFC 8414）
 * - 动态客户端注册（RFC 7591）
 * - 授权码 + PKCE S256
 * - token / refresh_token
 * - 要求 Bearer 的 Streamable HTTP MCP（initialize / tools/list）
 *
 * 第一行打印 `BASE=http://127.0.0.1:<port>`，供测试读取。状态可用 GET /state 查看。
 * 不访问网络、不写磁盘，token 只存在内存里。
 */
import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';

const ttl = Number(process.env.TOKEN_TTL_MS || 60000);
const clients = new Map();
const codes = new Map();
const tokens = new Map();
const refreshes = new Map();
const state = { registrations: 0, authorizations: 0, tokenRequests: 0, refreshRequests: 0, seen: [], rejected: 0 };

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const base = `http://127.0.0.1:${server.address().port}`;
  const json = (status, body, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers });
    res.end(JSON.stringify(body));
  };
  const readBody = async () => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8');
  };

  if (req.method === 'GET' && url.pathname === '/.well-known/oauth-protected-resource/mcp') {
    return json(200, {
      resource: `${base}/mcp`,
      authorization_servers: [base],
      scopes_supported: ['read', 'write'],
      bearer_methods_supported: ['header'],
    });
  }
  if (req.method === 'GET' && url.pathname === '/.well-known/oauth-authorization-server') {
    return json(200, {
      issuer: base,
      authorization_endpoint: `${base}/authorize`,
      token_endpoint: `${base}/token`,
      registration_endpoint: `${base}/register`,
      revocation_endpoint: `${base}/revoke`,
      scopes_supported: ['read', 'write'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['none'],
      code_challenge_methods_supported: ['S256'],
    });
  }
  if (req.method === 'POST' && url.pathname === '/register') {
    let body;
    try { body = JSON.parse(await readBody()); } catch { return json(400, { error: 'invalid_client_metadata' }); }
    if (!Array.isArray(body.redirect_uris) || !body.redirect_uris.length) return json(400, { error: 'invalid_redirect_uri' });
    const clientId = randomUUID();
    clients.set(clientId, { redirect_uris: body.redirect_uris, name: body.client_name ?? '' });
    state.registrations += 1;
    return json(201, {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: body.redirect_uris,
      token_endpoint_auth_method: 'none',
    });
  }
  if (req.method === 'GET' && url.pathname === '/authorize') {
    const client = clients.get(url.searchParams.get('client_id'));
    const redirect = url.searchParams.get('redirect_uri');
    const challenge = url.searchParams.get('code_challenge');
    if (!client || !redirect || !client.redirect_uris.includes(redirect)) return json(400, { error: 'invalid_request' });
    if (url.searchParams.get('response_type') !== 'code' || url.searchParams.get('code_challenge_method') !== 'S256' || !challenge) {
      return json(400, { error: 'invalid_request' });
    }
    const code = randomUUID();
    codes.set(code, {
      clientId: url.searchParams.get('client_id'),
      redirect,
      challenge,
      state: url.searchParams.get('state'),
      resource: url.searchParams.get('resource'),
      scope: url.searchParams.get('scope'),
      expires: Date.now() + 60000,
    });
    state.authorizations += 1;
    const location = new URL(redirect);
    location.searchParams.set('code', code);
    if (url.searchParams.get('state')) location.searchParams.set('state', url.searchParams.get('state'));
    res.writeHead(302, { location: location.toString() });
    return res.end();
  }
  if (req.method === 'POST' && url.pathname === '/token') {
    const body = new URLSearchParams(await readBody());
    const grant = body.get('grant_type');
    if (grant === 'authorization_code') {
      state.tokenRequests += 1;
      const record = codes.get(body.get('code'));
      codes.delete(body.get('code'));
      if (!record || record.expires < Date.now()) return json(400, { error: 'invalid_grant' });
      if (record.clientId !== body.get('client_id') || record.redirect !== body.get('redirect_uri')) return json(400, { error: 'invalid_grant' });
      const verifier = body.get('code_verifier') ?? '';
      const challenge = createHash('sha256').update(verifier).digest('base64url');
      if (challenge !== record.challenge) return json(400, { error: 'invalid_grant', error_description: 'PKCE mismatch' });
      const access = `at-${randomUUID()}`;
      const refresh = `rt-${randomUUID()}`;
      tokens.set(access, { expires: Date.now() + ttl, resource: record.resource });
      refreshes.set(refresh, { clientId: record.clientId });
      return json(200, {
        access_token: access,
        token_type: 'Bearer',
        expires_in: Math.max(1, Math.floor(ttl / 1000)),
        refresh_token: refresh,
        scope: record.scope ?? 'read write',
        resource: record.resource,
      });
    }
    if (grant === 'refresh_token') {
      state.refreshRequests += 1;
      const record = refreshes.get(body.get('refresh_token'));
      if (!record) return json(400, { error: 'invalid_grant' });
      const access = `at-${randomUUID()}`;
      const refresh = `rt-${randomUUID()}`;
      tokens.set(access, { expires: Date.now() + ttl });
      refreshes.delete(body.get('refresh_token'));
      refreshes.set(refresh, record);
      return json(200, {
        access_token: access,
        token_type: 'Bearer',
        expires_in: Math.max(1, Math.floor(ttl / 1000)),
        refresh_token: refresh,
        scope: 'read write',
      });
    }
    return json(400, { error: 'unsupported_grant_type' });
  }
  if (req.method === 'POST' && url.pathname === '/mcp') {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const record = tokens.get(token);
    if (!record || record.expires < Date.now()) {
      state.rejected += 1;
      return json(401, { error: 'invalid_token' }, { 'www-authenticate': `Bearer error="invalid_token", resource_metadata="${base}/.well-known/oauth-protected-resource/mcp"` });
    }
    if (!state.seen.includes(token)) state.seen.push(token);
    let body;
    try { body = JSON.parse(await readBody()); } catch { return json(400, { error: 'invalid_request' }); }
    const reply = message => {
      res.writeHead(200, { 'content-type': 'application/json', 'mcp-session-id': randomUUID() });
      res.end(JSON.stringify(message));
    };
    if (body.method === 'initialize') {
      return reply({ jsonrpc: '2.0', id: body.id, result: { protocolVersion: body.params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'oauth-fixture', version: '1.0.0' } } });
    }
    if (body.method === 'tools/list') {
      return reply({ jsonrpc: '2.0', id: body.id, result: { tools: [{ name: 'whoami', description: 'Returns the token prefix that authenticated this call', inputSchema: { type: 'object', properties: {} } }] } });
    }
    if (body.method === 'notifications/initialized') {
      res.writeHead(202);
      return res.end();
    }
    return reply({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: 'method not found' } });
  }
  if (req.method === 'GET' && url.pathname === '/state') {
    return json(200, { ...state, tokens: [...tokens.keys()], clients: clients.size, codes: codes.size });
  }
  return json(404, { error: 'not_found' });
});

server.listen(0, '127.0.0.1', () => {
  console.log(`BASE=http://127.0.0.1:${server.address().port}`);
});