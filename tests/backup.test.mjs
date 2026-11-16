import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, OMITTED_ARG } from '../src/shared/backup.js';
import { MASK } from '../src/shared/display.js';

const servers = [
  { name: 'github', entry: { transport: 'stdio', command: 'npx', args: ['-y', '--token', MASK, 'srv'], env: { GITHUB_TOKEN: MASK, PATH: '/usr/bin' }, headers: {} } },
  { name: 'remote', entry: { transport: 'streamable-http', url: 'https://example.com/mcp?apiKey=' + MASK, headers: { Authorization: MASK, 'X-Trace': 'abc' } } },
];

test('a backup never carries a mask placeholder into the restored configuration', () => {
  const { backup, omitted } = buildBackup(servers);
  assert.ok(!JSON.stringify(backup).includes(MASK));
  assert.equal(backup.github.env.GITHUB_TOKEN, undefined);
  assert.equal(backup.github.env.PATH, '/usr/bin');
  assert.deepEqual(backup.github.args, ['-y', '--token', OMITTED_ARG, 'srv']);
  assert.equal(backup.remote.url, 'https://example.com/mcp');
  assert.equal(backup.remote.headers.Authorization, undefined);
  assert.equal(backup.remote.headers['X-Trace'], 'abc');
  assert.deepEqual(omitted.sort(), ['github args[2]', 'github env.GITHUB_TOKEN', 'remote headers.Authorization', 'remote url?apiKey']);
});

test('servers without a readable entry are skipped', () => {
  const { backup, omitted } = buildBackup([{ name: 'broken', entry: null }, servers[0]]);
  assert.deepEqual(Object.keys(backup), ['github']);
  assert.ok(omitted.includes('github env.GITHUB_TOKEN'));
});

test('an omitted argument placeholder is not read back as a credential template', async () => {
  const { preflight } = await import('../src/host/config.js');
  const { backup } = buildBackup([servers[0]]);
  const checked = await preflight('github', backup.github, { env: {} });
  assert.equal(checked.checks.find(check => check.label === '变量引用').ok, true);
});
