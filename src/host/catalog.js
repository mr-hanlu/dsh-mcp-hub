import { fail } from '../shared/errors.js';

/** Official MCP Registry is a read-only public API. The Host proxies it because the
 * registry does not send CORS headers that a browser page could use directly. */
export const DEFAULT_CATALOG_BASE = 'https://registry.modelcontextprotocol.io';
const SUPPORTED_PACKAGE_TYPES = new Set(['npm', 'pypi', 'oci']);
const MAX_LIMIT = 50;
const MAX_QUERY = 120;

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' ? value : '';

/** Registry names are reverse-DNS with a slash; DSH names are short local aliases. */
export function suggestedServiceName(registryName) {
  const tail = text(registryName).split('/').filter(Boolean).at(-1) ?? '';
  const safe = tail.replace(/[^A-Za-z0-9_-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
  return safe || 'mcp-server';
}

function argumentValue(argument) {
  if (!isObject(argument)) return '';
  if (argument.type === 'named') {
    const name = text(argument.name);
    if (!name) return '';
    return argument.value === undefined ? name : name + '=' + text(argument.value);
  }
  return text(argument.value);
}

function argumentList(arguments_) {
  return (Array.isArray(arguments_) ? arguments_ : []).map(argumentValue).filter(Boolean);
}

function packageEntry(pkg) {
  const type = text(pkg?.registryType);
  if (!SUPPORTED_PACKAGE_TYPES.has(type)) return null;
  const identifier = text(pkg.identifier);
  const version = text(pkg.version);
  if (!identifier || !version) return null;
  const runtimeArguments = argumentList(pkg.runtimeArguments);
  const packageArguments = argumentList(pkg.packageArguments);
  const warnings = [];
  let command;
  let args;
  if (type === 'npm') {
    command = text(pkg.runtimeHint) || 'npx';
    args = [...runtimeArguments];
    if (command === 'npx' && !args.some(value => value === '-y' || value === '--yes')) args.push('-y');
    args.push(identifier + '@' + version, ...packageArguments);
  } else if (type === 'pypi') {
    command = text(pkg.runtimeHint) || 'uvx';
    // uv accepts the `package@version` form for tool execution.
    args = [...runtimeArguments, identifier + '@' + version, ...packageArguments];
  } else {
    command = text(pkg.runtimeHint) || 'docker';
    args = runtimeArguments.length ? [...runtimeArguments] : ['run', '-i', '--rm'];
    const image = identifier.includes(':') ? identifier : identifier + ':' + version;
    args.push(image, ...packageArguments);
  }
  if (args.some(value => /[{}]/.test(value))) warnings.push('命令参数中包含待替换的变量，请在保存前补全');
  const env = {};
  for (const item of Array.isArray(pkg.environmentVariables) ? pkg.environmentVariables : []) {
    if (!item || typeof item.name !== 'string' || !item.name) continue;
    const value = text(item.value ?? item.default);
    env[item.name] = value;
    if (item.isRequired && !value) warnings.push('需要填写环境变量 ' + item.name);
    if (item.isSecret) warnings.push(item.name + ' 是密钥，建议使用 DSH 凭证引用');
  }
  return {
    id: 'package:' + type + ':' + identifier + '@' + version,
    kind: 'package',
    label: '本地 · ' + type + ' · ' + command,
    entry: { transport: 'stdio', command, args, env, cwd: '', enabled: true },
    warnings,
  };
}

function remoteEntry(remote, index) {
  const type = text(remote?.type);
  const url = text(remote?.url);
  if (!url || !['streamable-http', 'sse'].includes(type)) return null;
  if (type !== 'streamable-http') {
    return {
      id: 'remote:' + index,
      kind: 'unsupported',
      label: '远程 · ' + type,
      warning: '当前 DSH 版本不支持 SSE 传输，请使用该服务的 HTTP 地址或本地包',
    };
  }
  const headers = {};
  const warnings = [];
  for (const item of Array.isArray(remote.headers) ? remote.headers : []) {
    if (!item || typeof item.name !== 'string' || !item.name) continue;
    const value = text(item.value ?? item.default);
    headers[item.name] = value;
    if (!value) warnings.push('需要填写请求头 ' + item.name);
    if (/[{}]/.test(value)) warnings.push('请求头 ' + item.name + ' 包含待替换的变量');
  }
  if (/[{}]/.test(url)) warnings.push('服务地址包含待替换的变量，请在保存前补全');
  return {
    id: 'remote:' + index,
    kind: 'remote',
    label: '远程 · ' + type,
    entry: { transport: 'streamable-http', url, headers, enabled: true },
    warnings,
  };
}

/** Convert a registry server.json into the editor's entry shape, without writing anything. */
export function installOptions(server) {
  const options = [];
  const unsupported = [];
  const warnings = [];
  for (const pkg of Array.isArray(server?.packages) ? server.packages : []) {
    const option = packageEntry(pkg);
    if (option) options.push(option);
    else unsupported.push('暂不支持 ' + (text(pkg?.registryType) || '未知') + ' 包类型的自动转换');
  }
  for (const [index, remote] of (Array.isArray(server?.remotes) ? server.remotes : []).entries()) {
    const option = remoteEntry(remote, index);
    if (!option) continue;
    if (option.kind === 'unsupported') unsupported.push(option.warning);
    else options.push(option);
  }
  for (const option of options) warnings.push(...option.warnings);
  return {
    name: suggestedServiceName(server?.name),
    registryName: text(server?.name),
    title: text(server?.title) || text(server?.name),
    version: text(server?.version),
    repository: text(server?.repository?.url),
    options,
    unsupported: [...new Set(unsupported)],
    warnings: [...new Set(warnings)],
    canInstall: options.length > 0,
  };
}

function summary(server, meta) {
  const transports = [];
  for (const remote of Array.isArray(server?.remotes) ? server.remotes : []) {
    if (remote?.type && !transports.includes(remote.type)) transports.push(remote.type);
  }
  for (const pkg of Array.isArray(server?.packages) ? server.packages : []) {
    const type = pkg?.transport?.type;
    if (type && !transports.includes(type)) transports.push(type);
  }
  const packageTypes = [...new Set((Array.isArray(server?.packages) ? server.packages : []).map(pkg => pkg?.registryType).filter(Boolean))];
  const official = meta?.['io.modelcontextprotocol.registry/official'];
  const icon = (Array.isArray(server?.icons) ? server.icons : [])
    .map(item => text(item?.src))
    .find(src => /^https:\/\//.test(src)) || '';
  return {
    name: text(server?.name),
    title: text(server?.title) || text(server?.name),
    description: text(server?.description),
    version: text(server?.version),
    repository: text(server?.repository?.url),
    repositorySource: text(server?.repository?.source),
    repositorySubfolder: text(server?.repository?.subfolder),
    websiteUrl: text(server?.websiteUrl),
    icon,
    publishedAt: text(official?.publishedAt),
    updatedAt: text(official?.updatedAt),
    transports,
    packageTypes,
    canInstall: installOptions(server).canInstall,
  };
}

class CatalogClient {
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl || DEFAULT_CATALOG_BASE).replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 8000;
    this.cacheMs = options.cacheMs ?? 300000;
    this.fetch = options.fetchImpl ?? ((...args) => globalThis.fetch(...args));
    this.cache = new Map();
  }

  async request(url, signal) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const abort = () => controller.abort();
    signal?.addEventListener?.('abort', abort, { once: true });
    try {
      const response = await this.fetch(url, { headers: { accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) fail('CATALOG_UNAVAILABLE', '官方 MCP 目录请求失败（HTTP ' + response.status + '）');
      try { return await response.json(); }
      catch { fail('CATALOG_INVALID', '官方 MCP 目录返回了无法解析的数据'); }
    } catch (error) {
      if (error?.name === 'AbortError') fail('CATALOG_UNAVAILABLE', '官方 MCP 目录请求超时');
      if (error?.code) throw error;
      fail('CATALOG_UNAVAILABLE', '无法连接官方 MCP 目录，请稍后重试');
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener?.('abort', abort);
    }
  }

  cached(key) {
    if (!this.cacheMs) return undefined;
    const hit = this.cache.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expires) { this.cache.delete(key); return undefined; }
    return hit.value;
  }

  remember(key, value) {
    if (!this.cacheMs) return value;
    if (this.cache.size >= 80) this.cache.delete(this.cache.keys().next().value);
    this.cache.set(key, { expires: Date.now() + this.cacheMs, value });
    return value;
  }

  async search(body = {}, signal) {
    const query = text(body.query).slice(0, MAX_QUERY).trim();
    const cursor = text(body.cursor).slice(0, 500);
    const limit = Math.max(1, Math.min(MAX_LIMIT, Number(body.limit) || 20));
    const key = ['search', query, cursor, limit].join('\u0000');
    const hit = this.cached(key);
    if (hit) return hit;
    const url = new URL('/v0/servers', this.baseUrl);
    url.searchParams.set('version', 'latest');
    url.searchParams.set('limit', String(limit));
    if (query) url.searchParams.set('search', query);
    if (cursor) url.searchParams.set('cursor', cursor);
    const payload = await this.request(url, signal);
    const items = (Array.isArray(payload?.servers) ? payload.servers : [])
      .filter(entry => entry && isObject(entry.server))
      .filter(entry => {
        const status = entry._meta?.['io.modelcontextprotocol.registry/official']?.status;
        return !status || status === 'active';
      })
      .map(entry => summary(entry.server, entry._meta));
    return this.remember(key, { query, items, nextCursor: text(payload?.metadata?.nextCursor) || null, count: items.length });
  }

  async detail(body = {}, signal) {
    const name = text(body.name).trim();
    if (!name || name.length > 200) fail('REQUEST_INVALID', '缺少要查看的服务名称');
    const key = 'detail\u0000' + name;
    const hit = this.cached(key);
    if (hit) return hit;
    const url = new URL('/v0/servers/' + encodeURIComponent(name) + '/versions/latest', this.baseUrl);
    const payload = await this.request(url, signal);
    const server = payload?.server;
    if (!isObject(server)) fail('CATALOG_INVALID', '官方 MCP 目录没有返回这个服务');
    return this.remember(key, { item: summary(server, payload?._meta), install: installOptions(server), raw: server });
  }
}

export function createCatalog(options) { return new CatalogClient(options); }