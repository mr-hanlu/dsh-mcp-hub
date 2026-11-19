import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import {
  authorizeUrl, discover, exchangeCode, grantFromRecord, grantFromToken, grantNeedsRefresh,
  listenCallback, oauthKey, oauthReference, pkcePair, refreshGrant, registerClient,
  resourceMetadataUrls, serverMetadataUrls,
} from '../src/host/oauth.js';

/** Local authorization server: PRM on the MCP path, AS metadata one level down. */
async function authorizationServer(overrides = {}) {
  const seen = { register: [], token: [] };
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const send = (status, body, headers = {}) => {
      res.writeHead(status, { 'content-type': 'application/json', ...headers });
      res.end(JSON.stringify(body));
    };
    if (url.pathname === '/.well-known/oauth-protected-resource/mcp') {
      return send(200, { resource: `http://127.0.0.1:${server.address().port}/mcp`, authorization_servers: [`http://127.0.0.1:${server.address().port}/as`] });
    }
    if (url.pathname === '/.well-known/oauth-authorization-server/as' || url.pathname === '/.well-known/openid-configuration/as') {
      return send(200, {
        issuer: `http://127.0.0.1:${server.address().port}/as`,
        authorization_endpoint: `http://127.0.0.1:${server.address().port}/authorize`,
        token_endpoint: `http://127.0.0.1:${server.address().port}/token`,
        registration_endpoint: `http://127.0.0.1:${server.address().port}/register`,
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none'],
        ...overrides,
      });
    }
    if (url.pathname === '/register' && req.method === 'POST') {
      seen.register.push(url.pathname);
      return send(201, { client_id: 'client-1' });
    }
    if (url.pathname === '/token' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        seen.token.push(Object.fromEntries(new URLSearchParams(body)));
        const grant = String(body).includes('grant_type=refresh_token')
          ? { access_token: 'refreshed', refresh_token: 'refresh-2', expires_in: 3600 }
          : { access_token: 'access-1', refresh_token: 'refresh-1', token_type: 'Bearer', expires_in: 60, scope: 'read write' };
        send(200, grant);
      });
      return;
    }
    send(404, { error: 'not_found' });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { base: `http://127.0.0.1:${server.address().port}`, seen, close: () => new Promise(resolve => server.close(resolve)) };
}

test('oauth keys and references are namespaced and sanitized', () => {
  assert.equal(oauthKey('my server'), 'dsh-mcp-hub/oauth-my server');
  assert.equal(oauthReference('My Server'), 'MCPHUB_MY_SERVER_ACCESS_TOKEN');
  assert.equal(oauthReference('a.b/c-d'), 'MCPHUB_A_B_C_D_ACCESS_TOKEN');
  assert.ok(oauthReference('x'.repeat(120)).length <= 60);
});

test('PKCE pairs are S256 challenges of a verifier', () => {
  const pair = pkcePair();
  assert.match(pair.verifier, /^[A-Za-z0-9_-]{43,}$/);
  assert.equal(pair.challenge, createHash('sha256').update(pair.verifier).digest('base64url'));
});

test('metadata URLs preserve the MCP path and fall back to the origin', () => {
  const prm = resourceMetadataUrls('https://example.com/mcp/v1');
  assert.deepEqual(prm.urls, [
    'https://example.com/.well-known/oauth-protected-resource/mcp/v1',
    'https://example.com/.well-known/oauth-protected-resource',
  ]);
  assert.equal(prm.resource, 'https://example.com/mcp/v1');
  const urls = serverMetadataUrls('https://auth.example.com/tenant');
  assert.ok(urls.includes('https://auth.example.com/.well-known/oauth-authorization-server/tenant'));
  assert.ok(urls.includes('https://auth.example.com/.well-known/oauth-authorization-server'));
  assert.ok(urls.includes('https://auth.example.com/.well-known/openid-configuration/tenant'));
});

test('discovery walks PRM to AS metadata and validates PKCE support', async () => {
  const as = await authorizationServer();
  try {
    const found = await discover(as.base + '/mcp');
    assert.equal(found.resource, as.base + '/mcp');
    assert.equal(found.as.token_endpoint, as.base + '/token');
    assert.equal(found.issuer, as.base + '/as');
  } finally { await as.close(); }
});

test('discovery rejects an authorization server without S256 or endpoints', async () => {
  const as = await authorizationServer({ code_challenge_methods_supported: ['plain'], token_endpoint: undefined });
  try {
    await assert.rejects(() => discover(as.base + '/mcp'), /S256|PKCE|token_endpoint|授权/);
  } finally { await as.close(); }
});

test('client registration and code exchange send the expected parameters', async () => {
  const as = await authorizationServer();
  try {
    const found = await discover(as.base + '/mcp');
    const client = await registerClient(found.as, 'http://127.0.0.1:9999/callback');
    assert.equal(client.clientId, 'client-1');
    const grant = await exchangeCode(found.as, { clientId: client.clientId, code: 'code-1', verifier: 'verifier-1', redirectUri: 'http://127.0.0.1:9999/callback', resource: found.resource });
    assert.equal(grant.accessToken, 'access-1');
    assert.equal(grant.refreshToken, 'refresh-1');
    assert.equal(grant.scope, 'read write');
    assert.equal(typeof grant.expiresAt, 'number');
    const sent = as.seen.token[0];
    assert.equal(sent.grant_type, 'authorization_code');
    assert.equal(sent.code_verifier, 'verifier-1');
    assert.equal(sent.client_id, 'client-1');
    assert.equal(sent.resource, as.base + '/mcp');
    assert.equal(sent.client_secret, undefined);
  } finally { await as.close(); }
});

test('refresh keeps the previous refresh token and rotates the access token', async () => {
  const as = await authorizationServer();
  try {
    const found = await discover(as.base + '/mcp');
    const previous = grantFromToken({ access_token: 'old', refresh_token: 'refresh-1', expires_in: 60 }, found.as);
    const next = await refreshGrant(found.as, { clientId: 'client-1', refreshToken: previous.refreshToken, resource: found.resource });
    assert.equal(next.accessToken, 'refreshed');
    assert.equal(next.refreshToken, 'refresh-2');
    assert.equal(as.seen.token[0].grant_type, 'refresh_token');
    assert.equal(as.seen.token[0].refresh_token, 'refresh-1');
  } finally { await as.close(); }
});

test('grant records round-trip and expose refresh deadlines', () => {
  const grant = grantFromToken({ access_token: 'a', refresh_token: 'r', expires_in: 60, scope: 'read' }, { token_endpoint: 'https://as/token' });
  assert.equal(grantNeedsRefresh(grant, grant.expiresAt - 121_000), false);
  assert.equal(grantNeedsRefresh(grant, grant.expiresAt - 60_000), true);
  assert.equal(grantNeedsRefresh(grant, grant.expiresAt - 119_000), true);
  assert.equal(grantNeedsRefresh({ ...grant, refreshToken: undefined }, grant.expiresAt), false);
  const record = grantFromRecord({ kind: 'grant', payload: grant });
  assert.equal(record.accessToken, 'a');
  assert.equal(grantFromRecord(undefined, { accessToken: 'fallback' }), undefined);
  assert.match(authorizeUrl({ authorization_endpoint: 'https://as/authorize' }, { clientId: 'c', redirectUri: 'http://127.0.0.1/cb', challenge: 'ch', state: 's', resource: 'https://mcp' }), /code_challenge=ch/);
});

test('the loopback callback resolves once with the provider parameters', async () => {
  const callback = await listenCallback({ timeoutMs: 5000 });
  try {
    const pending = callback.wait;
    const response = await fetch(callback.redirectUri + '?code=abc&state=' + callback.state);
    assert.equal(response.status, 200);
    await pending;
    assert.equal(callback.state.code, 'abc');
    assert.equal(typeof callback.state.received, 'string');
  } finally { callback.close(); }
});
