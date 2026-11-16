export const MASK = '••••••••';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function redact(entry) {
  const result = structuredClone(entry);
  for (const field of ['env', 'headers']) {
    if (object(result[field])) result[field] = Object.fromEntries(Object.entries(result[field]).map(([key, value]) => [key, isReference(value) || value === '' ? value : MASK]));
  }
  // URLs can embed both credentials and API keys in their query string.
  if (typeof result.url === 'string') {
    try {
      const url = new URL(result.url);
      if (url.username) url.username = MASK;
      if (url.password) url.password = MASK;
      for (const key of [...url.searchParams.keys()]) url.searchParams.set(key, MASK);
      if (url.hash) url.hash = MASK;
      result.url = url.toString().replaceAll(encodeURIComponent(MASK), MASK);
    } catch { result.url = ''; }
  }
  // Ordinary command arguments are configuration, not secrets.
  if (result.args) result.args = redactArgs(result.args);
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
    if (/^(?:Authorization|X-Api-Key)\s*:/i.test(arg)) return arg.slice(0, arg.indexOf(':') + 1) + MASK;
    if (/^https?:\/\//i.test(arg)) return redact({url:arg}).url;
    return arg;
  });
}

export function restoreMasked(next, previous) {
  const visible = redact(previous);
  const restore = (value, old, masked) => {
    if (typeof value === 'string' && value.includes(MASK)) {
      if (typeof old !== 'string' || value !== masked) throw new Error('隐藏字段已修改，请填写完整新值，或重新读取原配置');
      return old;
    }
    if (Array.isArray(value)) return value.map((item, index) => restore(item, old?.[index], masked?.[index]));
    if (object(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, restore(item, old?.[key], masked?.[key])]));
    return value;
  };
  return restore(next, previous, visible);
}
