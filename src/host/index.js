import z from '@deepseek-ai/schemastery';
import { HubService } from './service.js';
import { DEFAULT_MAX_CONFIG_BYTES } from '../shared/mcp-config.js';
import { fail, isHubError } from '../shared/errors.js';

export const name = 'dsh-mcp-hub';
export const inject = ['connection'];
const PREFIX = '/api/dsh-mcp-hub';
/** [route, method] — GET is for read-only views, POST for anything with a body. */
const ROUTES = [
  ['servers', 'GET'], ['sources', 'GET'], ['status', 'GET'],
  ['scan', 'POST'], ['parse', 'POST'], ['test', 'POST'], ['reveal', 'POST'],
  ['mutate', 'POST'], ['cancel', 'POST'], ['probe', 'POST'], ['tools', 'POST'], ['wait', 'POST'], ['source-remove', 'POST'], ['export', 'POST'],
  ['catalog-search', 'POST'], ['catalog-detail', 'POST'],
];

/** 用户可在 profile 的 cordis.patch.yml 中覆盖；patch 层跨升级保留。 */
export const Config = z.object({
  connectWaitMs: z.number().min(5000).max(600000).default(45000)
    .description('保存后等待正式连接与工具注册的基础预算（毫秒）。条目自身的 startupTimeoutMs 更大时会自动放宽'),
  probeTimeoutMs: z.number().min(2000).max(120000).default(20000)
    .description('测试连接与复诊时握手和工具发现的预算（毫秒）'),
  verifyPollMs: z.number().min(100).max(10000).default(1000)
    .description('验证期间读取运行状态的兜底间隔（毫秒）；状态事件会立即触发结算'),
  descriptorTtlMs: z.number().min(0).max(60000).default(1500)
    .description('配置视图缓存时间（毫秒）。0 表示每次都重新读取 profile 配置'),
  maxConfigBytes: z.number().min(65536).max(16 * 1024 * 1024).default(DEFAULT_MAX_CONFIG_BYTES)
    .description('单个配置文件与请求体的上限（字节）'),
  referenceStorage: z.union(['template', 'value']).default('template')
    .description('引用保存方式：template 保留 ${credential:…} 模板（推荐，配置里不出现密钥）；value 在保存时写入当前值'),
  catalogBaseUrl: z.string().default('https://registry.modelcontextprotocol.io')
    .description('官方 MCP Registry 地址；插件只读取目录，不提交任何内容'),
  catalogTimeoutMs: z.number().min(2000).max(60000).default(8000)
    .description('在线搜索与详情请求的超时时间（毫秒）'),
  catalogCacheMs: z.number().min(0).max(3600000).default(300000)
    .description('在线搜索/详情缓存时间（毫秒）；0 表示不缓存'),
});

export function createHandler(getService, route, log) {
  return async request => {
    const send = (status, body) => Response.json(body, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
    const service = getService();
    if (!service) return send(503, { error: 'MCP Hub 等待官方 MCP Manager、Settings 和工具服务，请检查 DSH 版本及插件状态', code: 'SERVICE_UNAVAILABLE' });
    try {
      if (route === 'servers') return send(200, await service.list());
      if (route === 'sources') return send(200, await service.sources());
      if (route === 'status') return send(200, service.status());
      if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) fail('REQUEST_INVALID', '需要 JSON 请求');
      const text = await request.text();
      if (Buffer.byteLength(text) > service.maxConfigBytes) fail('BODY_TOO_LARGE', '配置内容过大');
      let body;
      try { body = JSON.parse(text); } catch { fail('REQUEST_INVALID', '请求不是有效的 JSON'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) fail('REQUEST_INVALID', '无效请求');
      if (route === 'scan') return send(200, await service.scan());
      if (route === 'parse') return send(200, await service.parseFile(body));
      if (route === 'source-remove') return send(200, await service.removeSource(body.id));
      if (route === 'export') return send(200, await service.exportBackup(body));
      if (route === 'catalog-search') return send(200, await service.catalogSearch(body, request.signal));
      if (route === 'catalog-detail') return send(200, await service.catalogDetail(body, request.signal));
      if (route === 'test') return send(200, await service.test(body, request.signal));
      if (route === 'reveal') return send(200, service.reveal(body));
      if (route === 'mutate') return send(200, await service.mutate(body));
      if (route === 'cancel') return send(200, service.cancelVerification(body.name));
      if (route === 'probe') return send(200, await service.probeExisting(body, request.signal));
      if (route === 'tools') return send(200, service.toolsFor(body.name));
      if (route === 'wait') return send(200, await service.wait(body, request.signal));
      return send(404, { error: '接口不存在', code: 'NOT_FOUND' });
    } catch (error) {
      // 已知原因按 code 透出；未知异常只记日志，不把内部细节交给浏览器。
      if (isHubError(error)) return send(error.status, { error: error.message, code: error.code });
      log?.error?.(error);
      return send(500, { error: '操作失败，请检查配置和 DSH 状态后重试', code: 'INTERNAL' });
    }
  };
}

export function apply(ctx, config = {}) {
  let service;
  const options = {
    waitMs: config.connectWaitMs,
    intervalMs: config.verifyPollMs,
    descriptorTtlMs: config.descriptorTtlMs,
    maxConfigBytes: config.maxConfigBytes,
    referenceStorage: config.referenceStorage,
    probeTimeoutMs: config.probeTimeoutMs,
    catalogBaseUrl: config.catalogBaseUrl,
    catalogTimeoutMs: config.catalogTimeoutMs,
    catalogCacheMs: config.catalogCacheMs,
  };
  // Only the services this plugin cannot work without are hard dependencies.
  // `profileContext` exists only in a profile-launched Host and `configEditor` is an
  // optional editor surface: requiring them would leave every route on a permanent 503.
  ctx.inject(['settings', 'mcpManager', 'tools'], async child => {
    let profile;
    try { profile = typeof child.get === 'function' ? child.get('profileContext') : undefined; } catch { profile = undefined; }
    if (!profile) ctx.logger?.warn?.('MCP Hub 未找到 profile 上下文，来源记录将不会持久化');
    const next = await new HubService(child, { ...options, profile }).init();
    service = next;
    child.inject(['credentials'], credentialContext => {
      next.probeContext = credentialContext;
      credentialContext.effect(() => () => { next.probeContext = undefined; });
    });
    child.effect(() => () => { next.close(); if (service === next) service = undefined; });
    // 状态变化时立即结算后台验证并唤醒等待中的页面，不必等下一次兜底轮询。
    child.effect(() => child.on('mcp-manager/status', name => next.onStatus(name)), 'MCP Hub status');
  });
  // Exact Fetch routes below /api; owner Peers only. Desktop and Web both reach them over the
  // local HTTP listener — there is no separate desktop IPC channel.
  for (const [route, method] of ROUTES) {
    ctx.effect(() => ctx.connection.fetch.register({
      path: PREFIX + '/' + route,
      methods: [method],
      requestBody: 'buffered',
      fetch: createHandler(() => service, route, ctx.logger),
    }), 'MCP Hub ' + route);
  }
}