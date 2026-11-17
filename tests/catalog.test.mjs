import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCatalog, installOptions, suggestedServiceName } from '../src/host/catalog.js';

const npmServer = {
  name: 'io.github.acme/filesystem',
  title: 'Acme Filesystem',
  version: '1.2.3',
  repository: { url: 'https://github.com/acme/filesystem' },
  websiteUrl: 'https://acme.example/filesystem',
  icons: [{ src: 'https://acme.example/icon.png', mimeType: 'image/png', sizes: ['96x96'] }],
  packages: [{
    registryType: 'npm',
    identifier: '@acme/filesystem',
    version: '1.2.3',
    runtimeHint: 'npx',
    runtimeArguments: [{ type: 'named', name: '--yes' }],
    packageArguments: [{ type: 'positional', value: '/tmp' }],
    environmentVariables: [
      { name: 'ACME_TOKEN', isRequired: true, isSecret: true },
      { name: 'ACME_MODE', value: 'safe' },
    ],
  }],
  remotes: [
    { type: 'streamable-http', url: 'https://files.example.com/mcp', headers: [{ name: 'Authorization', isRequired: true, isSecret: true }] },
    { type: 'sse', url: 'https://files.example.com/sse', headers: [] },
  ],
};

test('registry names become short legal DSH aliases', () => {
  assert.equal(suggestedServiceName('io.github.acme/filesystem'), 'filesystem');
  assert.equal(suggestedServiceName('com.example/my server!'), 'my-server');
  assert.equal(suggestedServiceName('!!!'), 'mcp-server');
});

test('npm packages map to npx with runtime and package arguments', () => {
  const install = installOptions(npmServer);
  assert.equal(install.name, 'filesystem');
  assert.equal(install.canInstall, true);
  assert.equal(install.options.length, 2);
  const npm = install.options.find(option => option.kind === 'package');
  assert.equal(npm.entry.transport, 'stdio');
  assert.equal(npm.entry.command, 'npx');
  assert.deepEqual(npm.entry.args, ['--yes', '@acme/filesystem@1.2.3', '/tmp']);
  assert.equal(npm.entry.env.ACME_TOKEN, '');
  assert.equal(npm.entry.env.ACME_MODE, 'safe');
  assert.equal(npm.entry.enabled, true);
  assert.ok(npm.warnings.some(warning => /ACME_TOKEN/.test(warning)));
  const remote = install.options.find(option => option.kind === 'remote');
  assert.equal(remote.entry.transport, 'streamable-http');
  assert.equal(remote.entry.url, 'https://files.example.com/mcp');
  assert.equal(remote.entry.headers.Authorization, '');
  assert.ok(install.warnings.some(warning => /ACME_TOKEN/.test(warning)));
  assert.ok(install.unsupported.some(line => /SSE/.test(line)));
});

test('pypi and oci packages use their native runtimes', () => {
  const server = { name: 'io.github.acme/tools', packages: [
    { registryType: 'pypi', identifier: 'acme-tools', version: '2.0.0' },
    { registryType: 'oci', identifier: 'ghcr.io/acme/tools', version: '2.0.0' },
    { registryType: 'mcpb', identifier: 'acme.mcpb', version: '2.0.0' },
  ] };
  const install = installOptions(server);
  assert.deepEqual(install.options.map(option => option.entry.command), ['uvx', 'docker']);
  assert.deepEqual(install.options[0].entry.args, ['acme-tools@2.0.0']);
  assert.deepEqual(install.options[1].entry.args, ['run', '-i', '--rm', 'ghcr.io/acme/tools:2.0.0']);
  assert.ok(install.unsupported.some(line => /mcpb/.test(line)));
});

test('search filters inactive entries and keeps the next cursor', async () => {
  const calls = [];
  const payload = { servers: [
    { server: { name: 'io.github.acme/one', description: 'One', version: '1.0.0', websiteUrl: 'https://one.example', icons: [{ src: 'https://one.example/icon.png' }] }, _meta: { 'io.modelcontextprotocol.registry/official': { status: 'active', publishedAt: '2026-01-02T00:00:00Z', updatedAt: '2026-02-03T00:00:00Z' } } },
    { server: { name: 'io.github.acme/two', description: 'Two', version: '1.0.0' }, _meta: { 'io.modelcontextprotocol.registry/official': { status: 'deleted' } } },
    { server: { name: 'io.github.acme/three', description: 'Three', version: '1.0.0' } },
  ], metadata: { nextCursor: 'next-page' } };
  const catalog = createCatalog({ baseUrl: 'https://registry.example', cacheMs: 0, fetchImpl: async url => { calls.push(String(url)); return { ok: true, status: 200, json: async () => payload }; } });
  const result = await catalog.search({ query: 'acme', limit: 5 });
  assert.equal(result.items.length, 2);
  assert.equal(result.nextCursor, 'next-page');
  assert.equal(result.items[0].name, 'io.github.acme/one');
  assert.equal(result.items[0].websiteUrl, 'https://one.example');
  assert.equal(result.items[0].icon, 'https://one.example/icon.png');
  assert.equal(result.items[0].publishedAt, '2026-01-02T00:00:00Z');
  assert.equal(result.items[0].updatedAt, '2026-02-03T00:00:00Z');
  assert.ok(calls[0].includes('/v0/servers?'));
  assert.ok(calls[0].includes('search=acme'));
  assert.ok(calls[0].includes('limit=5'));
});

test('detail requests encode the registry name and include install options', async () => {
  let requested = '';
  const catalog = createCatalog({ baseUrl: 'https://registry.example', cacheMs: 0, fetchImpl: async url => { requested = String(url); return { ok: true, status: 200, json: async () => ({ server: npmServer, _meta: { 'io.modelcontextprotocol.registry/official': { updatedAt: '2026-03-04T00:00:00Z' } } }) }; } });
  const result = await catalog.detail({ name: 'io.github.acme/filesystem' });
  assert.ok(requested.includes('/v0/servers/io.github.acme%2Ffilesystem/versions/latest'));
  assert.equal(result.item.name, 'io.github.acme/filesystem');
  assert.equal(result.item.websiteUrl, 'https://acme.example/filesystem');
  assert.equal(result.item.icon, 'https://acme.example/icon.png');
  assert.equal(result.item.updatedAt, '2026-03-04T00:00:00Z');
  assert.equal(result.install.options.length, 2);
});

test('catalog failures are reported as catalog errors', async () => {
  const catalog = createCatalog({ baseUrl: 'https://registry.example', cacheMs: 0, fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }) });
  await assert.rejects(() => catalog.search({}), error => error.code === 'CATALOG_UNAVAILABLE');
});

test('search and detail responses are cached', async () => {
  let count = 0;
  const catalog = createCatalog({ baseUrl: 'https://registry.example', fetchImpl: async () => { count += 1; return { ok: true, status: 200, json: async () => ({ servers: [], metadata: {} }) }; } });
  await catalog.search({ query: 'x' });
  await catalog.search({ query: 'x' });
  assert.equal(count, 1);
});
