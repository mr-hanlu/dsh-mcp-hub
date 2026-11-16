import { hostname, homedir } from 'node:os';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { testConnection } from './probe.js';
import { parseEditorObject, parseDocument, DEFAULT_MAX_CONFIG_BYTES } from '../shared/mcp-config.js';
import { flattenClaudeProjects } from './config.js';
import { fail } from '../shared/errors.js';
import { MASK, connectionFingerprint, includesConfig, preflight, redact, restoreMasked, scanSources } from './config.js';

/** Chinese wording for the manager's terminal stop reasons. */
const REASON_TEXT = {
  load: '启动失败',
  cleanup: '清理未完成，需要重启 DSH',
  'gave-up': '重连预算已耗尽，工具已撤回',
  'reconnect-disabled': '重连已关闭，连接中断后不再恢复',
  'unclosed-generation': '上次连接未确认关闭，已阻止替换',
};
const STATUS_WITH_ERROR = ['failed', 'reconnecting', 'waiting-credentials'];
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
    this.referenceStorage = options.referenceStorage === 'value' ? 'value' : 'template';
    this.probeTimeoutMs = options.probeTimeoutMs ?? 20000;
    this.descriptorTtlMs = options.descriptorTtlMs ?? 1500;
    this.origins = Object.create(null);
    this.lastVerifications = Object.create(null);
    this.candidates = new Map();
    this.sourceGroups = [];
    this.verifications = new Map();
    this.statusWatchers = new Set();
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
        }
      } catch (error) { if (error.code !== 'ENOENT') this.ctx.logger?.warn?.('MCP Hub 来源记录不可读，将继续读取服务配置'); }
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
    const source = { id, name: '配置文件 · ' + safeName, files: [{ path: safeName, state: 'read', count: rows.length }], candidates };
    this.sourceGroups.push(source);
    return this.presentSources([source]);
  }
  reveal(body) {
    const current = body.candidateId ? this.candidates.get(body.candidateId)?.entry : this.descriptor().value?.servers?.[body.originalName];
    if (!current) fail('CANDIDATE_STALE', '配置已失效，请重新打开编辑窗口');
    if (!['env','headers','args'].includes(body.field)) fail('FIELD_UNSUPPORTED', '不支持读取此字段');
    const value = current[body.field]?.[body.key];
    if (typeof value !== 'string') fail('CONFIG_INVALID', '未找到配置值');
    return { value };
  }
  async presentSources(sources) {
    const existing = this.descriptor().value?.servers ?? {};
    const existingHashes = new Map();
    for (const [name, entry] of Object.entries(existing)) {
      try { existingHashes.set(connectionFingerprint((await preflight(name, entry, this.preflightOptions())).entry), name); }
      catch { /* one unreadable stored entry must not break the import list */ }
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
          hash = connectionFingerprint(checked.entry);
        } catch (error) {
          candidates.push({ ...candidate, entry: redact(candidate.entry ?? {}), issues: [...new Set([...(candidate.issues ?? []), '无法校验此配置：' + (error?.message ?? '未知错误')])], duplicate: undefined, duplicateSource: undefined, nameConflict: false });
          continue;
        }
        const duplicate = existingHashes.get(hash);
        const duplicateSource = all.get(hash);
        all.set(hash, source.name);
        candidates.push({ ...candidate, entry: redact(candidate.entry), duplicate, duplicateSource, nameConflict: Object.hasOwn(existing, candidate.name) && !duplicate });
      }
      presented.push({ ...source, candidates });
    }
    return { sources: presented };
  }
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
    const checks = [probe.ok
      ? { label: 'MCP 握手与工具发现', ok: true, detail: `已连接 ${probe.serverInfo?.name ?? name}，发现 ${probe.toolNames?.length ?? 0} 个工具${probe.truncated ? '（列表已截断）' : ''}${elapsed}` }
      : { label: 'MCP 握手与工具发现', ok: false, detail: `${probe.stage === 'list' ? '工具列表阶段' : '连接阶段'}失败：${probe.message ?? '未知原因'}${elapsed}` }];
    const cleaned = probe.closeConfirmed === true && !probe.cleanupError;
    checks.push({ label: '测试连接已关闭', ok: cleaned, detail: cleaned ? '未改动正在运行的服务实例' : (probe.cleanupError ? '测试清理未完成：' + probe.cleanupError : '测试清理未确认，请检查服务进程') });
    return { ok: probe.ok === true && cleaned, checks, stage: probe.stage, durationMs: probe.durationMs };
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
      if (!Number.isInteger(body.revision) || body.revision !== form.revision) fail('REVISION_CONFLICT', '配置已发生变化，请刷新列表并重新核对后保存');
      const entries = form.value?.servers ?? {};
      const exists = Object.hasOwn(entries, body.name);
      if (body.action === 'bulk') return this.bulk(body, form, entries);
      if (body.action === 'save') {
        const renamed = Boolean(body.originalName && body.originalName !== body.name);
        // 编辑/改名时按原名确认条目仍在；新增时才需要新名字未被占用。
        if (body.originalName && !Object.hasOwn(entries, body.originalName)) fail('CANDIDATE_STALE', '服务已被删除，请刷新后重试');
        if (renamed && Object.hasOwn(form.base?.servers ?? {}, body.originalName)) fail('INHERITED_ROW', '继承配置中的服务不能改名，只能停用');
        const runtime = this.ctx.mcpManager.list();
        const conflict = Object.hasOwn(entries, body.name) || runtime.some(row => row.name === body.name);
        if (renamed ? conflict : !body.originalName && conflict) fail('NAME_TAKEN', '已有同名服务器，请修改名称');
        const { entry, candidate } = this.draft(body, entries);
        const checked = await preflight(body.name, entry, this.preflightOptions());
        if (candidate?.issues.length && !body.acceptUnsupported) fail('CONFIG_INVALID', '请先确认来源配置中的未迁移字段');
        // 硬约束即使在「保存为停用」时也必须通过，否则会把非法条目交给官方校验。
        if (checked.checks.some(check => check.hard && !check.ok)) return { ok: false, saved: false, checks: checked.checks, variables: checked.variables };
        if (!checked.ok && body.mode !== 'draft') return { ok: false, saved: false, checks: checked.checks, variables: checked.variables };
        // Never claim success merely because the profile accepted the write.
        const next = { ...checked.entry, enabled: body.mode !== 'draft' && entry.enabled !== false };
        const previousStatus = runtime.find(row => row.name === (body.originalName ?? body.name))?.status;
        const changed = renamed || !includesConfig(entries[body.name], next);
        // 改名在同一个 revision 里一次提交：先写新键，再删旧键。
        const ops = renamed
          ? [{ op: 'set', path: ['servers', body.name], value: next }, { op: 'unset', path: ['servers', body.originalName] }]
          : [{ op: 'set', path: ['servers', body.name], value: next }];
        await this.write(form, ops, next);
        const warnings = [];
        if (renamed) {
          if (this.origins[body.originalName]) { this.origins[body.name] = this.origins[body.originalName]; delete this.origins[body.originalName]; }
          try { await this.persistMeta(); } catch { warnings.push('配置已保存，但来源记录未能写入'); }
        }
        if (candidate) {
          this.origins[body.name] = { app: candidate.source, path: candidate.sourcePath, importedAt: new Date().toISOString() };
          try { await this.persistMeta(); } catch { warnings.push('配置已保存，但来源记录未能写入'); }
        }
        if (!next.enabled) return { ok: false, saved: true, draft: true, checks: checked.checks, variables: checked.variables, warnings };
        // 写入与验证分开：写成功即返回，验证在后台继续，结果通过 list().verification 回报。
        this.startVerification(body.name, next, changed ? previousStatus?.connectedAt : undefined);
        return { ok: true, saved: true, verifying: true, renamed, entry: redact(next), checks: [...checked.checks, { label: '配置已保存', ok: true, detail: '正在后台验证正式连接与工具注册，结果会显示在服务列表' }], warnings };
      }
      if (!exists) fail('NOT_WRITABLE', '此服务由其他插件管理，无法在此修改');
      if (body.action === 'remove') {
        if (Object.hasOwn(form.base?.servers ?? {}, body.name)) fail('INHERITED_ROW', '此服务来自继承配置，只能停用');
        await this.write(form, [{ op: 'unset', path: ['servers', body.name] }], entries[body.name]);
        delete this.origins[body.name];
        delete this.lastVerifications[body.name];
        this.verifications.delete(body.name);
        await this.persistMeta();
        return { ok: true };
      }
      if (body.action === 'toggle') {
        if (typeof body.enabled !== 'boolean') fail('REQUEST_INVALID', '缺少启停状态');
        await this.write(form, [{ op: 'set', path: ['servers', body.name, 'enabled'], value: body.enabled }], entries[body.name]);
        return { ok: true };
      }
      if (body.action === 'restart') {
        await this.ctx.mcpManager.restart(body.name);
        this.notify();
        return { ok: true };
      }
      fail('UNSUPPORTED_ACTION', '不支持的操作');
    });
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
      const ops = requested
        .filter(name => Object.hasOwn(entries, name))
        .filter(name => (entries[name].enabled !== false) !== enable)
        .map(name => ({ op: 'set', path: ['servers', name, 'enabled'], value: enable }));
      if (!ops.length) return { ok: true, affected: 0 };
      await this.write(form, ops, undefined);
      return { ok: true, affected: ops.length };
    }
    fail('UNSUPPORTED_ACTION', '不支持的批量操作');
  }
  /**
   * 后台验证正式连接与工具注册。不占用写队列：保存立即返回，状态由 list() 的
   * verification 字段回报，并订阅 mcp-manager/status 以便第一时间结算。
   */
  startVerification(name, expected, previousConnectedAt) {
    this.cancelVerification(name, '已被新的保存请求取代');
    // 条目显式声明了更长的启动预算时跟着放宽，避免比官方客户端的超时更早判失败。
    const declared = expected.startupTimeoutMs;
    const budget = Math.max(this.waitMs, declared ? declared + 20000 : 0);
    const record = { name, state: 'verifying', expected, previousConnectedAt, startedAt: Date.now(), deadline: Date.now() + budget, detail: undefined };
    this.verifications.set(name, record);
    this.statusWatchers.add(record);
    record.timer = setInterval(() => this.checkVerification(record), Math.max(10, this.intervalMs));
    record.timer.unref?.();
    this.checkVerification(record);
    return record;
  }
  /**
   * A throw here used to escape a bare `setInterval` and, through DSH's fail-loud
   * handler, exit the whole Host. Verification reads nothing but the manager's
   * in-memory view until it is about to decide, so it stays cheap as well as safe.
   */
  checkVerification(record) {
    if (record.state !== 'verifying') return;
    try { this.evaluateVerification(record); }
    catch (error) {
      this.ctx.logger?.warn?.('MCP Hub 读取连接状态失败', error);
      this.finishVerification(record, 'failed', '读取连接状态失败，请刷新后重试');
    }
  }
  evaluateVerification(record) {
    if (this.closed) return this.finishVerification(record, 'cancelled', '配置服务已关闭，验证已取消');
    if (Date.now() > record.deadline) return this.finishVerification(record, 'failed', '等待正式连接或工具注册超时，请查看诊断后重试');
    const name = record.name;
    const live = this.ctx.mcpManager.list().find(row => row.name === name);
    if (!live || live.configured === false) return this.finishVerification(record, 'failed', '验证期间条目已被移除，请刷新后查看最新状态');
    const status = live.status;
    if (status?.state === 'disabled') return this.finishVerification(record, 'cancelled', '服务已停用，验证结束');
    if (status?.state === 'failed' || status?.state === 'waiting-credentials') {
      if (!this.stillExpected(name, record.expected)) return this.finishVerification(record, 'failed', '验证期间配置已被修改，请刷新后查看最新状态');
      return this.finishVerification(record, 'failed', status.state === 'waiting-credentials' ? '缺少 DSH 凭证，请补全后重新验证' : this.safeError(diagnostic(status), record.expected));
    }
    if (status?.state === 'connected') {
      const fresh = record.previousConnectedAt === undefined || status.connectedAt !== record.previousConnectedAt;
      if (fresh && Number.isInteger(status.toolCount)) {
        const registered = this.tools(name).length;
        if (registered === status.toolCount) {
          if (!this.stillExpected(name, record.expected)) return this.finishVerification(record, 'failed', '验证期间配置已被修改，请刷新后查看最新状态');
          return this.finishVerification(record, 'ok', `DSH 已连接，已注册 ${registered} 个工具`);
        }
        record.detail = `已连接，正在同步工具（${registered}/${status.toolCount}）`;
        return;
      }
    }
    record.detail = status?.state === 'reconnecting' ? `第 ${status.attempt ?? 0}/${status.maxAttempts ?? '?'} 次重试` : '正在连接…';
  }
  /** The stored entry still equals what this verification expects. */
  stillExpected(name, expected) {
    const current = this.descriptor({ fresh: true }).value?.servers?.[name];
    return Boolean(current) && includesConfig(current, expected);
  }
  finishVerification(record, state, detail) {
    if (record.state !== 'verifying') return;
    clearInterval(record.timer);
    this.statusWatchers.delete(record);
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
    for (const record of [...this.statusWatchers]) if (record.name === name) this.checkVerification(record);
    this.notify();
  }
  /** Serialized: verification results and origin updates must never interleave two renames. */
  persistMeta() {
    if (!this.metaPath) return Promise.resolve();
    const run = async () => {
      await mkdir(dirname(this.metaPath), { recursive: true, mode: 0o700 });
      const payload = { version: META_VERSION, origins: this.origins, verifications: this.lastVerifications };
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
    for (const waiter of [...this.waiters]) waiter();
    this.waiters.clear();
  }
}