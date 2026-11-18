import { parse as parseToml } from 'smol-toml';
import { parse as parseJsonc } from 'jsonc-parser';
import { fail } from './errors.js';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value,key) => object(value) && Object.hasOwn(value,key);
export const DEFAULT_MAX_CONFIG_BYTES = 2 * 1024 * 1024;
const UNPARSED = '无法解析此服务器配置';

export function parseDocument(text, path, options = {}) {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_CONFIG_BYTES;
  // 按字节而不是字符计数，避免多字节内容绕过上限；TextEncoder 在浏览器与 Host 都可用。
  if (new TextEncoder().encode(text).length > maxBytes) fail('BODY_TOO_LARGE', `配置文件超过 ${Math.floor(maxBytes / 1024)} KB，请选择较小的配置文件`);
  if (typeof path === 'string' && path.endsWith('.toml')) {
    const result = parseToml(text);
    if (!object(result)) fail('CONFIG_INVALID', '配置文件不是有效的 TOML 对象');
    return result;
  }
  const errors = [];
  const result = parseJsonc(text, errors, { allowTrailingComma: true, disallowComments: false });
  if (errors.length || !object(result)) fail('CONFIG_INVALID', '配置文件不是有效的 JSON / JSONC 对象');
  return result;
}

/** Fields every entry may carry, regardless of transport. */
const COMMON_FIELDS = ['transport', 'type', 'enabled', 'disabled', 'startup_timeout_sec', 'tool_timeout_sec', 'startupTimeoutMs', 'toolCallTimeoutMs', 'closeTimeoutMs', 'reconnect'];
const STDIO_FIELDS = ['command', 'args', 'env', 'environment', 'env_vars', 'cwd'];
const HTTP_FIELDS = ['url', 'httpUrl', 'serverUrl', 'headers', 'http_headers', 'env_http_headers', 'bearer_token_env_var'];
const isEmptyValue = value => value === undefined || value === null || value === '' || (object(value) && Object.keys(value).length === 0);

export function normalize(name, raw) {
  if (!object(raw)) fail('CONFIG_INVALID', '服务器配置必须是对象');
  const issues = [];
  const entry = { enabled: raw.enabled !== false && raw.disabled !== true };
  const remoteUrl = raw.url ?? raw.httpUrl ?? raw.serverUrl;
  const transport = raw.transport ?? raw.type ?? (remoteUrl ? 'streamable-http' : 'stdio');
  if (['local', 'stdio'].includes(transport)) {
    entry.transport = 'stdio';
    entry.command = Array.isArray(raw.command) ? raw.command[0] : raw.command;
    entry.args = Array.isArray(raw.command) ? raw.command.slice(1) : raw.args ?? [];
    // Codex 的 `env_vars = ["NAME", …]` 意思是「从宿主环境转发这些变量」，
    // 不是普通未知字段：迁移成引用，值仍由环境/凭证服务在连接时提供。
    const forwarded = Array.isArray(raw.env_vars) ? raw.env_vars.filter(name => typeof name === 'string' && name) : [];
    if (raw.env_vars !== undefined && (!Array.isArray(raw.env_vars) || forwarded.length !== raw.env_vars.length)) issues.push('需要处理未迁移字段：env_vars');
    const forwardedEnv = Object.fromEntries(forwarded.map(name => [name, '${env:' + name + '}']));
    const explicitEnv = raw.env ?? raw.environment;
    // 形状不对的 env 要原样交给 assertEntryShape 报错，不能被展开成 {0:"…"} 悄悄接受。
    entry.env = explicitEnv === undefined || object(explicitEnv) ? { ...forwardedEnv, ...(explicitEnv ?? {}) } : explicitEnv;
    if (raw.cwd) entry.cwd = raw.cwd;
  } else if (['remote', 'http', 'streamable-http'].includes(transport)) {
    entry.transport = 'streamable-http';
    entry.url = remoteUrl;
    entry.headers = raw.headers ?? (raw.http_headers || {});
    if (raw.env_http_headers) {
      entry.headers = { ...entry.headers, ...Object.fromEntries(Object.entries(raw.env_http_headers).map(([k,v]) => [k, '${env:' + v + '}'])) };
    }
    if (raw.bearer_token_env_var) entry.headers = { ...entry.headers, Authorization: 'Bearer ${env:' + raw.bearer_token_env_var + '}' };
  } else {
    entry.transport = transport;
    issues.push('暂不支持此传输方式：' + transport);
  }
  // Transport-specific whitelists: a field belonging to the other transport must be
  // reported, not silently dropped (it would look like the import lost data).
  const ownFields = entry.transport === 'stdio' ? STDIO_FIELDS : HTTP_FIELDS;
  const foreign = entry.transport === 'stdio' ? HTTP_FIELDS : STDIO_FIELDS;
  const known = new Set([...COMMON_FIELDS, ...ownFields]);
  const unknown = Object.keys(raw).filter(key => !known.has(key) && !foreign.includes(key));
  const incompatible = Object.keys(raw).filter(key => foreign.includes(key) && !isEmptyValue(raw[key]));
  if (incompatible.length) issues.push('与当前连接方式不兼容（未迁移）：' + incompatible.join('、'));
  if (unknown.length) issues.push('需要处理未迁移字段：' + unknown.join('、'));
  if (raw.startup_timeout_sec !== undefined) entry.startupTimeoutMs = raw.startup_timeout_sec * 1000;
  if (raw.tool_timeout_sec !== undefined) entry.toolCallTimeoutMs = raw.tool_timeout_sec * 1000;
  // `timeout` has no agreed unit across clients (seconds in some, milliseconds in
  // others), so it stays a field the user must review instead of being written as ms.
  for (const field of ['startupTimeoutMs','toolCallTimeoutMs','closeTimeoutMs','reconnect']) if (raw[field] !== undefined) entry[field] = raw[field];
  assertEntryShape(entry);
  return { name, entry, issues };
}

export function assertEntryShape(entry) {
  if (!object(entry)) fail('CONFIG_INVALID', '配置必须是对象');
  for (const field of ['command','cwd','url','transport']) if (entry[field] !== undefined && typeof entry[field] !== 'string') fail('CONFIG_INVALID', '配置字段 ' + field + ' 必须是字符串');
  if (entry.args !== undefined && (!Array.isArray(entry.args) || entry.args.some(value => typeof value !== 'string'))) fail('CONFIG_INVALID', '配置字段 args 必须是字符串数组');
  for (const field of ['env','headers']) if (entry[field] !== undefined && (!object(entry[field]) || Object.values(entry[field]).some(value => typeof value !== 'string'))) fail('CONFIG_INVALID', '配置字段 ' + field + ' 必须是字符串键值对象');
}

function containerOf(document) {
  if (!object(document)) fail('CONFIG_INVALID', 'JSON 配置必须是对象');
  const present = key => own(document, key) && document[key] !== null ? document[key] : undefined;
  for (const key of ['mcp_servers','mcpServers','servers']) {
    const value = present(key);
    if (value !== undefined) return { container: value, prefix: [key] };
  }
  if (object(document.mcp) && document.mcp.servers !== null && document.mcp.servers !== undefined) {
    return { container: document.mcp.servers, prefix: ['mcp','servers'] };
  }
  if (present('mcp') !== undefined) return { container: document.mcp, prefix: ['mcp'] };
  const flat = Object.values(document).some(value => object(value) && ('command' in value || 'url' in value));
  return { container: flat ? document : {}, prefix: [] };
}

/**
 * Split a document into one row per service. A malformed service is kept as a row
 * with `invalid: true` instead of failing the whole document, so a pasted list can
 * be corrected field by field in the editor.
 */
export function extract(document) {
  const { container, prefix } = containerOf(document);
  // 实测 `~/.claude.json` 会写成 `"mcpServers": []`：那是「一个服务都没有」，
  // 按解析失败上报会让整个来源显示成「无法读取或解析配置」。
  if (Array.isArray(container) && !container.length) return [];
  if (!object(container)) fail('CONFIG_INVALID', '未找到有效的 MCP 配置列表');
  return Object.entries(container).map(([name, raw]) => {
    const path = [...prefix, name];
    try {
      const normalized = normalize(name, raw);
      return { ...normalized, raw, path };
    } catch (error) {
      return { name, entry: {}, raw, path, invalid: true, issues: [UNPARSED + (error?.message ? '：' + error.message : '')] };
    }
  });
}

export function parseEditorDocument(text, fallbackName = '', filename = 'paste.jsonc', options = {}) {
  return parseEditorObject(parseDocument(text, filename, options), fallbackName);
}

/** Normalize an already-parsed document; the file import path flattens containers first. */
export function parseEditorObject(document, fallbackName = '') {
  if (!object(document)) fail('CONFIG_INVALID', 'JSON 配置必须是对象');
  const direct = ['command','url','transport','type'].some(key => Object.hasOwn(document,key));
  let rows;
  if (direct) {
    const { name, serverName, ...raw } = document;
    const rowName = serverName ?? name ?? fallbackName;
    try {
      const normalized = normalize(rowName, raw);
      rows = [{ ...normalized, raw, path: [], direct: true }];
    } catch (error) {
      rows = [{ name: rowName, entry: {}, raw, path: [], direct: true, invalid: true, issues: [UNPARSED + (error?.message ? '：' + error.message : '')] }];
    }
  } else rows = extract(document);
  if (!rows.length) fail('CONFIG_INVALID', '未找到 MCP 服务。支持单个配置、{服务名: 配置} 或 mcpServers 格式');
  return rows;
}