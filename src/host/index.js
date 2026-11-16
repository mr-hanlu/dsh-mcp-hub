import { HubService } from './service.js';

export const name = 'dsh-mcp-hub';
export const inject = ['connection'];
const PREFIX = '/api/dsh-mcp-hub';

export function createHandler(getService, route) {
  return async request => {
    const send = (status, body) => Response.json(body, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
    const service = getService();
    if (!service) return send(503, { error: 'MCP Hub 等待官方 MCP Manager、Settings 和工具服务，请检查 DSH 版本及插件状态' });
    try {
      if (route === 'servers') return send(200, await service.list());
      if (route === 'sources') return send(200, await service.sources());
      if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) throw new Error('需要 JSON 请求');
      const text = await request.text();
      if (Buffer.byteLength(text) > 1024 * 1024) throw new Error('配置内容过大');
      const body = JSON.parse(text);
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('无效请求');
      if (route === 'scan') return send(200, await service.scan());
      if (route === 'parse') return send(200, await service.parseFile(body));
      if (route === 'validate') return send(200, await service.validate(body));
      if (route === 'test') return send(200, await service.test(body, request.signal));
      if (route === 'reveal') return send(200, service.reveal(body));
      if (route === 'mutate') return send(200, await service.mutate(body));
      return send(404, { error: '接口不存在' });
    } catch (error) {
      const message = String(error?.message ?? '操作失败');
      return send(400, { error: /^(配置|未找到|已有|此服务|第一版|服务已|扫描结果|隐藏值|请|缺少|不支持|需要|无效)/.test(message) ? message : '操作失败，请检查配置和 DSH 状态后重试' });
    }
  };
}

export function apply(ctx) {
  let service;
  ctx.inject(['settings', 'mcpManager', 'tools', 'profileContext', 'configEditor'], async child => {
    const next = await new HubService(child).init();
    service = next;
    child.inject(['credentials'], credentialContext => {
      next.probeContext = credentialContext;
      credentialContext.effect(() => () => { next.probeContext = undefined; });
    });
    child.effect(() => () => { next.close(); if (service === next) service = undefined; });
  });
  // Shared Fetch routes admit owner Peers and support browser HTTP and desktop IPC.
  for (const route of ['servers', 'sources', 'scan', 'parse', 'validate', 'test', 'reveal', 'mutate']) {
    ctx.effect(() => ctx.connection.fetch.register({
      path: PREFIX + '/' + route,
      methods: [['servers','sources'].includes(route) ? 'GET' : 'POST'],
      requestBody: 'buffered',
      fetch: createHandler(() => service, route),
    }), 'MCP Hub ' + route);
  }
}
