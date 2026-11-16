import { parseDocument, extract, assertEntryShape } from '../shared/mcp-config.js';
export { parseDocument, normalize, extract, assertEntryShape } from '../shared/mcp-config.js';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { access, readFile, stat } from 'node:fs/promises';
import { constants } from 'node:fs';

export { MASK, redact, redactArgs, restoreMasked, isReference } from '../shared/display.js';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const SOURCES = [
  { id: 'codex', name: 'Codex', paths: ['.codex/config.toml'] },
  { id: 'claude', name: 'Claude Code', paths: ['.claude.json'] },
  { id: 'opencode', name: 'OpenCode', paths: ['.config/opencode/opencode.json', '.config/opencode/opencode.jsonc'] },
  { id: 'cursor', name: 'Cursor', paths: ['.cursor/mcp.json'] },
];


export function fingerprint(entry) {
  const sorted = value => Array.isArray(value) ? value.map(sorted) : object(value) ? Object.fromEntries(Object.keys(value).sort().map(k => [k, sorted(value[k])])) : value;
  const { enabled, ...identity } = entry;
  return createHash('sha256').update(JSON.stringify(sorted(identity))).digest('hex');
}

export function connectionFingerprint(entry) {
  if (entry.transport === 'stdio') return fingerprint({ transport: 'stdio', command: entry.command, args: entry.args ?? [], cwd: entry.cwd ?? '', env: entry.env ?? {} });
  let url = entry.url;
  try { url = new URL(url).toString(); } catch {}
  return fingerprint({ transport: entry.transport, url, headers: Object.fromEntries(Object.entries(entry.headers ?? {}).map(([key,value]) => [key.toLowerCase(),value])) });
}

// Compare requested fields against an effective config that may include schema defaults.
export function includesConfig(actual, requested) {
  if (Array.isArray(requested)) return Array.isArray(actual) && actual.length === requested.length && requested.every((value, index) => includesConfig(actual[index], value));
  if (object(requested)) return object(actual) && Object.entries(requested).every(([key, value]) => Object.hasOwn(actual, key) && includesConfig(actual[key], value));
  return actual === requested;
}


export function variableInfo(entry, ambient = process.env) {
  return ['env','headers'].flatMap(field => Object.entries(entry[field] ?? {}).map(([key,value]) => {
    const refs = [...value.matchAll(/\$\{([^}]+)\}|\{env:([^}]+)\}/g)].map(match => match[1] ?? 'env:' + match[2]);
    const missing = refs.filter(ref => !ref.startsWith('credential:') && !ambient[ref.replace(/^env:/,'')]);
    const credentials = refs.filter(ref => ref.startsWith('credential:'));
    return { field, key, kind: credentials.length ? '凭证引用' : refs.length ? '环境引用' : '直接填写', state: missing.length ? 'missing' : credentials.length ? 'credential' : value === '' ? 'empty' : 'configured', references: refs, missing };
  }));
}

export async function scanSources({ home, env = process.env, read = readFile } = {}) {
  return Promise.all(SOURCES.map(async source => {
    const paths = source.paths.map(path => join(home, path));
    if (source.id === 'codex' && env.CODEX_HOME) paths.unshift(join(env.CODEX_HOME, 'config.toml'));
    if (source.id === 'opencode' && env.XDG_CONFIG_HOME) paths.unshift(join(env.XDG_CONFIG_HOME, 'opencode/opencode.json'), join(env.XDG_CONFIG_HOME, 'opencode/opencode.jsonc'));
    if (source.id === 'opencode' && env.OPENCODE_CONFIG) paths.unshift(resolve(env.OPENCODE_CONFIG));
    const files = [];
    const candidates = [];
    for (const path of [...new Set(paths)]) {
      try {
        const text = await read(path, 'utf8');
        const rows = extract(parseDocument(text, path));
        files.push({ path, state: 'read', count: rows.length });
        for (const row of rows) candidates.push({ ...row, id: createHash('sha256').update(path + '\0' + row.name).digest('hex'), source: source.name, sourcePath: path });
      } catch (error) {
        files.push({ path, state: error.code === 'ENOENT' ? 'missing' : 'error', error: error.code === 'ENOENT' ? undefined : '无法读取或解析配置，请检查格式和文件权限' });
      }
    }
    return { id: source.id, name: source.name, files, candidates };
  }));
}

export function resolveReferences(entry, ambient = process.env) {
  const unresolved = new Set();
  function walk(value) {
    if (typeof value === 'string') return value.replace(/\$\{([^}]+)\}|\{env:([^}]+)\}/g, (match, inner, opencode) => {
      const reference = inner ?? 'env:' + opencode;
      if (reference.startsWith('credential:')) return match; // Official provider resolves it during startup.
      const key = reference.startsWith('env:') ? reference.slice(4) : reference;
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || ambient[key] === undefined || ambient[key] === '') { unresolved.add(key); return match; }
      return ambient[key];
    });
    if (Array.isArray(value)) return value.map(walk);
    if (object(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walk(item)]));
    return value;
  }
  return { entry: walk(entry), unresolved: [...unresolved] };
}

export async function preflight(name, input, { env = process.env, home, checkAccess = access, checkStat = stat } = {}) {
  assertEntryShape(input);
  const checks = [];
  const add = (label, ok, detail) => checks.push({ label, ok, detail });
  add('配置名称', /^[A-Za-z0-9_-]{1,32}$/.test(name), '使用 1–32 位字母、数字、下划线或连字符');
  const resolved = resolveReferences(input, env);
  const entry = resolved.entry;
  add('变量引用', !resolved.unresolved.length, resolved.unresolved.length ? '缺少变量：' + resolved.unresolved.join('、') : '引用已解析；凭证引用将在正式连接时验证');
  const invalidKeys = ['env','headers'].flatMap(field => Object.keys(entry[field] ?? {}).filter(key => !(field === 'env' ? /^[A-Za-z_][A-Za-z0-9_]*$/ : /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/).test(key)));
  const emptySecrets = ['env','headers'].flatMap(field => Object.entries(entry[field] ?? {}).filter(([key,value]) => value === '' && (field === 'headers' || /token|secret|password|api_?key/i.test(key))).map(([key])=>key));
  add('环境变量与请求头', !invalidKeys.length && !emptySecrets.length, invalidKeys.length ? '名称无效：' + invalidKeys.join('、') : emptySecrets.length ? '请填写：' + emptySecrets.join('、') : '配置有效');
  if (entry.transport === 'stdio') {
    let cwd = entry.cwd || process.cwd();
    if (cwd.startsWith('~/') && home) cwd = join(home, cwd.slice(2));
    entry.cwd = resolve(cwd);
    let cwdOk = false;
    try { cwdOk = (await checkStat(entry.cwd)).isDirectory(); } catch {}
    add('工作目录', cwdOk, cwdOk ? entry.cwd : '目录不存在或不可访问');
    const validCommand = typeof entry.command === 'string' && !!entry.command.trim();
    if (validCommand && entry.command.startsWith('~/') && home) entry.command = join(home, entry.command.slice(2));
    if (validCommand && /[\\/]/.test(entry.command) && !isAbsolute(entry.command)) entry.command = resolve(entry.cwd, entry.command);
    let executable;
    if (validCommand && !entry.command.includes('${credential:')) {
      const paths = isAbsolute(entry.command) ? [entry.command] : (entry.env?.PATH ?? env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':').map(path => join(path, entry.command));
      for (const path of paths) { try { await checkAccess(path, constants.X_OK); if ((await checkStat(path)).isFile()) { executable = path; break; } } catch {} }
    }
    const deferred = validCommand && entry.command.includes('${credential:');
    add('启动命令', !!executable || deferred, deferred ? '凭证将在正式启动时解析' : executable || 'DSH 的 PATH 中找不到可执行命令，请填写绝对路径');
    if (executable) entry.command = executable;
    add('启动参数', Array.isArray(entry.args ?? []) && (entry.args ?? []).every(v => typeof v === 'string'), '参数按数组传递，不使用 Shell 拼接');
    const relativeArgs = (entry.args ?? []).some(value => typeof value === 'string' && (/^\.{1,2}[\\/]/.test(value) || /^[^/@-][^:]*\.(m?js|cjs|py|sh|ts)$/.test(value)));
    if (relativeArgs && !input.cwd) add('相对路径', false, '参数包含相对文件路径，请明确填写工作目录后重试');
  } else if (entry.transport === 'streamable-http') {
    let valid = false;
    try { valid = ['http:', 'https:'].includes(new URL(entry.url).protocol); } catch {}
    add('服务地址', valid, valid ? 'HTTP 地址有效，认证将在连接时验证' : '请填写有效的 HTTP / HTTPS 地址');
  } else add('传输方式', false, '当前仅支持 stdio 和 Streamable HTTP');
  for (const field of ['startupTimeoutMs', 'toolCallTimeoutMs']) if (entry[field] !== undefined) add('超时设置', Number.isFinite(entry[field]) && entry[field] > 0 && entry[field] <= 120000, '超时需在 1–120000 毫秒之间');
  return { ok: checks.every(check => check.ok), checks, entry, variables: variableInfo(input, env) };
}
