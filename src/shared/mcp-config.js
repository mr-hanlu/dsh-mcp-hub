import { parse as parseToml } from 'smol-toml';
import { parse as parseJsonc } from 'jsonc-parser';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value,key) => object(value) && Object.hasOwn(value,key);

export function parseDocument(text, path) {
  if (text.length > 2 * 1024 * 1024) throw new Error('配置文件超过 2 MB，请选择较小的配置文件');
  if (path.endsWith('.toml')) return parseToml(text);
  const errors = [];
  const result = parseJsonc(text, errors, { allowTrailingComma: true, disallowComments: false });
  if (errors.length || !object(result)) throw new Error('配置文件不是有效的 JSON / JSONC 对象');
  return result;
}

export function normalize(name, raw) {
  if (!object(raw)) throw new Error('服务器配置必须是对象');
  const issues = [];
  const entry = { enabled: raw.enabled !== false && raw.disabled !== true };
  const transport = raw.transport ?? raw.type ?? (raw.url ? 'streamable-http' : 'stdio');
  if (['local', 'stdio'].includes(transport)) {
    entry.transport = 'stdio';
    entry.command = Array.isArray(raw.command) ? raw.command[0] : raw.command;
    entry.args = Array.isArray(raw.command) ? raw.command.slice(1) : raw.args ?? [];
    entry.env = raw.env ?? raw.environment ?? {};
    if (raw.cwd) entry.cwd = raw.cwd;
  } else if (['remote', 'http', 'streamable-http'].includes(transport)) {
    entry.transport = 'streamable-http';
    entry.url = raw.url;
    entry.headers = raw.headers ?? (raw.http_headers || {});
    if (raw.env_http_headers) {
      entry.headers = { ...entry.headers, ...Object.fromEntries(Object.entries(raw.env_http_headers).map(([k,v]) => [k, '${env:' + v + '}'])) };
    }
    if (raw.bearer_token_env_var) entry.headers = { ...entry.headers, Authorization: 'Bearer ${env:' + raw.bearer_token_env_var + '}' };
  } else {
    entry.transport = transport;
    issues.push('暂不支持此传输方式：' + transport);
  }
  const allowed = new Set(['transport', 'type', 'command', 'args', 'env', 'environment', 'cwd', 'url', 'headers', 'http_headers', 'env_http_headers', 'bearer_token_env_var', 'enabled', 'disabled', 'startup_timeout_sec', 'tool_timeout_sec', 'timeout', 'startupTimeoutMs', 'toolCallTimeoutMs', 'closeTimeoutMs', 'reconnect']);
  const unknown = Object.keys(raw).filter(key => !allowed.has(key));
  if (unknown.length) issues.push('需要处理未迁移字段：' + unknown.join('、'));
  if (raw.startup_timeout_sec !== undefined) entry.startupTimeoutMs = raw.startup_timeout_sec * 1000;
  if (raw.tool_timeout_sec !== undefined) entry.toolCallTimeoutMs = raw.tool_timeout_sec * 1000;
  if (raw.timeout !== undefined) entry.startupTimeoutMs = raw.timeout;
  for (const field of ['startupTimeoutMs','toolCallTimeoutMs','closeTimeoutMs','reconnect']) if (raw[field] !== undefined) entry[field] = raw[field];
  assertEntryShape(entry);
  return { name, entry, issues };
}

export function assertEntryShape(entry) {
  if (!object(entry)) throw new Error('配置必须是对象');
  for (const field of ['command','cwd','url','transport']) if (entry[field] !== undefined && typeof entry[field] !== 'string') throw new Error('配置字段 ' + field + ' 必须是字符串');
  if (entry.args !== undefined && (!Array.isArray(entry.args) || entry.args.some(value => typeof value !== 'string'))) throw new Error('配置字段 args 必须是字符串数组');
  for (const field of ['env','headers']) if (entry[field] !== undefined && (!object(entry[field]) || Object.values(entry[field]).some(value => typeof value !== 'string'))) throw new Error('配置字段 ' + field + ' 必须是字符串键值对象');
}

export function extract(document) {
  const container = document.mcp_servers ?? document.mcpServers ?? document.servers ?? (own(document.mcp, 'servers') ? document.mcp.servers : document.mcp) ?? (Object.values(document).some(value => object(value) && ('command' in value || 'url' in value)) ? document : {});
  if (!object(container)) throw new Error('未找到有效的 MCP 配置列表');
  return Object.entries(container).map(([name, raw]) => {
    try { return normalize(name, raw); }
    catch { return { name, entry: {}, issues: ['无法解析此服务器配置'] }; }
  });
}

export function parseEditorDocument(text, fallbackName = '', filename = 'paste.jsonc') {
  const document = parseDocument(text, filename);
  if (!object(document)) throw new Error('JSON 配置必须是对象');
  const direct = ['command','url','transport','type'].some(key => Object.hasOwn(document,key));
  let rows;
  if (direct) {
    const { name, serverName, ...raw } = document;
    rows = [normalize(serverName ?? name ?? fallbackName,raw)];
  } else rows = extract(document);
  if (!rows.length) throw new Error('未找到 MCP 服务。支持单个配置、{服务名: 配置} 或 mcpServers 格式');
  if (rows.some(row=>!row.entry.transport || row.issues.includes('无法解析此服务器配置'))) throw new Error('配置字段格式有误，请检查 command、args 和 env');
  return rows;
}
