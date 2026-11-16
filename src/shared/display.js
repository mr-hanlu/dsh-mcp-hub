import { fail } from './errors.js';

export const MASK = '••••••••';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * 键名分词后判断是否属于凭据类。按整词比较，避免 MONKEY、KEYBOARD 这类误判，
 * 同时能认 GITHUB_TOKEN、api_key、X-Api-Key、AUTHORIZATION 等常见写法。
 */
const SECRET_WORDS = new Set(['token', 'tokens', 'secret', 'secrets', 'passwd', 'password', 'pwd', 'apikey', 'key', 'keys', 'auth', 'authorization', 'credential', 'credentials', 'private', 'cookie', 'session', 'signature', 'salt', 'dsn', 'bearer']);
/** Long, unambiguous words that are also caught inside a run-together name such as PGPASSWORD. */
const SECRET_PARTS = ['password', 'passwd', 'secret', 'token', 'apikey', 'credential', 'authorization', 'bearer', 'cookie', 'signature'];
export function isSecretKey(key) {
  const lower = String(key).toLowerCase();
  if (lower.split(/[^a-z0-9]+/).some(part => SECRET_WORDS.has(part))) return true;
  return SECRET_PARTS.some(part => lower.includes(part));
}
/** A value that carries an inline credential scheme, e.g. `Bearer abc123`. */
const inlineAuth = /(?:\b(Bearer|Basic|Token)\s+)([^\s"']+)/i;

/** 值本身像凭据：带账号密码的 URL，或形如 JWT 的串。 */
export function isSensitiveValue(value) {
  return typeof value === 'string' && (/^[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s@]+@/i.test(value) || /^ey[A-Za-z0-9_-]{10,}\./.test(value));
}

const shouldHide = (key, value) => typeof value === 'string' && value !== '' && !isReference(value)
  && (isSecretKey(key) || isSensitiveValue(value) || inlineAuth.test(value));

export function redact(entry) {
  const result = structuredClone(entry);
  for (const field of ['env', 'headers']) {
    if (object(result[field])) result[field] = Object.fromEntries(Object.entries(result[field]).map(([key, value]) => [key, shouldHide(key, value) ? MASK : value]));
  }
  // URLs can embed passwords (userinfo) and API keys (query). Only mask those:
  // masking every query parameter hid `?version=1` and made the address unreadable.
  if (typeof result.url === 'string' && result.url) {
    try {
      const url = new URL(result.url);
      let masked = false;
      if (url.username) { url.username = MASK; masked = true; }
      if (url.password) { url.password = MASK; masked = true; }
      for (const key of [...url.searchParams.keys()]) {
        if (!isSecretKey(key)) continue;
        url.searchParams.set(key, MASK); masked = true;
      }
      // A fragment is opaque; only mask it when it looks like a credential.
      const hash = url.hash.slice(1);
      if (hash && isSensitiveValue(hash)) { url.hash = MASK; masked = true; }
      // Keep an untouched address byte-for-byte, and keep an unparseable one so the
      // user can see and fix what is actually stored.
      result.url = masked ? url.toString().replaceAll(encodeURIComponent(MASK), MASK) : result.url;
    } catch { /* keep the raw string: a broken URL is a diagnostic, not a secret */ }
  }
  // Ordinary command arguments are configuration, not secrets.
  if (Array.isArray(result.args)) result.args = redactArgs(result.args);
  return result;
}

export const isReference = value => typeof value === 'string' && /^(?:Bearer\s+)?(?:\$\{(?:env:|credential:)?[A-Za-z_][A-Za-z0-9_]*\}|\{env:[A-Za-z_][A-Za-z0-9_]*\})$/i.test(value);
const secretFlag = /(?:^|[-_])(?:api[-_]?key|key|token|password|passwd|secret|authorization|credential|access[-_]?key)(?:$|[-_])/i;
export function redactArgs(args) {
  let maskNext = false;
  return args.map(arg => {
    if (maskNext) { maskNext = false; return isReference(arg) ? arg : MASK; }
    const equals = arg.indexOf('=');
    const flag = equals < 0 ? arg : arg.slice(0, equals);
    if (arg.startsWith('-') && secretFlag.test(flag)) {
      if (equals >= 0) return flag + '=' + (isReference(arg.slice(equals + 1)) ? arg.slice(equals + 1) : MASK);
      maskNext = true; return arg;
    }
    // `password=hunter2` and `token: abc` carry the value without a leading dash.
    if (equals > 0 && isSecretKey(flag) && !/^https?:/i.test(arg)) {
      return flag + '=' + (isReference(arg.slice(equals + 1)) ? arg.slice(equals + 1) : MASK);
    }
    if (/^(?:Authorization|X-Api-Key)\s*:/i.test(arg)) return arg.slice(0, arg.indexOf(':') + 1) + MASK;
    // A whole curl-style argument can embed an inline credential scheme.
    if (inlineAuth.test(arg)) return arg.replace(inlineAuth, (match, scheme, token) => token === MASK || isReference(token) ? match : `${scheme} ${MASK}`);
    if (/^https?:\/\//i.test(arg)) return redact({url:arg}).url;
    return arg;
  });
}

export function restoreMasked(next, previous) {
  const visible = redact(previous);
  const restore = (value, old, masked) => {
    if (typeof value === 'string' && value.includes(MASK)) {
      if (typeof old !== 'string' || value !== masked) fail('HIDDEN_VALUE_CHANGED', '隐藏字段已修改，请填写完整新值，或重新读取原配置');
      return old;
    }
    if (Array.isArray(value)) return value.map((item, index) => restore(item, old?.[index], masked?.[index]));
    if (object(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, restore(item, old?.[key], masked?.[key])]));
    return value;
  };
  return restore(next, previous, visible);
}