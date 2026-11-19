/**
 * 端到端验收（官方 MCP Registry 边界）：用一个本地假 Registry 驱动真实 Host，
 * 覆盖搜索分页、下架项过滤、详情转换、HTTP 500、坏 JSON、超时、连接不上。
 *
 * 不访问真实 registry.modelcontextprotocol.io：网络失败不能变成 CI 的随机红灯。
 * 配置通过临时 profile 的 `cordis.patch.yml` 覆盖 `catalogBaseUrl` 指向本地端口。
 *
 * 用法：npm run test:registry
 * 需要本机有 dsh；没有时 SKIP。CI 里设 `DSH_E2E_REQUIRED=1` 让 SKIP 变成失败。
 */
import { createServer } from 'node:http';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { bootProfile, createApi, createProfile, findDsh, skip, sleep } from './support/profile.mjs';

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const report = [];
const step = (name, value) => report.push({ name, ...value });

const active = (server, extra = {}) => ({
  server,
  _meta: { 'io.modelcontextprotocol.registry/official': { status: 'active', publishedAt: '2026-01-02T00:00:00Z', updatedAt: '2026-02-03T00:00:00Z' } },
  ...extra,
});

const one = {
  name: 'io.github.acme/filesystem',
  title: 'Acme Filesystem',
  description: 'Read and write files',
  version: '1.2.3',
  websiteUrl: 'https://acme.example',
  icons: [{ src: 'https://acme.example/icon.png' }, { src: 'http://insecure.example/icon.png' }],
  repository: { url: 'https://github.com/acme/filesystem', source: 'github' },
  packages: [{
    registryType: 'npm',
    identifier: '@acme/filesystem',
    version: '1.2.3',
    runtimeHint: 'npx',
    packageArguments: [{ type: 'positional', value: '/tmp/data' }],
    environmentVariables: [{ name: 'ACME_TOKEN', isRequired: true, isSecret: true }],
  }],
  remotes: [{ type: 'sse', url: 'https://acme.example/sse' }],
};
const two = {
  name: 'io.github.acme/notes',
  title: 'Acme Notes',
  description: 'Notes over HTTP',
  version: '2.0.0',
  remotes: [{ type: 'streamable-http', url: 'https://notes.example/mcp', headers: [{ name: 'X-Api-Key', isRequired: true }] }],
};

const collect = async req => {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body;
};

async function startRegistry() {
  const calls = [];
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    calls.push({ path: url.pathname, search: url.searchParams.get('search'), cursor: url.searchParams.get('cursor') });
    const json = (status, payload) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(payload)); };
    if (url.pathname === '/v0/servers' && url.searchParams.get('search') === 'http500') return json(500, { error: 'boom' });
    if (url.pathname === '/v0/servers' && url.searchParams.get('search') === 'badjson') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{not json'); }
    if (url.pathname === '/v0/servers' && url.searchParams.get('search') === 'slow') { await sleep(3000); return json(200, { servers: [] }); }
    if (url.pathname === '/v0/servers' && url.searchParams.get('cursor') === 'page2') {
      return json(200, { servers: [active({ ...two, name: 'io.github.acme/page-two', unknownField: { nested: true } })], metadata: {} });
    }
    if (url.pathname === '/v0/servers') {
      return json(200, {
        servers: [active(one), active(two), active({ ...one, name: 'io.github.acme/retired' }, { _meta: { 'io.modelcontextprotocol.registry/official': { status: 'deleted' } } })],
        metadata: { nextCursor: 'page2' },
      });
    }
    const detail = url.pathname.match(/^\/v0\/servers\/(.+)\/versions\/latest$/);
    if (detail) {
      const name = decodeURIComponent(detail[1]);
      assert.equal(await collect(req), '', '详情请求不应带请求体');
      return json(200, { server: { ...one, name }, _meta: { 'io.modelcontextprotocol.registry/official': { updatedAt: '2026-03-04T00:00:00Z' } } });
    }
    return json(404, { error: 'not found' });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    port: server.address().port,
    calls,
    stop: () => new Promise(resolve => server.close(resolve)),
  };
}

async function main() {
  const bin = findDsh();
  if (!bin) {
    skip('Registry 验收：本机没有可执行的 dsh（可用 DSH_BIN 指定）。');
    return;
  }
  const registry = await startRegistry();
  let profile, session;
  try {
    profile = await createProfile({ bin, repoRoot, name: 'registry' });
    // 只覆盖目录地址与超时；其余配置保持默认。假 Registry 不需要缓存。
    await writeFile(join(profile.home, 'profiles', profile.name, 'cordis.patch.yml'), [
      '- id: dsh-mcp-hub',
      '  config:',
      `    catalogBaseUrl: http://127.0.0.1:${registry.port}`,
      '    catalogTimeoutMs: 2000',
      '    catalogCacheMs: 0',
      '',
    ].join('\n'));

    session = await bootProfile({ bin, profile: profile.name, env: profile.env });
    const call = createApi(session);

    const page = await call('/catalog-search', { query: '' });
    assert.equal(page.status, 200, '目录搜索失败：' + JSON.stringify(page.body));
    assert.equal(page.body.count, 2, '下架项应被过滤：' + JSON.stringify(page.body));
    assert.equal(page.body.nextCursor, 'page2');
    const filesystem = page.body.items.find(item => item.name === 'io.github.acme/filesystem');
    assert.equal(filesystem.title, 'Acme Filesystem');
    assert.equal(filesystem.version, '1.2.3');
    assert.equal(filesystem.icon, 'https://acme.example/icon.png', '图标只接受 https');
    assert.equal(filesystem.canInstall, true);
    assert.deepEqual(filesystem.transports, ['sse']);
    const notes = page.body.items.find(item => item.name === 'io.github.acme/notes');
    assert.equal(notes.canInstall, true);
    assert.equal(registry.calls.at(-1).path, '/v0/servers');
    assert.equal(registry.calls.at(-1).search, null);
    step('catalog-page-1', { count: page.body.count, nextCursor: page.body.nextCursor });

    const second = await call('/catalog-search', { query: '', cursor: 'page2' });
    assert.equal(second.status, 200);
    assert.equal(second.body.count, 1);
    assert.equal(second.body.nextCursor, null);
    assert.equal(second.body.items[0].name, 'io.github.acme/page-two', '未知字段不应让条目消失');
    step('catalog-page-2', { count: second.body.count, cursor: registry.calls.at(-1).cursor });

    const detail = await call('/catalog-detail', { name: 'io.github.acme/filesystem' });
    assert.equal(detail.status, 200, '目录详情失败：' + JSON.stringify(detail.body));
    assert.equal(detail.body.item.name, 'io.github.acme/filesystem');
    assert.equal(detail.body.install.name, 'filesystem', '服务名应取 registry 名称的最后一段');
    assert.equal(detail.body.install.canInstall, true);
    const option = detail.body.install.options.find(item => item.kind === 'package');
    assert.equal(option.entry.command, 'npx');
    assert.deepEqual(option.entry.args, ['-y', '@acme/filesystem@1.2.3', '/tmp/data']);
    assert.equal(option.entry.env.ACME_TOKEN, '');
    assert.ok(detail.body.install.warnings.some(line => /ACME_TOKEN.*密钥/.test(line)), '密钥变量应提示改用凭证引用');
    assert.ok(detail.body.install.unsupported.some(line => /SSE/.test(line)), 'SSE 远程应列为不支持');
    step('catalog-detail', { options: detail.body.install.options.length, warnings: detail.body.install.warnings.length });

    const failed = await call('/catalog-search', { query: 'http500' });
    assert.equal(failed.status, 502);
    assert.equal(failed.body.code, 'CATALOG_UNAVAILABLE');
    step('catalog-http-500', { code: failed.body.code });

    const broken = await call('/catalog-search', { query: 'badjson' });
    assert.equal(broken.status, 502);
    assert.equal(broken.body.code, 'CATALOG_INVALID');
    step('catalog-bad-json', { code: broken.body.code });

    const timedOut = await call('/catalog-search', { query: 'slow' });
    assert.equal(timedOut.status, 502);
    assert.equal(timedOut.body.code, 'CATALOG_UNAVAILABLE');
    assert.match(timedOut.body.error, /超时/);
    step('catalog-timeout', { code: timedOut.body.code });

    await registry.stop();
    const offline = await call('/catalog-search', { query: 'offline-after-stop' });
    assert.equal(offline.status, 502);
    assert.equal(offline.body.code, 'CATALOG_UNAVAILABLE');
    step('catalog-offline', { code: offline.body.code });

    console.log(JSON.stringify({ ok: true, steps: report }, null, 2));
  } finally {
    if (session) await session.stop();
    if (profile) await profile.cleanup();
    await registry.stop().catch(() => {});
  }
}

main().catch(error => {
  console.error(JSON.stringify({ ok: false, steps: report, error: String(error?.message ?? error) }, null, 2));
  process.exitCode = 1;
});