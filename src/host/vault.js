import { isSecretKey, isSensitiveValue, MASK } from '../shared/display.js';
import { fail } from '../shared/errors.js';

/**
 * Credential vault: every secret the user pastes (plain text, `${env:X}`,
 * `${X}`) is stored through the Host credential service and the configuration
 * keeps only `${credential:MCPHUB_*}`.
 *
 * Naming and ownership:
 * - generated names start with MCPHUB_ and never overwrite a name owned by
 *   another server; a conflict gets a numeric suffix instead;
 * - a name referenced only by the server being saved may be rotated in place;
 * - an existing `${credential:X}` reference is kept untouched (the user chose
 *   that name, possibly shared with another plugin).
 */
export const VAULT_PREFIX = 'MCPHUB_';
export const MAX_NAME_LENGTH = 64;
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const TEMPLATE = /\$\{credential:([A-Za-z_][A-Za-z0-9_]*)\}/g;
const TEMPLATE_EXACT = /^\$\{credential:[A-Za-z_][A-Za-z0-9_]*\}$/;
const TEMPLATE_ANY = /\$\{credential:[A-Za-z_][A-Za-z0-9_]*\}/;
const ENV_REF = /^(Bearer\s+)?(?:\$\{(?:env:)?([A-Za-z_][A-Za-z0-9_]*)\}|\{env:([A-Za-z_][A-Za-z0-9_]*)\})$/i;
const INLINE_AUTH = /^(Bearer|Basic|Token)\s+(\S+)$/i;
/** Well-known token shapes; they are secrets even under an innocuous key name. */
const SECRET_SHAPE = /^(?:sk-|pk-|rk-|gh[pousr]_|github_pat_|[gl]hp_|xox[baprs]-|AKIA[0-9A-Z]{12,}|ey[A-Za-z0-9_-]{8,}\.)/;
const SECRET_FLAG = /(?:^|[-_])(?:api[-_]?key|key|token|password|passwd|secret|authorization|credential|access[-_]?key|private[-_]?key|client[-_]?secret)(?:$|[-_])/i;

export const isCredentialTemplate = value => typeof value === 'string' && TEMPLATE_EXACT.test(value);
export const credentialNames = entry => [...new Set([...JSON.stringify(entry ?? {}).matchAll(TEMPLATE)].map(match => match[1]))];

/** A value that is very unlikely to be ordinary configuration. */
export function looksLikeSecret(value) {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  if (!text || /\s/.test(text)) return false;
  if (SECRET_SHAPE.test(text)) return true;
  // A long unbroken token usually carries both letters and digits; ENV values
  // such as paths or feature flags do not.
  return text.length >= 24 && /[A-Za-z]/.test(text) && /[0-9]/.test(text);
}

const plain = value => typeof value === 'string' && value !== '' && !TEMPLATE_EXACT.test(value) && !value.includes(MASK);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** `MCPHUB_GITHUB_COM_TOKEN` style part: uppercase, POSIX-safe, never empty. */
export function namePart(value) {
  const text = String(value ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!text) return 'SECRET';
  return /^[0-9]/.test(text) ? '_' + text : text;
}

const FIELD_ALIASES = { authorization: 'TOKEN', 'x-api-key': 'API_KEY', 'x-auth-token': 'TOKEN', 'api-key': 'API_KEY' };

export function defaultName(server, key) {
  const field = namePart(FIELD_ALIASES[String(key).toLowerCase()] ?? key);
  const suffix = '_' + field;
  const room = MAX_NAME_LENGTH - VAULT_PREFIX.length - suffix.length;
  const serverPart = namePart(server).slice(0, Math.max(1, room));
  // Environment variables such as AMAP_MAPS_API_KEY already name their app; do
  // not repeat the server name inside the generated credential name.
  if (field === serverPart || field.startsWith(serverPart + '_')) return clip(VAULT_PREFIX + field);
  return clip(VAULT_PREFIX + serverPart + suffix);
}

/** A name derived from an environment variable the configuration referenced. */
export function envName(key) {
  return clip(VAULT_PREFIX + namePart(key));
}

function clip(name) {
  if (name.length <= MAX_NAME_LENGTH) return name;
  const trimmed = name.slice(0, MAX_NAME_LENGTH).replace(/_+$/, '');
  return NAME.test(trimmed) ? trimmed : name.slice(0, MAX_NAME_LENGTH - 1) + 'X';
}

/** One site inside an entry, with a setter that writes the credential template back. */
function collectSites(entry) {
  const sites = [];
  const add = site => sites.push(site);
  const env = object(entry.env) ? entry.env : {};
  for (const [key, value] of Object.entries(env)) {
    if (!plain(value) || TEMPLATE_ANY.test(value)) continue;
    const reference = value.match(ENV_REF);
    if (reference) {
      const refName = reference[2] ?? reference[3];
      add({ field: 'env', key, kind: 'env', refName, prefix: reference[1] ?? '', value: undefined, set: token => { entry.env[key] = (reference[1] ?? '') + token; } });
      continue;
    }
    const inline = value.match(INLINE_AUTH);
    if (inline && !isCredentialTemplate(inline[2])) {
      add({ field: 'env', key, kind: 'literal', prefix: inline[1] + ' ', value: inline[2], set: token => { entry.env[key] = inline[1] + ' ' + token; } });
      continue;
    }
    if (isSecretKey(key) || isSensitiveValue(value) || SECRET_SHAPE.test(value)) {
      add({ field: 'env', key, kind: 'literal', prefix: '', value, set: token => { entry.env[key] = token; } });
    }
  }
  const headers = object(entry.headers) ? entry.headers : {};
  for (const [key, value] of Object.entries(headers)) {
    if (!plain(value) || TEMPLATE_ANY.test(value)) continue;
    const reference = value.match(ENV_REF);
    if (reference) {
      const refName = reference[2] ?? reference[3];
      add({ field: 'headers', key, kind: 'env', refName, prefix: reference[1] ?? '', value: undefined, set: token => { entry.headers[key] = (reference[1] ?? '') + token; } });
      continue;
    }
    const inline = value.match(INLINE_AUTH);
    if (inline && !isCredentialTemplate(inline[2])) {
      add({ field: 'headers', key, kind: 'literal', prefix: inline[1] + ' ', value: inline[2], set: token => { entry.headers[key] = inline[1] + ' ' + token; } });
      continue;
    }
    if (isSecretKey(key) || isSensitiveValue(value) || looksLikeSecret(value)) {
      add({ field: 'headers', key, kind: 'literal', prefix: '', value, set: token => { entry.headers[key] = token; } });
    }
  }
  if (Array.isArray(entry.args)) {
    entry.args.forEach((arg, index) => {
      if (!plain(arg) || TEMPLATE_ANY.test(arg)) return;
      if (/^https?:\/\//i.test(arg)) return urlSites(arg, value => { entry.args[index] = value; }, add, index);
      const inline = arg.match(INLINE_AUTH);
      if (inline && !isCredentialTemplate(inline[2])) {
        add({ field: 'args', key: String(index), kind: 'literal', prefix: inline[1] + ' ', value: inline[2], set: token => { entry.args[index] = inline[1] + ' ' + token; } });
        return;
      }
      const equals = arg.indexOf('=');
      if (equals > 0) {
        const flag = arg.slice(0, equals);
        const value = arg.slice(equals + 1);
        if (value && (SECRET_FLAG.test(flag) || isSecretKey(flag) || looksLikeSecret(value))) {
          add({ field: 'args', key: flag, kind: 'literal', prefix: flag + '=', value, set: token => { entry.args[index] = flag + '=' + token; } });
        }
        return;
      }
      const header = arg.match(/^([A-Za-z][A-Za-z0-9-]*):\s*(\S+)$/);
      if (header && (isSecretKey(header[1]) || SECRET_SHAPE.test(header[2]))) {
        add({ field: 'args', key: header[1], kind: 'literal', prefix: header[1] + ': ', value: header[2], set: token => { entry.args[index] = header[1] + ': ' + token; } });
        return;
      }
      if (SECRET_FLAG.test(arg) && typeof entry.args[index + 1] === 'string' && plain(entry.args[index + 1])) {
        const next = index + 1;
        const value = entry.args[next];
        add({ field: 'args', key: arg, kind: 'literal', prefix: '', value, set: token => { entry.args[next] = token; } });
      }
    });
  }
  if (typeof entry.url === 'string' && entry.url) urlSites(entry.url, value => { entry.url = value; }, add, null);
  return sites;
  function urlSites(raw, write, sink, index) {
    if (TEMPLATE_ANY.test(raw)) return;
    let current = raw;
    const commit = mutate => { current = mutate(current); write(current); };
    const userinfo = raw.match(/^([a-z][a-z0-9+.-]*:\/\/)([^/@\s]+)@/i);
    if (userinfo) {
      const auth = userinfo[2];
      const colon = auth.indexOf(':');
      if (colon > 0) {
        const password = auth.slice(colon + 1);
        if (plain(password)) {
          sink({ field: 'url', key: 'password', kind: 'literal', prefix: '', value: password, set: token => commit(text => text.replace(userinfo[0], userinfo[1] + auth.slice(0, colon + 1) + token + '@')) });
        }
      }
    }
    for (const match of raw.matchAll(/([?&])([^=&#\s]+)=([^&#\s]*)/g)) {
      const key = match[2];
      const value = match[3];
      if (!value || !plain(value)) continue;
      if (!(isSecretKey(key) || looksLikeSecret(value))) continue;
      const literal = match[0];
      sink({ field: 'url', key, kind: 'literal', prefix: '', value, set: token => commit(text => {
        const at = text.indexOf(literal);
        return at < 0 ? text : text.slice(0, at) + match[1] + key + '=' + token + text.slice(at + literal.length);
      }) });
    }
  }
}

/** server → Set of names it references, from every stored (and inherited) entry. */
export function credentialOwners(servers = {}, base = {}) {
  const owners = new Map();
  for (const [server, entry] of [...Object.entries(base ?? {}), ...Object.entries(servers ?? {})]) {
    for (const name of credentialNames(entry)) {
      if (!owners.has(name)) owners.set(name, new Set());
      owners.get(name).add(server);
    }
  }
  return owners;
}

/**
 * Turn every plain secret in `entry` into a credential write plus a template.
 * Nothing is written here: `commit` performs the writes so the caller can run
 * preflight first and roll back when the configuration write fails.
 */
export async function planCredentials(entry, { server, env = {}, provider, owners = new Map(), aliases = [] }) {
  const planned = structuredClone(entry);
  const sites = collectSites(planned);
  if (!sites.length) return { entry: planned, writes: [], stored: [], missing: [], reused: [] };
  if (!provider?.set || !provider?.describe) {
    fail('CREDENTIAL_UNAVAILABLE', '当前 DSH 没有挂载凭证服务，无法保存密钥。请先启用 DSH 凭证服务后重试');
  }
  const assigned = new Map();
  const writes = [];
  const stored = [];
  const missing = [];
  const reused = [];
  for (const site of sites) {
    let base;
    let value;
    if (site.kind === 'env') {
      value = await lookupEnvValue(site.refName, env, provider);
      if (!value) { missing.push(site.refName); continue; }
      base = envName(site.refName);
    } else {
      base = defaultName(server, site.key);
      value = site.value;
    }
    const { name, mode } = await allocate(base);
    if (mode) {
      writes.push({ name, value, mode });
      stored.push({ name, field: site.field, key: site.key, mode });
    } else {
      reused.push({ name, field: site.field, key: site.key });
    }
    // Each setter keeps the surrounding text (a scheme, `--flag=`, `Header: `)
    // and only replaces the secret itself.
    site.set('${credential:' + name + '}');
  }
  return { entry: planned, writes, stored, missing, reused };

  async function lookupEnvValue(name, ambient, credentials) {
    const fromEnv = ambient?.[name];
    if (typeof fromEnv === 'string' && fromEnv !== '') return fromEnv;
    try {
      const stored = await credentials.resolve(name);
      return typeof stored?.value === 'string' && stored.value !== '' ? stored.value : undefined;
    } catch { return undefined; }
  }

  async function allocate(base) {
    for (let index = 1; index <= 50; index += 1) {
      const name = index === 1 ? base : clip(base + '_' + index);
      if (!NAME.test(name)) fail('CREDENTIAL_NAME_INVALID', '无法生成合法的凭证名称：' + name);
      if (assigned.has(name)) return { name, mode: undefined };
      // Name ownership comes first: a name already used by another server must
      // never be written to, even when its value is not configured yet.
      const holders = owners.get(name) ?? new Set();
      const mine = holders.has(server) || aliases.some(alias => holders.has(alias));
      const strangers = [...holders].filter(holder => holder !== server && !aliases.includes(holder));
      if (strangers.length) continue;
      let info;
      try { info = await provider.describe(name); } catch { info = undefined; }
      if (!info?.configured) {
        assigned.set(name, 'create');
        return { name, mode: 'create' };
      }
      if (mine) {
        assigned.set(name, 'rotate');
        return { name, mode: 'rotate' };
      }
      // A value already in the store that this service does not own: keep it and
      // pick the next free suffix instead of overwriting someone else's secret.
    }
    fail('CREDENTIAL_NAME_CONFLICT', '无法为密钥分配不冲突的凭证名称：' + base);
  }
}

/** Perform planned credential writes; caller owns the returned rollback. */
export async function commitCredentials(provider, writes) {
  const undo = [];
  for (const write of writes) {
    try {
      if (write.mode === 'rotate') {
        const previous = await provider.resolve(write.name);
        await provider.set(write.name, write.value);
        undo.push(previous?.value === undefined ? { op: 'unset', name: write.name } : { op: 'set', name: write.name, value: previous.value });
      } else {
        await provider.set(write.name, write.value);
        undo.push({ op: 'unset', name: write.name });
      }
    } catch (error) {
      await rollbackCredentials(provider, undo);
      throw error;
    }
  }
  return rollbackCredentials.bind(null, provider, undo);
}

async function rollbackCredentials(provider, undo) {
  for (const step of [...undo].reverse()) {
    try { await (step.op === 'unset' ? provider.unset(step.name) : provider.set(step.name, step.value)); } catch { /* best effort */ }
  }
}

/** Resolve every `${credential:…}` back to its value for a secret-bearing export. */
export async function inlineCredentials(value, provider) {
  const missing = new Set();
  const walk = async input => {
    if (typeof input === 'string') {
      let out = '';
      let cursor = 0;
      for (const match of input.matchAll(TEMPLATE)) {
        let resolved;
        try { resolved = await provider.resolve(match[1]); } catch { resolved = undefined; }
        if (typeof resolved?.value !== 'string') { missing.add(match[1]); out += input.slice(cursor, match.index + match[0].length); }
        else out += input.slice(cursor, match.index) + resolved.value;
        cursor = match.index + match[0].length;
      }
      return out + input.slice(cursor);
    }
    if (Array.isArray(input)) return Promise.all(input.map(walk));
    if (object(input)) return Object.fromEntries(await Promise.all(Object.entries(input).map(async ([key, item]) => [key, await walk(item)])));
    return input;
  };
  return { entry: await walk(value), missing: [...missing] };
}