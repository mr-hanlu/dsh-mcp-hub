/**
 * OAuth 2.1 for remote MCP servers.
 *
 * DSH already owns the two halves we need: `ctx.authorization` runs an
 * interactive flow and commits a credential record, and `ctx.credentials.set`
 * writes the referenced value that makes the MCP client reconnect. This module
 * only speaks the protocol in the middle: protected-resource metadata, the
 * authorization-server metadata, dynamic client registration, PKCE, the
 * loopback callback, and token exchange/refresh.
 *
 * Everything here is pure HTTP plus the PKCE helpers, so it can be tested
 * without a Host.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { fail } from '../shared/errors.js';

export const DISCOVERY_TIMEOUT_MS = 15000;
/** Refresh a little before expiry so a tool call does not race the clock. */
export const REFRESH_LEEWAY_MS = 120000;
const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;

/** Credential record key: one grant per server. */
export const oauthKey = server => `dsh-mcp-hub/oauth-${server}`;

/** Environment-style reference the config header points at. */
export function oauthReference(server) {
  const base = 'MCPHUB_' + String(server).toUpperCase().replace(/[^A-Z0-9]/g, '_') + '_ACCESS_TOKEN';
  return base.slice(0, 60).replace(/_+$/, '');
}

export function pkcePair() {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function timeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), ms);
  return { controller, done: () => clearTimeout(timer) };
}

async function getJson(url, { fetchImpl = fetch, timeoutMs = DISCOVERY_TIMEOUT_MS, label } = {}) {
  const gate = timeout(timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: { accept: 'application/json' },
      signal: gate.controller.signal,
    });
    if (!response.ok) return undefined;
    const type = response.headers.get('content-type') ?? '';
    if (!type.includes('json')) return undefined;
    const body = await response.json();
    return body && typeof body === 'object' ? body : undefined;
  } catch {
    return undefined;
  } finally { gate.done(); }
}

/** RFC 9728 candidates: path-aware well-known first, then the origin root. */
export function resourceMetadataUrls(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { fail('OAUTH_URL_INVALID', '服务地址不是有效的 URL'); }
  const path = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
  const urls = [];
  if (path) urls.push(`${url.origin}/.well-known/oauth-protected-resource${path}`);
  urls.push(`${url.origin}/.well-known/oauth-protected-resource`);
  return { urls, origin: url.origin, resource: `${url.origin}${url.pathname}` };
}

/** RFC 8414 / OIDC candidates for one issuer. */
export function serverMetadataUrls(issuer) {
  const url = new URL(issuer);
  const path = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
  const urls = [];
  if (path) urls.push(`${url.origin}/.well-known/oauth-authorization-server${path}`);
  if (path) urls.push(`${url.origin}/.well-known/openid-configuration${path}`);
  urls.push(`${url.origin}/.well-known/oauth-authorization-server`);
  urls.push(`${url.origin}/.well-known/openid-configuration`);
  return urls;
}

/**
 * Discover the protected-resource metadata and the authorization server it
 * names. Returns the raw documents plus the endpoints we will actually use.
 */
export async function discover(rawUrl, { fetchImpl = fetch, timeoutMs = DISCOVERY_TIMEOUT_MS } = {}) {
  const meta = resourceMetadataUrls(rawUrl);
  let prm;
  for (const url of meta.urls) {
    prm = await getJson(url, { fetchImpl, timeoutMs });
    if (prm) break;
  }
  if (!prm) fail('OAUTH_DISCOVERY_FAILED', '无法读取服务的 OAuth 保护资源元数据，请确认地址支持 OAuth 登录');
  const issuer = Array.isArray(prm.authorization_servers) && typeof prm.authorization_servers[0] === 'string'
    ? prm.authorization_servers[0]
    : meta.origin;
  let as;
  for (const url of serverMetadataUrls(issuer)) {
    as = await getJson(url, { fetchImpl, timeoutMs });
    if (as) break;
  }
  if (!as) fail('OAUTH_DISCOVERY_FAILED', '无法读取授权服务器的元数据，请稍后重试');
  if (typeof as.authorization_endpoint !== 'string' || typeof as.token_endpoint !== 'string') {
    fail('OAUTH_DISCOVERY_FAILED', '授权服务器没有提供授权或 token 端点');
  }
  const methods = Array.isArray(as.code_challenge_methods_supported) ? as.code_challenge_methods_supported : [];
  if (methods.length && !methods.includes('S256')) fail('OAUTH_UNSUPPORTED', '授权服务器不支持 PKCE S256，无法安全登录');
  if (as.token_endpoint_auth_methods_supported && !as.token_endpoint_auth_methods_supported.includes('none')
    && !as.registration_endpoint) {
    fail('OAUTH_UNSUPPORTED', '授权服务器要求客户端密钥，但又不支持动态注册，无法自动登录');
  }
  return { prm, as, resource: prm.resource ?? meta.resource, issuer };
}

/** RFC 7591 dynamic client registration. */
export async function registerClient(as, redirectUri, { fetchImpl = fetch, timeoutMs = DISCOVERY_TIMEOUT_MS, clientName = 'DSH MCP Hub' } = {}) {
  if (typeof as.registration_endpoint !== 'string') {
    fail('OAUTH_REGISTRATION_UNSUPPORTED', '该服务的授权服务器不支持动态客户端注册，暂时无法自动登录');
  }
  const gate = timeout(timeoutMs);
  try {
    const response = await fetchImpl(as.registration_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        client_name: clientName,
        redirect_uris: [redirectUri],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      }),
      signal: gate.controller.signal,
    });
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch { body = undefined; }
    if (!response.ok || !body?.client_id) {
      const detail = body?.error_description ?? body?.error ?? `HTTP ${response.status}`;
      fail('OAUTH_REGISTRATION_FAILED', '动态客户端注册失败：' + detail);
    }
    return { clientId: body.client_id, clientSecret: body.client_secret, response: body };
  } catch (error) {
    if (error?.code) throw error;
    fail('OAUTH_REGISTRATION_FAILED', '动态客户端注册请求失败：' + (error?.message ?? '网络错误'));
  } finally { gate.done(); }
}

export function authorizeUrl(as, { clientId, redirectUri, challenge, state, resource }) {
  const url = new URL(as.authorization_endpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);
  if (resource) url.searchParams.set('resource', resource);
  return url.toString();
}

async function tokenRequest(as, form, { fetchImpl = fetch, timeoutMs = DISCOVERY_TIMEOUT_MS } = {}) {
  const gate = timeout(timeoutMs);
  try {
    const response = await fetchImpl(as.token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams(form).toString(),
      signal: gate.controller.signal,
    });
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch { body = undefined; }
    if (!response.ok || !body?.access_token) {
      const detail = body?.error_description ?? body?.error ?? `HTTP ${response.status}`;
      fail('OAUTH_TOKEN_FAILED', '授权服务器没有返回 access token：' + detail);
    }
    return body;
  } catch (error) {
    if (error?.code) throw error;
    fail('OAUTH_TOKEN_FAILED', 'token 请求失败：' + (error?.message ?? '网络错误'));
  } finally { gate.done(); }
}

export async function exchangeCode(as, { clientId, clientSecret, code, verifier, redirectUri, resource }, options = {}) {
  const form = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: verifier,
  };
  if (clientSecret) form.client_secret = clientSecret;
  if (resource) form.resource = resource;
  return grantFromToken(await tokenRequest(as, form, options), as);
}

export async function refreshGrant(as, { clientId, clientSecret, refreshToken, resource }, options = {}) {
  const form = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  };
  if (clientSecret) form.client_secret = clientSecret;
  if (resource) form.resource = resource;
  return grantFromToken(await tokenRequest(as, form, options), as);
}

export function grantFromToken(token, as, previous = {}) {
  const now = Date.now();
  const seconds = Number(token.expires_in);
  return {
    accessToken: token.access_token,
    refreshToken: typeof token.refresh_token === 'string' && token.refresh_token ? token.refresh_token : previous.refreshToken,
    tokenType: typeof token.token_type === 'string' ? token.token_type : 'Bearer',
    scope: typeof token.scope === 'string' ? token.scope : previous.scope,
    expiresAt: Number.isFinite(seconds) && seconds > 0 ? now + seconds * 1000 : previous.expiresAt,
    tokenEndpoint: as?.token_endpoint ?? previous.tokenEndpoint,
    authorizationEndpoint: as?.authorization_endpoint ?? previous.authorizationEndpoint,
    issuer: as?.issuer ?? previous.issuer,
  };
}

export function grantNeedsRefresh(grant, now = Date.now()) {
  if (!grant?.refreshToken) return false;
  if (!Number.isFinite(grant.expiresAt)) return false;
  return grant.expiresAt - now <= REFRESH_LEEWAY_MS;
}

export function grantFromRecord(record, fallback = {}) {
  const payload = record?.kind === 'grant' && record.payload && typeof record.payload === 'object' ? record.payload : undefined;
  if (!payload || typeof payload.accessToken !== 'string' || !payload.accessToken) return undefined;
  return { ...fallback, ...payload };
}

/** Minimal loopback listener for the authorization-code redirect. */
export async function listenCallback({ timeoutMs = CALLBACK_TIMEOUT_MS } = {}) {
  const { createServer } = await import('node:http');
  const state = { code: undefined, error: undefined, received: undefined };
  let settle;
  const response = new Promise((resolve, reject) => { settle = { resolve, reject }; });
  const html = (title, message) => `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${title}</title>`
    + '<style>body{font:16px/1.6 system-ui;margin:8vh auto;max-width:34rem;padding:0 1.5rem;color:#111}</style>'
    + `<h1>${title}</h1><p>${message}</p><p>可以回到 DSH 继续。</p></html>`;
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (url.pathname !== '/callback') { res.writeHead(404).end(); return; }
    state.code = url.searchParams.get('code') ?? undefined;
    state.error = url.searchParams.get('error_description') ?? url.searchParams.get('error') ?? undefined;
    state.received = url.searchParams.get('state') ?? undefined;
    const ok = Boolean(state.code) && !state.error;
    res.writeHead(ok ? 200 : 400, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(html(ok ? '授权完成' : '授权未完成', ok ? '正在把结果交回 DSH…' : (state.error ?? '没有收到授权码，请重试。')));
    settle.resolve();
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  const redirectUri = `http://127.0.0.1:${port}/callback`;
  const timer = setTimeout(() => settle.reject(new Error('timeout')), timeoutMs);
  return {
    redirectUri,
    state,
    wait: response.finally(() => { clearTimeout(timer); server.close(); }),
    close: () => { clearTimeout(timer); server.close(); try { settle.resolve(); } catch {} },
    server,
  };
}

export { randomUUID as oauthState };