import { parseDocument, extract, assertEntryShape } from '../shared/mcp-config.js';
export { parseDocument, normalize, extract, assertEntryShape } from '../shared/mcp-config.js';
import { createHash } from 'node:crypto';
import { isAbsolute, join, resolve } from 'node:path';
import { access, readFile, stat } from 'node:fs/promises';
import { constants } from 'node:fs';

export { MASK, redact, redactArgs, restoreMasked, isReference } from '../shared/display.js';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const REFERENCE = /\$\{([^}]+)\}|\{env:([^}]+)\}/g;
const KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const MAX_TIMEOUT_MS = 120000;
const MAX_SERVER_NAME = 32;
const macSupport = ({ home }) => join(home, 'Library/Application Support');
const appData = ({ home, env }) => env.APPDATA || join(home, 'AppData', 'Roaming');
const configHome = ({ home, env }) => env.XDG_CONFIG_HOME || join(home, '.config');
const desktopConfig = ({ home, env, platform }, app, file) => {
  if (platform === 'darwin') return [join(macSupport({ home }), app, file)];
  if (platform === 'win32') return [join(appData({ home, env }), app, file)];
  return [join(configHome({ home, env }), app, file)];
};
const vscodeUserPaths = ({ home, env, platform }) => {
  const dirs = platform === 'darwin'
    ? [join(macSupport({ home }), 'Code', 'User'), join(macSupport({ home }), 'Code - Insiders', 'User')]
    : platform === 'win32'
      ? [join(appData({ home, env }), 'Code', 'User'), join(appData({ home, env }), 'Code - Insiders', 'User')]
      : [join(configHome({ home, env }), 'Code', 'User'), join(configHome({ home, env }), 'Code - Insiders', 'User')];
  return [
    ...dirs.map(dir => join(dir, 'mcp.json')),
    join(home, '.vscode-server', 'data', 'User', 'mcp.json'),
    join(home, '.vscode-server-insiders', 'data', 'User', 'mcp.json'),
  ];
};
const opencodePaths = ({ home, env, platform }) => {
  const paths = [join(home, '.config', 'opencode', 'opencode.json'), join(home, '.config', 'opencode', 'opencode.jsonc')];
  if (env.XDG_CONFIG_HOME) paths.unshift(join(env.XDG_CONFIG_HOME, 'opencode', 'opencode.json'), join(env.XDG_CONFIG_HOME, 'opencode', 'opencode.jsonc'));
  if (env.OPENCODE_CONFIG) paths.unshift(resolve(env.OPENCODE_CONFIG));
  if (platform === 'win32' && env.APPDATA) paths.push(join(env.APPDATA, 'opencode', 'opencode.json'), join(env.APPDATA, 'opencode', 'opencode.jsonc'));
  return paths;
};
const codexPaths = ({ home, env }) => env.CODEX_HOME ? [join(env.CODEX_HOME, 'config.toml'), join(home, '.codex', 'config.toml')] : [join(home, '.codex', 'config.toml')];
const geminiPaths = ({ home, env }) => [join(env.GEMINI_DIR || join(home, '.gemini'), 'settings.json')];

export const SOURCES = [
  { id: 'codex', name: 'Codex', paths: codexPaths },
  { id: 'claude', name: 'Claude Code', paths: ['.claude.json'] },
  { id: 'opencode', name: 'OpenCode', paths: opencodePaths },
  { id: 'cursor', name: 'Cursor', paths: ['.cursor/mcp.json'] },
  { id: 'claude-desktop', name: 'Claude Desktop', paths: ({ home, env, platform }) => desktopConfig({ home, env, platform }, 'Claude', 'claude_desktop_config.json') },
  { id: 'gemini', name: 'Gemini CLI', paths: geminiPaths },
  { id: 'vscode', name: 'VS Code / Copilot', paths: vscodeUserPaths },
  { id: 'copilot-cli', name: 'Copilot CLI', paths: ['.copilot/mcp-config.json'] },
  { id: 'windsurf', name: 'Windsurf', paths: ['.codeium/windsurf/mcp_config.json', '.codeium/windsurf-next/mcp_config.json'] },
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

/** Connection identity without credentials, used to recognize a backup entry whose secret fields were omitted. */
export function connectionSkeleton(entry) {
  if (entry.transport === 'stdio') return fingerprint({ transport: 'stdio', command: entry.command, args: entry.args ?? [], cwd: entry.cwd ?? '' });
  let url = entry.url;
  try { url = new URL(url).toString(); } catch {}
  return fingerprint({ transport: entry.transport, url });
}

// Compare requested fields against an effective config that may include schema defaults.
export function includesConfig(actual, requested) {
  if (Array.isArray(requested)) return Array.isArray(actual) && actual.length === requested.length && requested.every((value, index) => includesConfig(actual[index], value));
  if (object(requested)) return object(actual) && Object.entries(requested).every(([key, value]) => Object.hasOwn(actual, key) && includesConfig(actual[key], value));
  return actual === requested;
}

/** Environment-variable style references inside one entry, as declared by the source app. */
export function referenceNames(entry) {
  const names = new Set();
  for (const value of walkStrings(entry)) for (const match of value.matchAll(REFERENCE)) {
    const reference = match[1] ?? 'env:' + match[2];
    if (reference.startsWith('credential:')) continue;
    names.add(reference.startsWith('env:') ? reference.slice(4) : reference);
  }
  return [...names];
}

/** Human wording for the provider's layer names. */
const CREDENTIAL_SOURCE_LABEL = { file: 'DSH 凭证存储', env: '启动环境', 'project-env': '项目 .env', 'user-env': '$DSH_HOME/.env' };

function walkStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const item of value) walkStrings(item, out);
  else if (object(value)) for (const item of Object.values(value)) walkStrings(item, out);
  return out;
}

/**
 * @param entry - one parsed entry.
 * @param ambient - environment used only to report obviously unset names.
 * @param missingOverride - names already known to be unset, when the Host resolved them.
 * @param sources - credential descriptions keyed by name, for display only.
 */
export function variableInfo(entry, ambient = process.env, missingOverride, sources = {}) {
  const known = Array.isArray(missingOverride) ? new Set(missingOverride) : null;
  return ['env','headers'].flatMap(field => Object.entries(entry[field] ?? {}).map(([key,value]) => {
    const refs = [...value.matchAll(REFERENCE)].map(match => match[1] ?? 'env:' + match[2]);
    const nameOf = ref => ref.replace(/^env:/,'');
    const credentials = refs.filter(ref => ref.startsWith('credential:'));
    const missing = refs.filter(ref => {
      if (ref.startsWith('credential:')) return false;
      const name = nameOf(ref);
      if (known) return known.has(name);
      return !ambient[name];
    });
    const source = refs.map(nameOf).map(name => sources[name]?.source).filter(Boolean).map(name => CREDENTIAL_SOURCE_LABEL[name] ?? name)[0];
    // 缺哪个变量要报「名字」，不是带 `env:` 前缀的原始引用：检查结果里报的是名字，
    // 行内提示也必须是同一个，否则用户会以为要填一个叫 env:X 的变量。
    return { field, key, kind: credentials.length ? '凭证引用' : refs.length ? '环境引用' : '直接填写', state: missing.length ? 'missing' : credentials.length ? 'credential' : value === '' ? 'empty' : 'configured', references: refs, missing: missing.map(nameOf), source };
  }));
}

// 项目级配置：相对启动目录读取，仅用于发现，不写入来源应用。
export const PROJECT_SOURCES = [
  { id: 'project', name: '当前项目', paths: ['.mcp.json', '.cursor/mcp.json', '.vscode/mcp.json', '.gemini/settings.json', 'opencode.json', 'opencode.jsonc'] },
];

/**
 * `~/.claude.json` keeps user-scope servers at `mcpServers` and project-scope ones
 * under `projects.<dir>.mcpServers`. Only reading the top level silently dropped
 * every `claude mcp add -s project` server.
 * @returns the flattened document plus the project directory behind each added key.
 */
export function flattenClaudeProjects(document) {
  const scopes = new Map();
  if (!object(document) || !object(document.projects)) return { document, scopes };
  // Merge into whichever container `extract` will read, otherwise a file using
  // `mcp_servers` would hide every project-scoped entry.
  const container = object(document.mcp_servers) ? 'mcp_servers' : object(document.servers) ? 'servers' : 'mcpServers';
  const merged = object(document[container]) ? { ...document[container] } : {};
  let added = 0;
  for (const [dir, project] of Object.entries(document.projects)) {
    const servers = object(project) && object(project.mcpServers) ? project.mcpServers : null;
    if (!servers) continue;
    for (const [name, raw] of Object.entries(servers)) {
      let key = Object.hasOwn(merged, name) ? scopedName(name, dir) : name.slice(0, MAX_SERVER_NAME);
      for (let attempt = 2; Object.hasOwn(merged, key); attempt += 1) key = scopedName(name, dir, attempt);
      merged[key] = raw;
      scopes.set(key, dir);
      added += 1;
    }
  }
  if (!added) return { document, scopes };
  return { document: { ...document, [container]: merged }, scopes };
}

/** A short, name-legal hint for a project directory. */
function projectLabel(dir) {
  const base = String(dir).split(/[\\/]/).filter(Boolean).pop() ?? 'project';
  return base.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 16) || 'project';
}

/**
 * Keep the candidate name inside the official `[A-Za-z0-9_-]{1,32}` budget; a
 * longer key would pass the import list and then fail the hard name check on save.
 */
function scopedName(name, dir, attempt = 0) {
  const suffix = '-' + projectLabel(dir) + (attempt > 1 ? '-' + attempt : '');
  const room = Math.max(1, MAX_SERVER_NAME - suffix.length);
  return name.slice(0, room) + suffix.slice(0, MAX_SERVER_NAME - room);
}

export async function scanSources({ home, env = process.env, cwd, read = readFile, platform = process.platform } = {}) {
  const groups = [...SOURCES];
  if (cwd) groups.push(...PROJECT_SOURCES);
  return Promise.all(groups.map(async source => {
    const root = source.id === 'project' ? cwd : home;
    const context = { home, env, cwd, platform };
    const paths = typeof source.paths === 'function' ? source.paths(context) : source.paths.map(path => join(root, path));
    const files = [];
    const candidates = [];
    for (const path of [...new Set(paths)]) {
      try {
        const text = await read(path, 'utf8');
        const parsed = parseDocument(text, path);
        const { document, scopes } = source.id === 'claude' ? flattenClaudeProjects(parsed) : { document: parsed, scopes: new Map() };
        const rows = extract(document);
        files.push({ path, state: 'read', count: rows.length });
        for (const row of rows) candidates.push({ ...row, id: createHash('sha256').update(path + '\0' + row.name).digest('hex'), source: source.name, sourcePath: path, detail: scopes.get(row.name) });
      } catch (error) {
        files.push({ path, state: error.code === 'ENOENT' ? 'missing' : 'error', error: error.code === 'ENOENT' ? undefined : '无法读取或解析配置，请检查格式和文件权限' });
      }
    }
    return { id: source.id, name: source.name, files, candidates };
  }));
}

function walkReferences(entry, replace) {
  const walk = value => {
    if (typeof value === 'string') return value.replace(REFERENCE, replace);
    if (Array.isArray(value)) return value.map(walk);
    if (object(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walk(item)]));
    return value;
  };
  return walk(entry);
}

/**
 * 把来源应用的引用改写成 DSH 凭证模板，配置里不落明文。
 * `${NAME}`、`${env:NAME}`、`{env:NAME}` → `${credential:NAME}`；`${credential:NAME}` 原样保留。
 * 环境变量当前是否存在仍然检查，只是不再把值写进配置。
 */
export function planReferences(entry, ambient = process.env) {
  const unresolved = new Set();
  const planned = walkReferences(entry, (match, inner, opencode) => {
    const reference = inner ?? 'env:' + opencode;
    if (reference.startsWith('credential:')) {
      const name = reference.slice('credential:'.length);
      if (!KEY.test(name)) { unresolved.add(name); return match; }
      return '${credential:' + name + '}';
    }
    const key = reference.startsWith('env:') ? reference.slice(4) : reference;
    if (!KEY.test(key)) { unresolved.add(key); return match; }
    if (ambient[key] === undefined || ambient[key] === '') unresolved.add(key);
    return '${credential:' + key + '}';
  });
  return { entry: planned, unresolved: [...unresolved], references: referenceNames(entry) };
}

/** 仅用于一次性连接测试：把引用解析成真实值，不写入任何配置。 */
export function resolveReferences(entry, ambient = process.env) {
  const unresolved = new Set();
  const resolved = walkReferences(entry, (match, inner, opencode) => {
    const reference = inner ?? 'env:' + opencode;
    if (reference.startsWith('credential:')) return match; // Official provider resolves it during startup.
    const key = reference.startsWith('env:') ? reference.slice(4) : reference;
    if (!KEY.test(key) || ambient[key] === undefined || ambient[key] === '') { unresolved.add(key); return match; }
    return ambient[key];
  });
  return { entry: resolved, unresolved: [...unresolved], references: referenceNames(entry) };
}

/**
 * @param describeCredential - optional async credential lookup from the Host. An
 *   environment reference whose value lives in the DSH credential store (or a
 *   `.env` layer) is configured even though this process's environment is not.
 */
export async function preflight(name, input, { env = process.env, home, cwd, checkAccess = access, checkStat = stat, referenceStorage = 'template', describeCredential } = {}) {
  assertEntryShape(input);
  const checks = [];
  // hard 检查即使在「保存为停用」时也必须通过：它们决定条目本身是否合法。
  const add = (label, ok, detail, hard = false) => checks.push({ label, ok, detail, hard });
  add('配置名称', /^[A-Za-z0-9_-]{1,32}$/.test(name), '使用 1–32 位字母、数字、下划线或连字符', true);
  const resolved = referenceStorage === 'value' ? resolveReferences(input, env) : planReferences(input, env);
  const entry = resolved.entry;
  let missing = [...resolved.unresolved];
  const sources = {};
  if (describeCredential && missing.length) {
    const still = [];
    for (const key of missing) {
      let info;
      try { info = await describeCredential(key); } catch { info = undefined; }
      if (info?.configured) { sources[key] = info; continue; }
      still.push(key);
    }
    missing = still;
  }
  add('变量引用', !missing.length, missing.length ? '缺少变量：' + missing.join('、') : referenceStorage === 'value' ? '引用已解析；凭证引用将在正式连接时验证' : '将保存为 ${credential:…} 引用，由 DSH 凭证服务在连接时解析');
  const invalidKeys = ['env','headers'].flatMap(field => Object.keys(entry[field] ?? {}).filter(key => !(field === 'env' ? KEY : /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/).test(key)));
  const emptySecrets = ['env','headers'].flatMap(field => Object.entries(entry[field] ?? {}).filter(([key,value]) => value === '' && (field === 'headers' || /token|secret|password|api_?key/i.test(key))).map(([key])=>key));
  add('变量与请求头名称', !invalidKeys.length, invalidKeys.length ? '名称无效：' + invalidKeys.join('、') : '名称有效', true);
  add('密钥填写', !emptySecrets.length, emptySecrets.length ? '请填写：' + emptySecrets.join('、') : '没有必填项留空');
  if (entry.transport === 'stdio') {
    // A cwd the user did not declare is never written back: process.cwd() belongs to
    // the Host, not to the user's project, and pinning it would break the config on
    // another machine. It is only used to resolve and check the command.
    const declared = typeof entry.cwd === 'string' ? entry.cwd.trim() : '';
    const expanded = declared && declared.startsWith('~/') && home ? join(home, declared.slice(2)) : declared;
    const checkCwd = expanded ? resolve(expanded) : cwd ?? process.cwd();
    if (declared) entry.cwd = checkCwd;
    else delete entry.cwd;
    let cwdOk = true;
    if (declared) { try { cwdOk = (await checkStat(checkCwd)).isDirectory(); } catch { cwdOk = false; } }
    add('工作目录', cwdOk, declared ? (cwdOk ? checkCwd : '目录不存在或不可访问') : '未指定，由 DSH 决定');
    const validCommand = typeof entry.command === 'string' && !!entry.command.trim();
    if (validCommand && entry.command.startsWith('~/') && home) entry.command = join(home, entry.command.slice(2));
    if (validCommand && /[\\/]/.test(entry.command) && !isAbsolute(entry.command)) entry.command = resolve(checkCwd, entry.command);
    let executable;
    if (validCommand && !entry.command.includes('${credential:')) {
      const paths = isAbsolute(entry.command) ? [entry.command] : (entry.env?.PATH ?? env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':').map(path => join(path, entry.command));
      for (const path of paths) { try { await checkAccess(path, constants.X_OK); if ((await checkStat(path)).isFile()) { executable = path; break; } } catch {} }
    }
    const deferred = validCommand && entry.command.includes('${credential:');
    add('启动命令', !!executable || deferred, deferred ? '凭证将在正式启动时解析' : executable || 'DSH 的 PATH 中找不到可执行命令，请填写绝对路径');
    if (executable) entry.command = executable;
    add('启动参数', Array.isArray(entry.args ?? []) && (entry.args ?? []).every(v => typeof v === 'string'), '参数按数组传递，不使用 Shell 拼接', true);
    const relativeArgs = (entry.args ?? []).some(value => typeof value === 'string' && (/^\.{1,2}[\\/]/.test(value) || /^[^/@-][^:]*\.(m?js|cjs|py|sh|ts)$/.test(value)));
    if (relativeArgs && !declared) add('相对路径', false, '参数包含相对文件路径，请明确填写工作目录后重试');
  } else if (entry.transport === 'streamable-http') {
    let valid = false;
    try { valid = ['http:', 'https:'].includes(new URL(entry.url).protocol); } catch {}
    add('服务地址', valid, valid ? 'HTTP 地址有效，认证将在连接时验证' : '请填写有效的 HTTP / HTTPS 地址');
  } else add('传输方式', false, '当前仅支持 stdio 和 Streamable HTTP', true);
  for (const field of ['startupTimeoutMs', 'toolCallTimeoutMs']) if (entry[field] !== undefined) add('超时设置', Number.isFinite(entry[field]) && entry[field] > 0 && entry[field] <= MAX_TIMEOUT_MS, `超时需在 1–${MAX_TIMEOUT_MS} 毫秒之间`, true);
  return { ok: checks.every(check => check.ok), checks, entry, variables: variableInfo(input, env, missing, sources) };
}