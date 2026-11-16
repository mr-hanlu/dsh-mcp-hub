import { hostname, homedir } from 'node:os';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { testConnection } from './probe.js';
import { parseEditorDocument } from '../shared/mcp-config.js';
import { MASK, connectionFingerprint, fingerprint, includesConfig, preflight, redact, restoreMasked, scanSources } from './config.js';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const diagnostic = status => typeof status?.lastError === 'string' ? status.lastError : status?.reason || status?.state || '状态未知';

export class HubService {
  constructor(ctx, options = {}) {
    this.ctx = ctx;
    this.home = options.home ?? homedir();
    this.env = options.env ?? process.env;
    this.waitMs = options.waitMs ?? 45000;
    this.intervalMs = options.intervalMs ?? 250;
    this.candidates = new Map();
    this.sourceGroups = [];
    this.tail = Promise.resolve();
    this.closed = false;
    this.probeLifetime = new AbortController();
    const profile = ctx.profileContext;
    this.metaPath = options.metaPath ?? (profile?.home ? join(profile.home, 'mcp-hub', profile.name, 'sources.json') : null);
    this.origins = Object.create(null);
  }
  async init() {
    if (this.metaPath) {
      try { this.origins = Object.assign(Object.create(null), JSON.parse(await readFile(this.metaPath, 'utf8'))); }
      catch (error) { if (error.code !== 'ENOENT') this.ctx.logger?.warn('MCP Hub 来源记录不可读，将继续读取服务配置'); }
    }
    return this;
  }
  descriptor() {
    const forms = this.ctx.settings.describe();
    const entries = this.ctx.configEditor?.entries?.() ?? this.ctx.get?.('loader')?.entries?.() ?? [];
    const entry = [...entries].find(row => row.options?.name === '@deepseek-ai/dsh-mcp-manager');
    const id = entry?.options?.id;
    const form = forms.find(row => row.ns === id) ?? forms.find(row => ['mcp-manager', 'mcp'].includes(row.ns) && row.value?.servers);
    if (!form) throw new Error('未找到官方 MCP Manager 的可写配置，请先启用 DSH MCP Manager');
    return form;
  }
  tools(name) {
    const prefix = `mcp__${name}__`;
    return this.ctx.tools.schemas().filter(tool => tool.name.startsWith(prefix)).map(tool => ({ name: tool.name.slice(prefix.length), fullName: tool.name, description: tool.description ?? '', schema: tool.parameters ?? tool.inputSchema ?? {} }));
  }
  async list() {
    const form = this.descriptor();
    const entries = form.value?.servers ?? {};
    const runtime = this.ctx.mcpManager.list();
    const names = [...new Set([...Object.keys(entries), ...runtime.map(row => row.name)])];
    return {
      revision: form.revision, namespace: form.ns,
      location: { hostname: hostname(), home: this.home, platform: process.platform },
      servers: names.map(name => {
        const entry = entries[name];
        const live = runtime.find(row => row.name === name);
        const owned = Object.hasOwn(entries, name);
        const status = live?.status ?? { state: entry?.enabled === false ? 'disabled' : 'connecting' };
        return {
          name, entry: entry ? redact(entry) : null,
          status: { state: status.state, toolCount: status.toolCount, connectedAt: status.connectedAt, reason: status.reason, lastError: ['failed', 'reconnecting', 'waiting-credentials'].includes(status.state) ? this.safeError(diagnostic(status), entry) : undefined },
          editable: owned, removable: owned && !Object.hasOwn(form.base?.servers ?? {}, name),
          source: this.origins[name] ?? { app: owned ? 'DSH 配置' : '插件注册' },
          tools: this.tools(name),
        };
      }),
    };
  }
  safeError(error, entry) {
    let text = String(error?.message ?? error);
    const secrets = [];
    for (const field of ['env', 'headers']) secrets.push(...Object.values(entry?.[field] ?? {}));
    secrets.push(...(entry?.args ?? []));
    if (entry?.url) { try { const url = new URL(entry.url); secrets.push(url.password, url.username, ...url.searchParams.values()); } catch {} }
    for (const value of secrets.filter(v => typeof v === 'string' && v.length > 0).sort((a,b) => b.length-a.length)) text = text.split(value).join('[隐藏]');
    return text.slice(0, 1200);
  }
  async scan() {
    const sources = await scanSources({ home: this.home, env: this.env });
    this.sourceGroups = [...sources, ...this.sourceGroups.filter(source => source.id.startsWith('file-'))];
    this.candidates.clear();
    return this.sources();
  }
  sources() { return this.presentSources(this.sourceGroups); }
  async parseFile({ text, filename }) {
    if (typeof text !== 'string' || typeof filename !== 'string') throw new Error('缺少配置文件内容');
    const safeName = filename.split(/[\\/]/).at(-1).slice(0, 180);
    const rows = parseEditorDocument(text, safeName.replace(/\.(?:jsonc?|toml)$/i,''), safeName);
    const id = 'file-' + randomUUID();
    const candidates = rows.map(row => ({ ...row, id: randomUUID(), source: '配置文件', sourcePath: safeName }));
    const source = { id, name: '配置文件 · ' + safeName, files: [{ path: safeName, state: 'read', count: rows.length }], candidates };
    this.sourceGroups.push(source);
    return this.presentSources([source]);
  }
  reveal(body) {
    const current = body.candidateId ? this.candidates.get(body.candidateId)?.entry : this.descriptor().value?.servers?.[body.originalName];
    if (!current) throw new Error('配置已失效，请重新打开编辑窗口');
    if (!['env','headers','args'].includes(body.field)) throw new Error('不支持读取此字段');
    const value = current[body.field]?.[body.key];
    if (typeof value !== 'string') throw new Error('未找到配置值');
    return { value };
  }
  async presentSources(sources) {
    const existing = this.descriptor().value?.servers ?? {};
    const existingHashes = new Map();
    for (const [name, entry] of Object.entries(existing)) existingHashes.set(connectionFingerprint((await preflight(name, entry, {home:this.home,env:this.env})).entry), name);
    const all = new Map();
    const presented = [];
    for (const source of sources) {
      const candidates = [];
      for (const candidate of source.candidates) {
        this.candidates.set(candidate.id, candidate);
        const checked = await preflight(candidate.name, candidate.entry, {home:this.home,env:this.env});
        const hash = connectionFingerprint(checked.entry);
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
    if (body.candidateId && !candidate) throw new Error('扫描结果已失效，请重新扫描后再添加');
    const previous = body.originalName ? current?.[body.originalName] : candidate?.entry ?? {};
    if (!body.entry || typeof body.entry !== 'object' || Array.isArray(body.entry)) throw new Error('缺少配置');
    const next = restoreMasked(body.entry, previous);
    if (JSON.stringify(next).includes(MASK)) throw new Error('请重新填写隐藏字段');
    return { entry: next, candidate };
  }
  async validate(body) {
    const form = this.descriptor();
    const { entry, candidate } = this.draft(body, form.value?.servers);
    const result = await preflight(body.name, entry, { home: this.home, env: this.env });
    if (candidate?.issues.length && !body.acceptUnsupported) result.checks.push({ label: '来源配置兼容性', ok: false, detail: candidate.issues.join('；') + '。请核对并确认不迁移这些字段' });
    return { ok: result.checks.every(row => row.ok), checks: result.checks, variables: result.variables };
  }
  async test(body, signal) {
    const current = this.descriptor().value?.servers;
    const { entry, candidate } = this.draft(body, current);
    if (candidate?.issues.length && !body.acceptUnsupported) return {ok:false, checks:[{label:'来源配置兼容性',ok:false,detail:'请先核对未迁移字段'}]};
    const lifetime = signal ? AbortSignal.any([signal, this.probeLifetime.signal]) : this.probeLifetime.signal;
    return testConnection(this.probeContext ?? this.ctx, body.name, entry, { home: this.home, env: this.env, signal: lifetime });
  }
  serialize(fn) {
    const result = this.tail.then(() => { if (this.closed) throw new Error('配置服务已关闭，请刷新后重试'); return fn(); });
    this.tail = result.catch(() => {});
    return result;
  }
  async mutate(body) {
    return this.serialize(async () => {
      const form = this.descriptor();
      if (!Number.isInteger(body.revision) || body.revision !== form.revision) throw new Error('配置已发生变化，请刷新列表并重新核对后保存');
      const entries = form.value?.servers ?? {};
      const exists = Object.hasOwn(entries, body.name);
      if (body.action === 'save') {
        if (body.originalName && body.originalName !== body.name) throw new Error('第一版不支持重命名已有服务，请保持原名');
        if (body.originalName && !exists) throw new Error('服务已被删除，请刷新后重试');
        if (!body.originalName && (exists || this.ctx.mcpManager.list().some(row => row.name === body.name))) throw new Error('已有同名服务器，请修改名称');
        const { entry, candidate } = this.draft(body, entries);
        const checked = await preflight(body.name, entry, { home: this.home, env: this.env });
        if (candidate?.issues.length && !body.acceptUnsupported) throw new Error('请先确认来源配置中的未迁移字段');
        if (!checked.ok && body.mode !== 'draft') return { ok: false, saved: false, checks: checked.checks, variables: checked.variables };
        // Never claim success merely because the profile accepted the write.
        const next = { ...checked.entry, enabled: body.mode !== 'draft' && entry.enabled !== false };
        const previousStatus = this.ctx.mcpManager.list().find(row => row.name === body.name)?.status;
        const changed = !includesConfig(entries[body.name], next);
        await this.ctx.settings.mutate(form.ns, [{ op: 'set', path: ['servers', body.name], value: next }], form.revision);
        const warnings = [];
        if (candidate) {
          this.origins[body.name] = { app: candidate.source, path: candidate.sourcePath, importedAt: new Date().toISOString() };
          try { await this.persistOrigins(); } catch { warnings.push('配置已保存，但来源记录未能写入'); }
        }
        if (!next.enabled) return { ok: false, saved: true, draft: true, checks: checked.checks, variables: checked.variables, warnings };
        try {
          await this.waitConnected(body.name, next, changed ? previousStatus?.connectedAt : undefined);
          return { ok: true, saved: true, checks: [...checked.checks, { label: '正式连接与工具注册', ok: true, detail: 'DSH 已连接，工具已同步' }], warnings };
        } catch (error) {
          // Leave the failed configuration visible and editable; do not repeatedly spawn it.
          const latest = this.descriptor();
          if (!this.closed && includesConfig(latest.value?.servers?.[body.name], next)) {
            await this.ctx.settings.mutate(latest.ns, [{ op: 'set', path: ['servers', body.name, 'enabled'], value: false }], latest.revision).catch(() => warnings.push('配置被其他操作修改，未自动停用'));
          }
          return { ok: false, saved: true, checks: [...checked.checks, { label: '正式连接与工具注册', ok: false, detail: this.safeError(error, next) }], warnings };
        }
      }
      if (!exists) throw new Error('此服务由其他插件管理，无法在此修改');
      if (body.action === 'remove') {
        if (Object.hasOwn(form.base?.servers ?? {}, body.name)) throw new Error('此服务来自继承配置，只能停用');
        await this.ctx.settings.mutate(form.ns, [{ op: 'unset', path: ['servers', body.name] }], form.revision);
        delete this.origins[body.name];
        await this.persistOrigins();
        return { ok: true };
      }
      if (body.action === 'toggle') {
        if (typeof body.enabled !== 'boolean') throw new Error('缺少启停状态');
        await this.ctx.settings.mutate(form.ns, [{ op: 'set', path: ['servers', body.name, 'enabled'], value: body.enabled }], form.revision);
        return { ok: true };
      }
      if (body.action === 'restart') {
        await this.ctx.mcpManager.restart(body.name);
        return { ok: true };
      }
      throw new Error('不支持的操作');
    });
  }
  async waitConnected(name, expected, previousConnectedAt) {
    const until = Date.now() + this.waitMs;
    let effective;
    while (Date.now() < until) {
      if (this.closed) throw new Error('配置服务已关闭，验证已取消');
      const current = this.descriptor().value?.servers?.[name];
      if (!current || current.enabled === false || !includesConfig(current, expected)) throw new Error('验证期间配置已被修改，请刷新后重试');
      if (effective && fingerprint(current) !== effective) throw new Error('验证期间配置已被修改，请刷新后重试');
      effective = fingerprint(current);
      const status = this.ctx.mcpManager.list().find(row => row.name === name)?.status;
      if (status?.state === 'failed' || status?.state === 'waiting-credentials') throw new Error(status.state === 'waiting-credentials' ? '缺少 DSH 凭证，请补全后重新验证' : diagnostic(status));
      if (status?.state === 'connected' && (previousConnectedAt === undefined || status.connectedAt !== previousConnectedAt) && Number.isInteger(status.toolCount) && this.tools(name).length === status.toolCount) return;
      await delay(this.intervalMs);
    }
    throw new Error('等待正式连接或工具注册超时，请查看诊断后重试');
  }
  async persistOrigins() {
    if (!this.metaPath) return;
    await mkdir(dirname(this.metaPath), { recursive: true, mode: 0o700 });
    const tmp = this.metaPath + '.' + randomUUID() + '.tmp';
    await writeFile(tmp, JSON.stringify(this.origins, null, 2), { mode: 0o600 });
    await rename(tmp, this.metaPath);
  }
  close() { this.closed = true; this.probeLifetime.abort(); }
}
