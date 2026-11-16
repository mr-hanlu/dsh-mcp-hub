import { MASK } from './display.js';

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const masked = value => typeof value === 'string' && value.includes(MASK);
/**
 * Placeholders stand in for values that were never exported, so a restore is
 * visibly incomplete. They must not look like a `${…}` template: the import
 * path would read that as an unresolved variable and refuse the save without
 * pointing at the field.
 */
export const OMITTED_ARG = '（凭据已省略，请重新填写）';

/**
 * Build a restorable backup of the listed servers without any secret material.
 * Masked values appear in env, headers, args and the URL alike; leaving a mask in
 * the file would restore a literal `••••••••` into the next installation.
 * @param servers - rows from the Host list view.
 * @returns the backup map plus a human-readable list of omitted fields.
 */
export function buildBackup(servers = []) {
  const backup = {};
  const omitted = [];
  for (const server of servers) {
    if (!server?.entry) continue;
    const entry = structuredClone(server.entry);
    for (const field of ['env', 'headers']) {
      if (!isPlainObject(entry[field])) continue;
      for (const [key, value] of Object.entries(entry[field])) {
        if (!masked(value)) continue;
        omitted.push(server.name + ' ' + field + '.' + key);
        delete entry[field][key];
      }
    }
    if (Array.isArray(entry.args)) {
      entry.args = entry.args.map((arg, index) => {
        if (!masked(arg)) return arg;
        omitted.push(server.name + ' args[' + index + ']');
        return OMITTED_ARG;
      });
    }
    if (masked(entry.url)) {
      // Drop only the masked parts and keep the rest of the address usable.
      let stripped;
      try {
        const url = new URL(entry.url);
        if (masked(url.username)) { url.username = ''; omitted.push(server.name + ' url 用户名'); }
        if (masked(url.password)) { url.password = ''; omitted.push(server.name + ' url 密码'); }
        for (const key of [...url.searchParams.keys()]) {
          if (!masked(url.searchParams.get(key))) continue;
          url.searchParams.delete(key);
          omitted.push(server.name + ' url?' + key);
        }
        stripped = url.toString();
      } catch { stripped = ''; omitted.push(server.name + ' url'); }
      entry.url = stripped;
    }
    backup[server.name] = entry;
  }
  return { backup, omitted };
}