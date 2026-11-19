import { hostname, homedir } from 'node:os';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { testConnection } from './probe.js';
import { parseEditorObject, parseDocument, DEFAULT_MAX_CONFIG_BYTES } from '../shared/mcp-config.js';
import { flattenClaudeProjects } from './config.js';
import { buildBackup } from '../shared/backup.js';
import { createCatalog } from './catalog.js';
import { fail } from '../shared/errors.js';
import { MASK, connectionFingerprint, connectionSkeleton, includesConfig, preflight, redact, restoreMasked, scanSources } from './config.js';
import { commitCredentials, credentialOwners, credentialNames, inlineCredentials, isCredentialTemplate, planCredentials } from './vault.js';

/** Chinese wording for the manager's terminal stop reasons. */
const REASON_TEXT = {
  load: '启动失败',
  cleanup: '清理未完成，需要重启 DSH',
  'gave-up': '重连预算已耗尽，工具已撤回',
  'reconnect-disabled': '重连已关闭，连接中断后不再恢复',
  'unclosed-generation': '上次连接未确认关闭，已阻止替换',
};
const STATUS_WITH_ERROR = ['failed', 'reconnecting', 'waiting-credentials'];
/**
 * 认证类失败的识别口径：DSH 的 MCP 客户端没有 needs-auth 状态，只把原因写进
 * `lastError`；这里按文本归类，认不出时保留原文，绝不假装是别的原因。
 */
const AUTH_FAILURE = /(?:^|\D)(?:401|403|unauthori[sz]ed|invalid[_ -]?token|authenticat)/i;
// 这些错误重试多少次也不会变：端口被禁用/地址不合法、域名不存在。客户端却会把它当
// 可重试错误一直重连到预算耗尽，验证界面只能显示「第 N 次重试」。
const DEAD_ENDPOINT = /bad port|ERR_INVALID_URL|Invalid URL|ENOTFOUND|EAI_NONAME/i;
const META_VERSION = 1;
const MAX_PERSISTED_VERIFICATIONS = 100;

/** An entry the official manager could accept; anything else is shown read-only. */
const validEntry = entry => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)
  && (entry.transport === 'stdio' || entry.transport === 'streamable-http');

/** Read an optional service without declaring it as a hard dependency. */
function serviceOf(ctx, name) {
  try { return typeof ctx.get === 'function' ? ctx.get(name) : ctx[name]; }
  catch { return undefined; }
}

const diagnostic = status => {
  if (typeof status?.lastError === 'string' && status.lastError) return status.lastError;
  if (typeof status?.reason === 'string') return REASON_TEXT[status.reason] ?? status.reason;
  return status?.state ?? '状态未知';
};

export class HubService {
  constructor(ctx, options = {}) {
    this.ctx = ctx;
    this.home = options.home ?? homedir();
    this.env = options.env ?? process.env;
    this.waitMs = options.waitMs ?? 45000;
    this.intervalMs = options.intervalMs ?? 1000;
    this.maxConfigBytes = options.maxConfigBytes ?? DEFAULT_MAX_CONFIG_BYTES;
    // Every secret is stored through the credential service now; the legacy
    // `value` mode would write it back into the configuration, so it is ignored.
    this.referenceStorage = 'template';
    this.probeTimeoutMs = options.probeTimeoutMs ?? 20000;
    this.descriptorTtlMs = options.descriptorTtlMs ?? 1500;
    this.catalog = options.catalog ?? createCatalog({
      baseUrl: options.catalogBaseUrl,
      timeoutMs: options.catalogTimeoutMs,
      cacheMs: options.catalogCacheMs,
    });
    this.origins = Object.create(null);
    this.lastVerifications = Object.create(null);
    this.candidates = new Map();
    this.sourceGroups = [];
    this.verifications = new Map();
    this.importBatches = new Map();
    this.statusWatchers = new Set();
    this.verificationTimer = null;
    this.waiters = new Set();
    this.tail = Promise.resolve();
    this.metaTail = Promise.resolve();
    this.version = 1;
    this.closed = false;
    this.probeLifetime = new AbortController();
    const profile = options.profile ?? serviceOf(ctx, 'profileContext');
    this.profile = profile;
    this.metaPath = options.metaPath ?? (profile?.home ? join(profile.home, 'mcp-hub', profile.name, 'sources.json') : null);
    this.cwd = options.cwd ?? profile?.cwd ?? process.cwd();
  }
  async init() {
    if (this.metaPath) {
      try {
        const parsed = JSON.parse(await readFile(this.metaPath, 'utf8'));
        if (parsed && typeof parsed === 'object') {
          if (Number.isInteger(parsed.version) && parsed.origins && typeof parsed.origins === 'object') {
            this.origins = Object.assign(Object.create(null), parsed.origins);
            this.lastVerifications = Object.assign(Object.create(null), parsed.verifications ?? {});
          } else this.origins = Object.assign(Object.create(null), parsed); // legacy: a bare origins map
          if (Array.isArray(parsed.sources)) {
            this.sourceGroups = parsed.sources
              .filter(source => source && source.manual === true && typeof source.id === 'string' && source.id.startsWith('file-') && Array.isArray(source.candidates))
              .map(source => ({
                ...source,
                manual: true,
                files: Array.isArray(source.files) ? source.files : [],
                candidates: source.candidates.map(candidate => ({ ...candidate, id: typeof candidate.id === 'string' ? candidate.id : randomUUID() })),
              }));
          }
        }
      } catch (error) { if (error.code !== 'ENOENT') this.ctx.logger?.warn?.('MCP Hub 来源记录不可读，将继续读取服务配置'); }
    }
    // A Host stopped while a save was still verifying leaves `state: 'verifying'`
    // on disk. No probe resumes on the next run, so the row would read "verifying"
    // forever; settle it as an interrupted failure rather than a false pass.
    let interrupted = false;
    for (const [name, record] of Object.entries(this.lastVerifications)) {
      if (record?.state !== 'verifying') continue;
      this.lastVerifications[name] = {
        ...record, state: 'failed',
        detail: '验证被中断：DSH 在验证过程中关闭，请重新验证',
        finishedAt: Date.now(),
      };
      interrupted = true;
    }
    if (interrupted) {
      try { await this.persistMeta(); }
      catch { this.ctx.logger?.warn?.('MCP Hub 无法写入被中断的验证结论'); }
    }
    return this;
  }
  preflightOptions(extra = {}) {
    return { home: this.home, env: this.env, cwd: this.cwd, referenceStorage: this.referenceStorage, describeCredential: name => this.describeCredential(name), ...extra };
  }
  /** Ask the credential service whether a reference is satisfied by store, environment, or `.env`. */
  async describeCredential(name) {
    const provider = this.probeContext?.credentials;
    if (!provider?.describe || typeof name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return undefined;
    try { return await provider.describe(name); } catch { return undefined; }
  }
  /** The writable credential service; absent when the host runs without one. */
  credentialsProvider() {
    const provider = this.probeContext?.credentials ?? serviceOf(this.ctx, 'credentials');
    if (!provider || typeof provider.set !== 'function' || typeof provider.describe !== 'function' || typeof provider.resolve !== 'function' || typeof provider.unset !== 'function') return undefined;
    return provider;
  }
  /** Move every secret in `entry` into the credential store and reference it from the config. */
  async planSecrets(entry, body, form, entries, owners = credentialOwners(entries, form.base?.servers ?? {})) {
    const provider = this.credentialsProvider();
    const planned = await planCredentials(entry, {
      server: body.name,
      env: this.env,
      provider,
      owners,
      aliases: body.originalName ? [body.originalName] : [],
    });
    return { ...planned, provider };
  }
  /** Credential names the removed/replaced entry used and nothing else references now. */
  orphanCredentials(entry) {
    const form = this.descriptor({ fresh: true });
    const owners = credentialOwners(form.value?.servers ?? {}, form.base?.servers ?? {});
    return credentialNames(entry).filter(name => (owners.get(name)?.size ?? 0) === 0);
  }
  credentialsReport(planned) {
    if (!planned) return undefined;
    const report = {};
    if (planned.stored?.length) report.stored = planned.stored;
    if (planned.reused?.length) report.reused = planned.reused;
    if (planned.missing?.length) report.missing = planned.missing;
    return Object.keys(report).length ? report : undefined;
  }
  descriptor({ fresh = false } = {}) {
    const now = Date.now();
    // `settings.describe()` reloads the profile document; showing one status row must
    // not cost a disk read, so the live view is short-lived and invalidated on write.
    if (!fresh && this.descriptorCache && now - this.descriptorCache.at < this.descriptorTtlMs) return this.descriptorCache.form;
    const form = this.readDescriptor();
    this.descriptorCache = { form, at: now };
    return form;
  }
  readDescriptor() {
    const forms = this.ctx.settings.describe();
    const editor = serviceOf(this.ctx, 'configEditor');
    const entries = editor?.entries?.() ?? serviceOf(this.ctx, 'loader')?.entries?.() ?? [];
    const entry = [...entries].find(row => row.options?.name === '@deepseek-ai/dsh-mcp-manager');
    const id = entry?.options?.id;
    const form = forms.find(row => row.ns === id)
      ?? forms.find(row => row.ns === 'mcp-manager' || (row.value && typeof row.value === 'object' && row.value.servers && row.schema !== undefined && row.applies === 'live'));
    if (!form) fail('SERVICE_UNAVAILABLE', '未找到官方 MCP Manager 的可写配置，请先启用 DSH MCP Manager');
    return form;
  }
  /** Every visible tool schema, read once per request: `schemas()` deep-clones each tool. */
  toolSchemas() {
    try { return this.ctx.tools.schemas(); }
    catch (error) { this.ctx.logger?.warn?.('MCP Hub 无法读取工具列表', error); return []; }
  }
  toolsFrom(schemas, name) {
    const prefix = `mcp__${name}__`;
    return schemas.filter(tool => tool.name.startsWith(prefix)).map(tool => ({
      name: tool.name.slice(prefix.length), fullName: tool.name, description: tool.description ?? '',
    }));
  }
  tools(name) { return this.toolsFrom(this.toolSchemas(), name); }
  /** Full parameter schemas for one server, fetched when a row is expanded. */
  toolsFor(name) {
    if (typeof name !== 'string' || !name) fail('REQUEST_INVALID', '缺少服务名称');
    const prefix = `mcp__${name}__`;
    const tools = this.toolSchemas().filter(tool => tool.name.startsWith(prefix)).map(tool => ({
      name: tool.name.slice(prefix.length),
      fullName: tool.name,
      description: tool.description ?? '',
      schema: tool.parameters ?? {},
    }));
    return { name, tools };
  }
  statusView(status, entry) {
    return {
      state: status.state,
      toolCount: status.toolCount,
      connectedAt: status.connectedAt,
      attempt: status.attempt,
      maxAttempts: status.maxAttempts,
      nextRetryAtMs: status.nextRetryAtMs,
      reason: status.reason,
      closeConfirmed: status.result?.closeConfirmed,
      cleanupError: typeof status.result?.cleanupError === 'string' ? status.result.cleanupError : undefined,
      lastError: STATUS_WITH_ERROR.includes(status.state) ? this.safeError(diagnostic(status), entry) : undefined,
    };
  }
  verificationView(name) {
    const record = this.verifications.get(name) ?? this.lastVerifications[name];
    if (!record) return undefined;
    return { state: record.state, detail: record.detail, startedAt: record.startedAt, finishedAt: record.finishedAt };
  }
  async list() {
    const form = this.descriptor();
    const entries = form.value?.servers ?? {};
    const runtime = this.ctx.mcpManager.list();
    const schemas = this.toolSchemas();
    const names = [...new Set([...Object.keys(entries), ...runtime.map(row => row.name)])];
    return {
      revision: form.revision, version: this.version, namespace: form.ns,
      profile: this.profile?.name,
      location: { hostname: hostname(), home: this.home, platform: process.platform },
      referenceStorage: this.referenceStorage,
      servers: names.map(name => {
        try { return this.row(form, name, entries, runtime, schemas); }
        catch (error) {
          this.ctx.logger?.warn?.('MCP Hub 无法解析服务 ' + name, error);
          return this.brokenRow(name, error);
        }
      }),
    };
  }
  row(form, name, entries, runtime, schemas) {
    const entry = entries[name];
    const live = runtime.find(row => row.name === name);
    const owned = Object.hasOwn(entries, name);
    // A stored entry the manager would refuse is shown as a readable broken row, not
    // allowed to throw out of the whole listing.
    if (owned && !validEntry(entry)) throw new Error('缺少有效的连接方式');
    const status = live?.status ?? { state: entry?.enabled === false ? 'disabled' : 'connecting' };
    const inherited = owned && Object.hasOwn(form.base?.servers ?? {}, name);
    const tools = this.toolsFrom(schemas, name);
    return {
      name, entry: entry ? redact(entry) : null,
      // 官方状态字段尽量原样透出，界面才能说明「第几次重试、何时重试、清理是否完成」。
      status: this.statusView(status, entry),
      // configured=false 表示条目已从配置移除、但实例仍在清理（官方会保留到宿主重启）。
      managed: owned ? (inherited ? 'inherited' : 'config') : live?.configured === false ? 'cleanup' : 'plugin',
      verification: this.verificationView(name),
      editable: owned, removable: owned && !inherited,
      source: this.origins[name] ?? { app: owned ? 'DSH 配置' : live?.configured === false ? '已删除，清理中' : '插件注册' },
      tools, toolCount: tools.length,
    };
  }
  /** One unreadable entry must not take the whole page down. */
  brokenRow(name, error) {
    return {
      name, entry: null,
      status: { state: 'failed', reason: 'load', lastError: '配置条目无法读取：' + (error?.message ?? '未知错误') },
      managed: 'broken', verification: this.verificationView(name),
      editable: false, removable: false, source: { app: '配置异常' },
      tools: [], toolCount: 0,
    };
  }
  /** Lightweight view used by the push channel: no entries, no tool details. */
  status() {
    const form = this.descriptor();
    const entries = form.value?.servers ?? {};
    const runtime = this.ctx.mcpManager.list();
    const names = [...new Set([...Object.keys(entries), ...runtime.map(row => row.name)])];
    return {
      revision: form.revision, version: this.version,
      servers: names.map(name => {
        const entry = entries[name];
        const live = runtime.find(row => row.name === name);
        const owned = Object.hasOwn(entries, name);
        // The pushed view must agree with `list()`: an unreadable entry stays a
        // read-only failure here too, otherwise it would overwrite the correct row.
        if (owned && !validEntry(entry)) {
          return { name, state: 'failed', reason: 'load', lastError: '配置条目无法读取：缺少有效的连接方式', editable: false, verification: this.verificationView(name) };
        }
        const status = live?.status ?? { state: entry?.enabled === false ? 'disabled' : 'connecting' };
        return {
          name, state: status.state, toolCount: status.toolCount, connectedAt: status.connectedAt,
          attempt: status.attempt, maxAttempts: status.maxAttempts, nextRetryAtMs: status.nextRetryAtMs,
          reason: status.reason,
          closeConfirmed: status.result?.closeConfirmed,
          cleanupError: typeof status.result?.cleanupError === 'string' ? status.result.cleanupError : undefined,
          lastError: STATUS_WITH_ERROR.includes(status.state) ? this.safeError(diagnostic(status), entry) : undefined,
          verification: this.verificationView(name),
          editable: owned,
        };
      }),
    };
  }
  /** Resolve waiters on any state change so the client can update without polling. */
  notify() {
    this.version += 1;
    for (const waiter of [...this.waiters]) waiter();
    this.waiters.clear();
  }
  waitForChange(deadline, signal) {
    if (signal?.aborted) return Promise.resolve();
    return new Promise(resolve => {
      let timer;
      const finish = () => { clearTimeout(timer); this.waiters.delete(waiter); signal?.removeEventListener?.('abort', finish); resolve(); };
      const waiter = finish;
      timer = setTimeout(finish, Math.max(0, deadline - Date.now()));
      this.waiters.add(waiter);
      signal?.addEventListener?.('abort', finish, { once: true });
    });
  }
  /** Long-poll: answer immediately when the version or revision moved, else hold the request. */
  async wait(body = {}, signal) {
    const since = Number.isInteger(body.version) ? body.version : -1;
    const sinceRevision = Number.isInteger(body.revision) ? body.revision : -1;
    const timeoutMs = Math.min(Math.max(Number(body.timeoutMs) || 20000, 1000), 60000);
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const snapshot = this.status();
      if (this.closed || snapshot.version !== since || snapshot.revision !== sinceRevision) return snapshot;
      if (Date.now() >= deadline) return snapshot;
      await this.waitForChange(deadline, signal);
      if (signal?.aborted) return snapshot;
    }
  }
  /** 名字被「已删除、清理中」的实例占着时的说明：附上官方给出的清理失败原因。 */
  cleaningMessage(live) {
    const reason = typeof live?.status?.result?.cleanupError === 'string' && live.status.result.cleanupError ? live.status.result.cleanupError : '';
    return '该名称正在清理上一个连接（已删除，清理中）' + (reason ? '：' + reason : '')
      + '；稍后重试即可，若一直不消失需要重启 DSH';
  }
  safeError(error, entry) {
    let text = String(error?.message ?? error);
    const secrets = [];
    for (const field of ['env', 'headers']) secrets.push(...Object.values(entry?.[field] ?? {}));
    secrets.push(...(Array.isArray(entry?.args) ? entry.args : []));
    if (entry?.url) { try { const url = new URL(entry.url); secrets.push(url.password, url.username, ...url.searchParams.values()); } catch {} }
    for (const value of secrets.filter(v => typeof v === 'string' && v.length > 3).sort((a,b) => b.length-a.length)) text = text.split(value).join('[隐藏]');
    return text.slice(0, 1200);
  }
  async scan() {
    const sources = await scanSources({ home: this.home, env: this.env, cwd: this.cwd });
    this.sourceGroups = [...sources, ...this.sourceGroups.filter(source => source.id.startsWith('file-'))];
    this.candidates.clear();
    return this.sources();
  }
  sources() { return this.presentSources(this.sourceGroups); }
  async parseFile({ text, filename }) {
    if (typeof text !== 'string' || typeof filename !== 'string') fail('REQUEST_INVALID', '缺少配置文件内容');
    const safeName = filename.split(/[\\/]/).at(-1).slice(0, 180);
    const document = parseDocument(text, safeName, { maxBytes: this.maxConfigBytes });
    // `~/.claude.json` may be picked by hand too; flatten its project scopes like the scan does.
    const flattened = /^\.claude\.json$/i.test(safeName) ? flattenClaudeProjects(document) : { document, scopes: new Map() };
    const rows = parseEditorObject(flattened.document, safeName.replace(/\.(?:jsonc?|toml)$/i,''));
    const id = 'file-' + randomUUID();
    const candidates = rows.map(row => ({ ...row, id: randomUUID(), source: '配置文件', sourcePath: safeName, detail: flattened.scopes.get(row.name) }));
    const source = { id, name: '配置文件 · ' + safeName, manual: true, files: [{ path: safeName, state: 'read', count: rows.length }], candidates };
    this.sourceGroups.push(source);
    await this.persistMeta().catch(error => this.ctx.logger?.warn?.('MCP Hub 无法保存手动导入来源：' + (error?.message ?? error)));
    return this.presentSources([source]);
  }
  /** Only a source the user picked by hand can be removed; auto-scanned sources are read-only. */
  async removeSource(id) {
    if (typeof id !== 'string' || !id.startsWith('file-')) fail('SOURCE_READONLY', '自动扫描的配置不能删除');
    const index = this.sourceGroups.findIndex(source => source.id === id);
    if (index < 0) fail('SOURCE_NOT_FOUND', '找不到这个导入来源，请刷新后重试');
    const [source] = this.sourceGroups.splice(index, 1);
    if (!source.manual) {
      this.sourceGroups.splice(index, 0, source);
      fail('SOURCE_READONLY', '自动扫描的配置不能删除');
    }
    for (const candidate of source.candidates) this.candidates.delete(candidate.id);
    await this.persistMeta().catch(error => this.ctx.logger?.warn?.('MCP Hub 无法保存来源删除：' + (error?.message ?? error)));
    return this.sources();
  }
  async reveal(body) {
    const current = body.candidateId ? this.candidates.get(body.candidateId)?.entry : this.descriptor().value?.servers?.[body.originalName];
    if (!current) fail('CANDIDATE_STALE', '配置已失效，请重新打开编辑窗口');
    if (!['env','headers','args'].includes(body.field)) fail('FIELD_UNSUPPORTED', '不支持读取此字段');
    const value = current[body.field]?.[body.key];
    if (typeof value !== 'string') fail('CONFIG_INVALID', '未找到配置值');
    // A credential reference is resolved through the host; the value never lives
    // in the configuration, so reading it back needs the credential service.
    const names = credentialNames({ value });
    if (names.length) {
      const provider = this.credentialsProvider();
      if (!provider) fail('CREDENTIAL_UNAVAILABLE', '当前 DSH 没有挂载凭证服务，无法读取密钥');
      if (isCredentialTemplate(value)) {
        const found = await provider.resolve(names[0]);
        if (!found?.value) fail('CREDENTIAL_MISSING', '凭证未配置：' + names[0]);
        return { value: found.value, source: found.source, name: names[0] };
      }
      const { entry, missing } = await inlineCredentials({ value }, provider);
      if (missing.length) fail('CREDENTIAL_MISSING', '凭证未配置：' + missing.join('、'));
      return { value: entry.value, names };
    }
    return { value };
  }
  /**
   * 重复识别用的连接身份：把 `${credential:…}`、`${env:…}` 解析成真实值再算指纹。
   *
   * 只看模板文本会把「各应用里同一个服务」判成不同连接——同一个 token 可能写成
   * `${DOCS_TOKEN}`、也可能已经存成 `${credential:MCPHUB_DOCS_TOKEN}`，甚至明文。
   * 解析失败（凭证未配置）就保留模板文本，避免把两个都缺凭证的条目合成一个。
   * 返回的只是哈希，真实值不会离开 Host。
   */
  async resolvedIdentity(entry, provider) {
    if (!provider?.resolve) return entry;
    const resolveText = async text => {
      const names = [...new Set([...text.matchAll(/\$\{credential:([A-Za-z_][A-Za-z0-9_]*)\}/g)].map(match => match[1]))];
      let out = text;
      for (const name of names) {
        try {
          const found = await provider.resolve(name);
          if (typeof found?.value === 'string' && found.value) out = out.split('${credential:' + name + '}').join(found.value);
        } catch { /* 未配置：保持模板，宁可判成不同也不合并 */ }
      }
      return out;
    };
    const walk = async value => {
      if (typeof value === 'string') return resolveText(value);
      if (Array.isArray(value)) return Promise.all(value.map(walk));
      if (value !== null && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await walk(item)])));
      return value;
    };
    return walk(entry);
  }
  async presentSources(sources) {
    const existing = this.descriptor().value?.servers ?? {};
    const provider = this.credentialsProvider();
    const existingHashes = new Map();
    const existingSkeletons = new Map();
    for (const [name, entry] of Object.entries(existing)) {
      existingSkeletons.set(name, connectionSkeleton(entry));
      try {
        const checked = (await preflight(name, entry, this.preflightOptions())).entry;
        existingHashes.set(connectionFingerprint(await this.resolvedIdentity(checked, provider)), name);
      } catch { /* one unreadable stored entry must not break the import list */ }
    }
    const all = new Map();
    const presented = [];
    for (const source of sources) {
      const candidates = [];
      for (const candidate of source.candidates) {
        this.candidates.set(candidate.id, candidate);
        let checked, hash;
        try {
          checked = await preflight(candidate.name, candidate.entry, this.preflightOptions());
          hash = connectionFingerprint(await this.resolvedIdentity(checked.entry, provider));
        } catch (error) {
          candidates.push({ ...candidate, entry: redact(candidate.entry ?? {}), issues: [...new Set([...(candidate.issues ?? []), '无法校验此配置：' + (error?.message ?? '未知错误')])], duplicate: undefined, duplicateSource: undefined, nameConflict: false });
          continue;
        }
        const sameNameSkeleton = existingSkeletons.get(candidate.name) === connectionSkeleton(checked.entry);
        const duplicate = existingHashes.get(hash) ?? (sameNameSkeleton ? candidate.name : undefined);
        const duplicateSource = all.get(hash);
        all.set(hash, source.name);
        candidates.push({ ...candidate, entry: redact(candidate.entry), duplicate, duplicateSource, credentialOmitted: Boolean(sameNameSkeleton && !existingHashes.has(hash)), nameConflict: Object.hasOwn(existing, candidate.name) && !duplicate });
      }
      presented.push({ ...source, candidates });
    }
    return { sources: presented };
  }
  /** Build a backup for the browser; credentials are opt-in and explicit. */
  async exportBackup(body = {}) {
    const includeSecrets = body?.includeSecrets === true;
    const provider = this.credentialsProvider();
    const missing = new Set();
    const servers = [];
    for (const [name, entry] of Object.entries(this.descriptor().value?.servers ?? {})) {
      if (!includeSecrets) { servers.push({ name, entry: redact(entry) }); continue; }
      // Inlining resolves credential references so the backup is usable on
      // another machine; the reference-only export keeps them unresolved.
      if (!provider) { servers.push({ name, entry }); continue; }
      const { entry: resolved, missing: names } = await inlineCredentials(entry, provider);
      for (const item of names) missing.add(item);
      servers.push({ name, entry: resolved });
    }
    const { backup, omitted } = buildBackup(servers);
    return { includeSecrets, count: Object.keys(backup).length, backup, omitted, credentialsMissing: [...missing] };
  }
  async catalogSearch(body, signal) { return this.catalog.search(body, signal); }
  async catalogDetail(body, signal) { return this.catalog.detail(body, signal); }
  draft(body, current) {
    const candidate = body.candidateId ? this.candidates.get(body.candidateId) : null;
    if (body.candidateId && !candidate) fail('CANDIDATE_STALE', '扫描结果已失效，请重新扫描后再添加');
    const previous = body.originalName ? current?.[body.originalName] : candidate?.entry ?? {};
    if (!body.entry || typeof body.entry !== 'object' || Array.isArray(body.entry)) fail('CONFIG_INVALID', '缺少配置');
    const next = restoreMasked(body.entry, previous);
    if (JSON.stringify(next).includes(MASK)) fail('HIDDEN_VALUE_CHANGED', '请重新填写隐藏字段');
    return { entry: next, candidate };
  }
  async test(body, signal) {
    const current = this.descriptor().value?.servers;
    const { entry, candidate } = this.draft(body, current);
    if (candidate?.issues.length && !body.acceptUnsupported) return {ok:false, checks:[{label:'来源配置兼容性',ok:false,detail:'请先核对未迁移字段'}]};
    const lifetime = signal ? AbortSignal.any([signal, this.probeLifetime.signal]) : this.probeLifetime.signal;
    return testConnection(this.probeContext ?? this.ctx, body.name, entry, this.preflightOptions({ signal: lifetime, timeoutMs: this.probeTimeoutMs }));
  }
  /** Probe an existing entry — including a disabled one — through the manager's own seam. */
  async probeExisting(body, signal) {
    const name = body?.name;
    if (typeof name !== 'string' || !name) fail('REQUEST_INVALID', '缺少服务名称');
    const form = this.descriptor({ fresh: true });
    const entry = form.value?.servers?.[name];
    const registered = this.ctx.mcpManager.list().some(row => row.name === name);
    if (!entry && !registered) fail('ROW_NOT_FOUND', '找不到该服务，请刷新后重试');
    const startedAt = Date.now();
    if (typeof this.ctx.mcpManager.probe === 'function') {
      let probed;
      try { probed = await this.ctx.mcpManager.probe(name, { signal, timeoutMs: this.probeTimeoutMs }); }
      catch (error) {
        // A cancelled probe says nothing about the server; do not persist it as a result.
        if (signal?.aborted) return { ok: false, cancelled: true, checks: [{ label: '复诊', ok: false, detail: '已取消' }] };
        return this.finishProbe(name, startedAt, { ok: false, checks: [{ label: '复诊', ok: false, detail: this.safeError(error, entry) }] });
      }
      return this.finishProbe(name, startedAt, this.describeProbe(name, probed));
    }
    if (!entry) fail('SERVICE_UNAVAILABLE', '当前 DSH 版本不支持复诊插件注册的服务');
    const tested = await testConnection(this.probeContext ?? this.ctx, name, entry, this.preflightOptions({ signal, timeoutMs: this.probeTimeoutMs }));
    return this.finishProbe(name, startedAt, tested);
  }
  describeProbe(name, probe) {
    const elapsed = Number.isFinite(probe.durationMs) ? `，用时 ${Math.round(probe.durationMs)} ms` : '';
    const connected = probe.ok === true || probe.stage === 'list';
    const failure = `${probe.stage === 'list' ? '工具列表阶段' : '连接阶段'}失败：${probe.message ?? '未知原因'}${elapsed}`;
    const checks = [{ label: 'MCP 连接', ok: connected, detail: connected ? `已连接 ${probe.serverInfo?.name ?? name}${elapsed}` : failure }];
    if (connected) {
      checks.push({ label: '工具发现', ok: probe.ok === true, detail: probe.ok === true ? `发现 ${probe.toolNames?.length ?? 0} 个工具` : failure });
    }
    const cleaned = probe.closeConfirmed === true && !probe.cleanupError;
    checks.push({ label: '测试连接已关闭', ok: cleaned, detail: cleaned ? '未改动正在运行的服务实例' : (probe.cleanupError ? '测试清理未完成：' + probe.cleanupError : '测试清理未确认，请检查服务进程') });
    return { ok: probe.ok === true && cleaned, connectionOk: connected, capability: probe.ok === true ? 'ok' : probe.stage === 'list' ? 'failed' : 'skipped', cleanupOk: cleaned, checks, stage: probe.stage, durationMs: probe.durationMs };
  }
  finishProbe(name, startedAt, result) {
    const detail = result.checks?.find(check => !check.ok)?.detail ?? result.checks?.[0]?.detail ?? '复诊完成';
    this.recordVerification(name, { state: result.ok ? 'ok' : 'failed', detail, startedAt, finishedAt: Date.now() });
    this.notify();
    return result;
  }
  serialize(fn) {
    const result = this.tail.then(() => { if (this.closed) fail('SERVICE_CLOSED', '配置服务已关闭，请刷新后重试'); return fn(); });
    this.tail = result.catch(() => {});
    return result;
  }
  async write(form, ops, entry) {
    try { await this.ctx.settings.mutate(form.ns, ops, form.revision); }
    catch (error) {
      if (/changed since it was read|revision/i.test(String(error?.message ?? ''))) fail('REVISION_CONFLICT', '配置已被其他操作修改，请刷新列表后重新核对再保存');
      fail('WRITE_REJECTED', 'DSH 拒绝了这条配置：' + this.safeError(error, entry));
    }
    this.descriptorCache = null;
    this.notify();
  }
  async mutate(body) {
    return this.serialize(async () => {
      const form = this.descriptor({ fresh: true });
      const entries = form.value?.servers ?? {};
      // 重启不改配置，是幂等动作：它不需要 revision，否则并发下会被当成「保存冲突」拒掉。
      if (body.action === 'restart') {
        if (!Object.hasOwn(entries, body.name)) fail('NOT_WRITABLE', '此服务由其他插件管理，无法在此修改');
        await this.ctx.mcpManager.restart(body.name);
        this.notify();
        return { ok: true };
      }
      if (!Number.isInteger(body.revision) || body.revision !== form.revision) fail('REVISION_CONFLICT', '配置已发生变化，请刷新列表并重新核对后保存');
      if (body.action === 'import') return this.importBatch(body, form, entries);
      if (body.action === 'undo-import') return this.undoImport(body, form, entries);
      const exists = Object.hasOwn(entries, body.name);
      if (body.action === 'bulk') return this.bulk(body, form, entries);
      if (body.action === 'save') {
        const renamed = Boolean(body.originalName && body.originalName !== body.name);
        // 编辑/改名时按原名确认条目仍在；新增时才需要新名字未被占用。
        if (body.originalName && !Object.hasOwn(entries, body.originalName)) fail('CANDIDATE_STALE', '服务已被删除，请刷新后重试');
        if (renamed && Object.hasOwn(form.base?.servers ?? {}, body.originalName)) fail('INHERITED_ROW', '继承配置中的服务不能改名，只能停用');
        const runtime = this.ctx.mcpManager.list();
        const live = runtime.find(row => row.name === body.name);
        // 刚删除的服务会被官方保留成一行 `configured === false` 的「清理中」实例：
        // 名字在配置里已经空出来，但旧进程还没退出，此刻写入会与它抢同一个名字。
        // 那不是重名，界面上重试即可，所以要给出能和 NAME_TAKEN 区分的结论。
        const cleaning = live?.configured === false;
        const conflict = Object.hasOwn(entries, body.name) || (Boolean(live) && !cleaning);
        if (renamed ? conflict : !body.originalName && conflict) fail('NAME_TAKEN', '已有同名服务器，请修改名称');
        if (!Object.hasOwn(entries, body.name) && cleaning) fail('NAME_CLEANING', this.cleaningMessage(live));
        const { entry, candidate } = this.draft(body, entries);
        // Secrets are moved into the credential store first, but only written once
        // validation passes; a failed write rolls the new values back.
        const planned = await this.planSecrets(entry, body, form, entries);
        const checked = await preflight(body.name, planned.entry, this.preflightOptions());
        if (candidate?.issues.length && !body.acceptUnsupported) fail('CONFIG_INVALID', '请先确认来源配置中的未迁移字段');
        // 硬约束即使在「保存为停用」时也必须通过，否则会把非法条目交给官方校验。
        if (checked.checks.some(check => check.hard && !check.ok)) return { ok: false, saved: false, checks: checked.checks, variables: checked.variables, credentials: this.credentialsReport(planned) };
        if (!checked.ok && body.mode !== 'draft') return { ok: false, saved: false, checks: checked.checks, variables: checked.variables, credentials: this.credentialsReport(planned) };
        // Never claim success merely because the profile accepted the write.
        // New rows are enabled unless the caller explicitly asked for a draft;
        // editing preserves the row's current switch state.
        const next = { ...checked.entry, enabled: body.mode !== 'draft' && (body.originalName ? entry.enabled !== false : true) };
        const previousStatus = runtime.find(row => row.name === (body.originalName ?? body.name))?.status;
        const changed = renamed || !includesConfig(entries[body.name], next);
        // 改名在同一个 revision 里一次提交：先写新键，再删旧键。
        const ops = renamed
          ? [{ op: 'set', path: ['servers', body.name], value: next }, { op: 'unset', path: ['servers', body.originalName] }]
          : [{ op: 'set', path: ['servers', body.name], value: next }];
        const rollback = await commitCredentials(planned.provider, planned.writes);
        try {
          await this.write(form, ops, next);
        } catch (error) {
          await rollback();
          throw error;
        }
        const warnings = [];
        const previousEntry = entries[body.originalName ?? body.name];
        const cleanup = previousEntry ? this.orphanCredentials(previousEntry) : [];
        if (renamed) {
          if (this.origins[body.originalName]) { this.origins[body.name] = this.origins[body.originalName]; delete this.origins[body.originalName]; }
          try { await this.persistMeta(); } catch { warnings.push('配置已保存，但来源记录未能写入'); }
        }
        if (candidate) {
          this.origins[body.name] = { app: candidate.source, path: candidate.sourcePath, importedAt: new Date().toISOString() };
          try { await this.persistMeta(); } catch { warnings.push('配置已保存，但来源记录未能写入'); }
        }
        if (!next.enabled) return { ok: false, saved: true, draft: true, checks: checked.checks, variables: checked.variables, warnings, credentials: this.credentialsReport(planned), cleanup };
        // 写入与验证分开：写成功即返回，验证在后台继续，结果通过 list().verification 回报。
        this.startVerification(body.name, next, changed ? previousStatus?.connectedAt : undefined);
        return { ok: true, saved: true, verifying: true, renamed, entry: redact(next), credentials: this.credentialsReport(planned), cleanup, checks: [...checked.checks, { label: '配置已保存', ok: true, detail: '正在后台验证正式连接与工具注册，结果会显示在服务列表' }], warnings };
      }
      if (!exists) fail('NOT_WRITABLE', '此服务由其他插件管理，无法在此修改');
      if (body.action === 'remove') {
        if (Object.hasOwn(form.base?.servers ?? {}, body.name)) fail('INHERITED_ROW', '此服务来自继承配置，只能停用');
        await this.write(form, [{ op: 'unset', path: ['servers', body.name] }], entries[body.name]);
        const cleanup = this.orphanCredentials(entries[body.name]);
        delete this.origins[body.name];
        delete this.lastVerifications[body.name];
        this.verifications.delete(body.name);
        await this.persistMeta();
        return { ok: true, cleanup };
      }
      if (body.action === 'toggle') {
        if (typeof body.enabled !== 'boolean') fail('REQUEST_INVALID', '缺少启停状态');
        const previousConnectedAt = this.ctx.mcpManager.list().find(row => row.name === body.name)?.status?.connectedAt;
        await this.write(form, [{ op: 'set', path: ['servers', body.name, 'enabled'], value: body.enabled }], entries[body.name]);
        if (!body.enabled) {
          this.cancelVerification(body.name, '服务已停用，验证结束');
          return { ok: true };
        }
        // 启停只写 enabled，本身不重启实例；验证要跟着新的连接代次重开，界面才不会
        // 继续显示上一次保存或上一次失败时的结论。
        this.startVerification(body.name, { ...entries[body.name], enabled: true }, previousConnectedAt);
        return { ok: true, verifying: true };
      }
      if (body.action === 'restart') {
        await this.ctx.mcpManager.restart(body.name);
        this.notify();
        return { ok: true };
      }
      fail('UNSUPPORTED_ACTION', '不支持的操作');
    });
  }
  /**
   * Add several services from one pasted document. Preflight every row first, then
   * write all of them in a single revision: one bad row means no write at all.
   * Existing names are skipped instead of blocking the rest (the UI labels them).
   */
  async importBatch(body, form, entries) {
    if (!Array.isArray(body.entries)) fail('REQUEST_INVALID', '缺少批量配置');
    if (!body.entries.length) fail('REQUEST_INVALID', '没有可添加的服务');
    if (body.entries.length > 100) fail('REQUEST_INVALID', '一次最多添加 100 个服务');
    const runtime = this.ctx.mcpManager.list();
    const base = form.base?.servers ?? {};
    const skipped = [];
    const seen = new Set();
    const prepared = [];
    // Track names allocated during this batch too: two pasted servers may both
    // reference the same environment variable, and each must get its own copy
    // instead of silently sharing one stored value.
    const batchOwners = credentialOwners(entries, base);
    for (const item of body.entries) {
      if (!item || typeof item !== 'object' || typeof item.name !== 'string' || !item.name) fail('REQUEST_INVALID', '批量配置缺少服务名称');
      if (seen.has(item.name)) fail('NAME_TAKEN', `批量配置中有重复的服务名：${item.name}`);
      seen.add(item.name);
      const live = runtime.find(row => row.name === item.name);
      if (Object.hasOwn(entries, item.name) || Object.hasOwn(base, item.name) || (live && live.configured !== false)) {
        skipped.push({ name: item.name, reason: '已存在' });
        continue;
      }
      // 清理中的同名实例不是「已存在」：跳过会让人以为添加了，写入又会和旧进程抢名字，
      // 所以整批拒绝，由调用方稍后重试。
      if (live) fail('NAME_CLEANING', this.cleaningMessage(live));
      const { entry, candidate } = this.draft({ entry: item.entry, name: item.name, candidateId: item.candidateId }, entries);
      if (candidate?.issues?.length && !item.acceptUnsupported) fail('CONFIG_INVALID', `请先确认「${item.name}」中的未迁移字段`);
      const planned = await this.planSecrets(entry, { name: item.name }, form, entries, batchOwners);
      const checked = await preflight(item.name, planned.entry, this.preflightOptions());
      if (!checked.ok) return { ok: false, saved: false, failed: { name: item.name }, checks: checked.checks, variables: checked.variables, credentials: this.credentialsReport(planned) };
      // Pasting a config from another app often carries enabled:false. New rows
      // are always enabled here; enable/disable after adding is the list toggle's job.
      for (const name of credentialNames(planned.entry)) batchOwners.set(name, new Set([...(batchOwners.get(name) ?? []), item.name]));
      prepared.push({ name: item.name, entry: { ...checked.entry, enabled: true }, candidate, planned });
    }
    if (!prepared.length) return { ok: true, saved: false, imported: [], skipped, detail: '没有新的服务' };
    // One settings.mutate for the whole batch: a revision conflict or a bad entry
    // can never leave half of the pasted services behind. Credentials follow the
    // same rule: write them only once every row passed, and roll back on failure.
    const byName = new Map();
    for (const planned of prepared.map(row => row.planned)) for (const write of planned.writes) byName.set(write.name, write);
    const provider = prepared.find(row => row.planned.provider)?.planned.provider;
    const rollback = await commitCredentials(provider, [...byName.values()]);
    try {
      await this.write(form, prepared.map(row => ({ op: 'set', path: ['servers', row.name], value: row.entry })), undefined);
    } catch (error) {
      await rollback();
      throw error;
    }
    const warnings = [];
    let metaDirty = false;
    for (const row of prepared) {
      if (!row.candidate) continue;
      this.origins[row.name] = { app: row.candidate.source, path: row.candidate.sourcePath, importedAt: new Date().toISOString() };
      metaDirty = true;
    }
    if (metaDirty) {
      try { await this.persistMeta(); } catch { warnings.push('配置已保存，但来源记录未能写入'); }
    }
    const enabled = prepared.filter(row => row.entry.enabled);
    let snapshot;
    try { snapshot = { runtime: this.ctx.mcpManager.list(), schemas: this.toolSchemas() }; } catch { /* verification will retry on the next tick */ }
    for (const row of enabled) this.startVerification(row.name, row.entry, undefined, snapshot);
    this.pruneImportBatches();
    const batchId = randomUUID();
    this.importBatches.set(batchId, {
      names: prepared.map(row => row.name),
      entries: Object.fromEntries(prepared.map(row => [row.name, structuredClone(row.entry)])),
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    const stored = prepared.flatMap(row => row.planned.stored ?? []);
    const reused = prepared.flatMap(row => row.planned.reused ?? []);
    const missing = [...new Set(prepared.flatMap(row => row.planned.missing ?? []))];
    return {
      ok: true, saved: true, batchId, imported: prepared.map(row => row.name), skipped,
      verifying: enabled.length > 0, draft: enabled.length === 0,
      credentials: this.credentialsReport({ stored, reused, missing }),
      checks: [{ label: '配置已保存', ok: true, detail: `一次写入 ${prepared.length} 个服务` }],
      warnings,
    };
  }
  pruneImportBatches() {
    const now = Date.now();
    for (const [id, batch] of this.importBatches) if (batch.expiresAt <= now) this.importBatches.delete(id);
  }
  /**
   * Undo one paste batch. Only entries that still equal what that batch wrote are
   * removed; a renamed or edited entry is reported as skipped instead of being
   * silently overwritten. The batch expires after ten minutes.
   */
  async undoImport(body, form, entries) {
    this.pruneImportBatches();
    const batch = this.importBatches.get(body.batchId);
    if (!batch) fail('BATCH_STALE', '这次添加已失效，无法撤销');
    const removed = [];
    const skipped = [];
    for (const name of batch.names) {
      if (!Object.hasOwn(entries, name)) { skipped.push({ name, reason: '已被删除或改名' }); continue; }
      if (JSON.stringify(entries[name]) !== JSON.stringify(batch.entries[name])) { skipped.push({ name, reason: '已被修改' }); continue; }
      removed.push(name);
    }
    if (!removed.length) { this.importBatches.delete(body.batchId); return { ok: true, removed: [], skipped }; }
    await this.write(form, removed.map(name => ({ op: 'unset', path: ['servers', name] })), undefined);
    for (const name of removed) {
      this.cancelVerification(name, '已撤销这次添加');
      delete this.origins[name];
      delete this.lastVerifications[name];
    }
    let warnings = [];
    try { await this.persistMeta(); } catch { warnings.push('服务已撤销，但来源记录未能更新'); }
    this.importBatches.delete(body.batchId);
    return { ok: true, removed, skipped, warnings };
  }
  /** 批量操作：启停在一次 revision 里写完，重连逐个执行并忽略单个失败。 */
  async bulk(body, form, entries) {
    const requested = Array.isArray(body.names) ? [...new Set(body.names.filter(name => typeof name === 'string'))] : [];
    if (body.operation === 'restart') {
      const targets = requested.filter(name => Object.hasOwn(entries, name));
      if (!targets.length) return { ok: true, affected: 0 };
      let affected = 0;
      for (const name of targets) {
        try { await this.ctx.mcpManager.restart(name); affected += 1; } catch { /* 单个失败不影响其余服务 */ }
      }
      this.notify();
      return { ok: true, affected };
    }
    if (body.operation === 'enable' || body.operation === 'disable') {
      const enable = body.operation === 'enable';
      const targets = requested
        .filter(name => Object.hasOwn(entries, name))
        .filter(name => (entries[name].enabled !== false) !== enable);
      if (!targets.length) return { ok: true, affected: 0 };
      const previousConnectedAt = new Map(this.ctx.mcpManager.list().map(row => [row.name, row.status?.connectedAt]));
      const ops = targets.map(name => ({ op: 'set', path: ['servers', name, 'enabled'], value: enable }));
      await this.write(form, ops, undefined);
      for (const name of targets) {
        if (!enable) { this.cancelVerification(name, '服务已停用，验证结束'); continue; }
        // 手动启用等于新的连接代次，必须重新验证；否则诊断页还挂着停用前的旧结论。
        this.startVerification(name, { ...entries[name], enabled: true }, previousConnectedAt.get(name));
      }
      return { ok: true, affected: ops.length, verifying: enable };
    }
    fail('UNSUPPORTED_ACTION', '不支持的批量操作');
  }
  /**
   * 后台验证正式连接与工具注册。不占用写队列：保存立即返回，状态由 list() 的
   * verification 字段回报，并订阅 mcp-manager/status 以便第一时间结算。
   */
  startVerification(name, expected, previousConnectedAt, snapshot) {
    this.cancelVerification(name, '已被新的操作取代');
    // 条目显式声明了更长的启动预算时跟着放宽，避免比官方客户端的超时更早判失败。
    const declared = expected.startupTimeoutMs;
    // 首次连接往往要下载 npx 包，45 秒的默认预算不够用；给两倍。已经成功验证过的
    // 条目按正常预算走，避免每次重连都白白多等一倍。
    const firstRun = previousConnectedAt === undefined && this.lastVerifications[name]?.state !== 'ok';
    const budget = Math.max(this.waitMs, declared ? declared + 20000 : 0, firstRun ? this.waitMs * 2 : 0);
    const record = { name, state: 'verifying', expected, previousConnectedAt, startedAt: Date.now(), deadline: Date.now() + budget, detail: undefined };
    this.verifications.set(name, record);
    this.statusWatchers.add(record);
    this.ensureVerificationTicker();
    this.checkVerification(record, snapshot);
    return record;
  }
  /**
   * One timer for all pending verifications. A timer per record multiplied the
   * `tools.schemas()` deep clone by the batch size; one tick reads the runtime and
   * tool list once and evaluates every record against that snapshot.
   */
  ensureVerificationTicker() {
    if (this.verificationTimer) return;
    this.verificationTimer = setInterval(() => this.tickVerifications(), Math.max(10, this.intervalMs));
    this.verificationTimer.unref?.();
  }
  stopVerificationTicker() {
    if (!this.verificationTimer) return;
    clearInterval(this.verificationTimer);
    this.verificationTimer = null;
  }
  tickVerifications() {
    if (this.closed || !this.statusWatchers.size) return this.stopVerificationTicker();
    let snapshot;
    try {
      snapshot = { runtime: this.ctx.mcpManager.list(), schemas: this.toolSchemas() };
    } catch (error) {
      this.ctx.logger?.warn?.('MCP Hub 读取连接状态失败', error);
      for (const record of [...this.statusWatchers]) this.finishVerification(record, 'failed', '读取连接状态失败，请刷新后重试');
      return;
    }
    for (const record of [...this.statusWatchers]) this.checkVerification(record, snapshot);
  }
  /**
   * A throw here used to escape a bare `setInterval` and, through DSH's fail-loud
   * handler, exit the whole Host. Verification reads nothing but the manager's
   * in-memory view until it is about to decide, so it stays cheap as well as safe.
   */
  checkVerification(record, snapshot) {
    if (record.state !== 'verifying') return;
    try { this.evaluateVerification(record, snapshot); }
    catch (error) {
      this.ctx.logger?.warn?.('MCP Hub 读取连接状态失败', error);
      this.finishVerification(record, 'failed', '读取连接状态失败，请刷新后重试');
    }
  }
  evaluateVerification(record, snapshot) {
    if (this.closed) return this.finishVerification(record, 'cancelled', '配置服务已关闭，验证已取消');
    if (Date.now() > record.deadline) return this.finishVerification(record, 'failed', '等待正式连接或工具注册超时，请查看诊断后重试');
    const name = record.name;
    const runtime = snapshot?.runtime ?? this.ctx.mcpManager.list();
    const schemas = snapshot?.schemas ?? this.toolSchemas();
    const live = runtime.find(row => row.name === name);
    if (!live || live.configured === false) return this.finishVerification(record, 'failed', '验证期间条目已被移除，请刷新后查看最新状态');
    const status = live.status;
    if (status?.state === 'disabled') {
      // 刚把 enabled 写回 true 时，官方实例可能还没重启，仍短暂停在 disabled。
      // 只有配置真的还是停用才取消，否则这次验证会被自己的写操作误杀。
      const current = this.descriptor({ fresh: true }).value?.servers?.[name];
      if (current && current.enabled !== false) { record.detail = '正在等待服务启动…'; return; }
      return this.finishVerification(record, 'cancelled', '服务已停用，验证结束');
    }
    if (status?.state === 'failed' || status?.state === 'waiting-credentials') {
      if (!this.stillExpected(name, record.expected)) return this.finishVerification(record, 'failed', '验证期间配置已被修改，请刷新后查看最新状态');
      if (status.state === 'waiting-credentials') return this.finishVerification(record, 'failed', '缺少 DSH 凭证，请补全后重新验证');
      const reason = this.safeError(diagnostic(status), record.expected);
      return this.finishVerification(record, 'failed', AUTH_FAILURE.test(reason) ? '需要认证：' + reason : reason);
    }
    // 客户端没有 needs-auth 状态：401/403 只出现在 lastError 文本里，而它会让实例一直重连到
    // 验证预算耗尽。识别到认证失败就立刻结算，不必让用户等 45 秒才知道是凭证问题。
    if (status?.state === 'reconnecting') {
      const reason = this.safeError(diagnostic(status), record.expected);
      if (AUTH_FAILURE.test(reason)) {
        if (!this.stillExpected(name, record.expected)) return this.finishVerification(record, 'failed', '验证期间配置已被修改，请刷新后查看最新状态');
        return this.finishVerification(record, 'failed', '需要认证：' + reason);
      }
      // 地址本身不可用（禁用端口、非法 URL、域名不存在）没有重试价值；立即给结论，
      // 不让用户干等完整的启动预算。
      if (DEAD_ENDPOINT.test(reason)) {
        if (!this.stillExpected(name, record.expected)) return this.finishVerification(record, 'failed', '验证期间配置已被修改，请刷新后查看最新状态');
        return this.finishVerification(record, 'failed', '连接地址不可用：' + reason);
      }
    }
    if (status?.state === 'connected') {
      const fresh = record.previousConnectedAt === undefined || status.connectedAt !== record.previousConnectedAt;
      if (fresh && Number.isInteger(status.toolCount)) {
        const registered = this.toolsFrom(schemas, name).length;
        if (registered === status.toolCount) {
          if (!this.stillExpected(name, record.expected)) return this.finishVerification(record, 'failed', '验证期间配置已被修改，请刷新后查看最新状态');
          return this.finishVerification(record, 'ok', `DSH 已连接，已注册 ${registered} 个工具`);
        }
        record.detail = `已连接，正在同步工具（${registered}/${status.toolCount}）`;
        return;
      }
    }
    // 首次跑 npx 的包要下载依赖，几十秒的「正在连接」是正常的；超过 15 秒后换一句
    // 解释，避免用户以为卡死而反复保存/重启。
    const elapsed = Date.now() - record.startedAt;
    record.detail = status?.state === 'reconnecting'
      ? `第 ${status.attempt ?? 0}/${status.maxAttempts ?? '?'} 次重试`
      : elapsed > 15000 ? '正在启动：首次运行可能需要下载依赖或等待网络，请稍候' : '正在连接…';
  }
  /** The stored entry still equals what this verification expects. */
  stillExpected(name, expected) {
    const current = this.descriptor({ fresh: true }).value?.servers?.[name];
    return Boolean(current) && includesConfig(current, expected);
  }
  finishVerification(record, state, detail) {
    if (record.state !== 'verifying') return;
    this.statusWatchers.delete(record);
    if (!this.statusWatchers.size) this.stopVerificationTicker();
    Object.assign(record, { state, detail, finishedAt: Date.now() });
    this.recordVerification(record.name, { state, detail, startedAt: record.startedAt, finishedAt: record.finishedAt });
    if (state === 'failed') void this.disableIfUnchanged(record.name, record.expected, record.startedAt);
    this.notify();
  }
  recordVerification(name, entry) {
    this.lastVerifications[name] = entry;
    const names = Object.keys(this.lastVerifications);
    if (names.length > MAX_PERSISTED_VERIFICATIONS) {
      names.sort((a, b) => (this.lastVerifications[a].finishedAt ?? 0) - (this.lastVerifications[b].finishedAt ?? 0));
      for (const stale of names.slice(0, names.length - MAX_PERSISTED_VERIFICATIONS)) delete this.lastVerifications[stale];
    }
    this.persistMeta().catch(() => { this.ctx.logger?.warn?.('MCP Hub 无法写入验证记录'); });
  }
  /** 验证失败后自动停用，避免反复拉起；配置已被别人改动时保持原样。 */
  async disableIfUnchanged(name, expected, startedAt) {
    try {
      if (this.closed) return;
      // Still the newest verdict for this server? A later save or a manual re-enable
      // must not be undone by a verdict that arrived late.
      const persisted = this.lastVerifications[name];
      if (persisted && Number.isInteger(startedAt) && persisted.startedAt !== startedAt) return;
      // Same write queue as user edits: two settings writes must never race.
      await this.serialize(async () => {
        if (this.closed) return;
        const latest = this.descriptor({ fresh: true });
        if (!includesConfig(latest.value?.servers?.[name], expected)) return;
        await this.ctx.settings.mutate(latest.ns, [{ op: 'set', path: ['servers', name, 'enabled'], value: false }], latest.revision);
        this.descriptorCache = null;
        this.notify();
      });
    } catch { /* 失败原因仍会保留在列表与诊断里 */ }
  }
  cancelVerification(name, detail = '已取消验证') {
    const record = this.verifications.get(name);
    if (!record) return { cancelled: false };
    this.finishVerification(record, 'cancelled', detail);
    return { cancelled: true };
  }
  /** mcp-manager/status 到达时提前结算，不必等下一次轮询。 */
  onStatus(name) {
    const records = [...this.statusWatchers].filter(record => record.name === name);
    if (records.length) {
      let snapshot;
      try { snapshot = { runtime: this.ctx.mcpManager.list(), schemas: this.toolSchemas() }; } catch { snapshot = undefined; }
      for (const record of records) this.checkVerification(record, snapshot);
    }
    this.notify();
  }
  /** Serialized: verification results and origin updates must never interleave two renames. */
  persistMeta() {
    if (!this.metaPath) return Promise.resolve();
    const run = async () => {
      await mkdir(dirname(this.metaPath), { recursive: true, mode: 0o700 });
      const sources = this.sourceGroups.filter(source => source.manual === true && source.id.startsWith('file-'));
      const payload = { version: META_VERSION, origins: this.origins, verifications: this.lastVerifications, sources };
      const tmp = this.metaPath + '.' + randomUUID() + '.tmp';
      try {
        await writeFile(tmp, JSON.stringify(payload, null, 2), { mode: 0o600 });
        await rename(tmp, this.metaPath);
      } finally { await rm(tmp, { force: true }).catch(() => {}); }
    };
    const next = this.metaTail.then(run, run);
    this.metaTail = next.catch(() => {});
    return next;
  }
  close() {
    this.closed = true;
    this.probeLifetime.abort();
    for (const record of [...this.verifications.values()]) this.finishVerification(record, 'cancelled', '配置服务已关闭，验证已取消');
    this.stopVerificationTicker();
    for (const waiter of [...this.waiters]) waiter();
    this.waiters.clear();
  }
}