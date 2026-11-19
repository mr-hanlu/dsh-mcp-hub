/**
 * 可选端到端验收：真实公网 MCP 服务（默认为 DeepWiki 的 Streamable HTTP 端点）。
 * 与本地 fixture 不同，这条路径会真正走 DNS、TLS、公网握手和服务端工具列表，
 * 用于发现「只在局域网/假服务上成立」的假设。
 *
 * 默认跳过（外网不稳定，不能卡住日常测试）；显式开启：
 *   DSH_E2E_REMOTE=1 npm run test:remote
 * 可用 DSH_E2E_REMOTE_URL 换成别的公开服务。
 */
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { bootProfile, createApi, createProfile, findDsh, skip, sleep } from './support/profile.mjs';

const url = process.env.DSH_E2E_REMOTE_URL ?? 'https://mcp.deepwiki.com/mcp';
const report = [];
const step = (name, value) => report.push({ name, ...value });

async function main() {
  if (process.env.DSH_E2E_REMOTE !== '1') {
    console.log('SKIP 真实远程服务验收：设置 DSH_E2E_REMOTE=1 后运行 npm run test:remote');
    return;
  }
  const bin = findDsh();
  if (!bin) {
    skip('真实远程服务验收：本机没有可执行的 dsh（可用 DSH_BIN 指定）。');
    return;
  }
  const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
  const profile = await createProfile({ bin, repoRoot, name: 'remote' });
  let session;
  try {
    session = await bootProfile({ bin, profile: profile.name, env: profile.env });
    const call = createApi(session);
    const entry = { transport: 'streamable-http', url };

    const tested = await call('/test', { name: 'deepwiki', entry });
    assert.equal(tested.body?.ok, true, '真实服务测试连接失败：' + JSON.stringify(tested.body ?? {}).slice(0, 800));
    step('remote-test', { ok: true, url });

    const revision = (await call('/servers')).body.revision;
    const saved = await call('/mutate', { action: 'save', revision, name: 'deepwiki', entry });
    assert.equal(saved.body?.saved, true, '真实服务保存失败：' + JSON.stringify(saved.body).slice(0, 800));
    const started = Date.now();
    let row;
    for (;;) {
      row = (await call('/status')).body.servers.find(item => item.name === 'deepwiki');
      if (row?.verification && row.verification.state !== 'verifying') break;
      if (Date.now() - started > 60000) throw new Error('真实服务验证超时：' + JSON.stringify(row));
      await sleep(500);
    }
    assert.equal(row.verification.state, 'ok', '真实服务验证未通过：' + JSON.stringify(row.verification));
    step('remote-verify', { state: row.verification.state, ms: Date.now() - started, detail: row.verification.detail });

    const tools = await call('/tools', { name: 'deepwiki' });
    assert.ok((tools.body?.tools?.length ?? 0) >= 1, '真实服务没有返回工具：' + JSON.stringify(tools.body).slice(0, 500));
    step('remote-tools', { count: tools.body.tools.length });

    const current = (await call('/servers')).body;
    await call('/mutate', { action: 'remove', revision: current.revision, name: 'deepwiki' });
    console.log(JSON.stringify({ ok: true, steps: report }, null, 2));
  } finally {
    if (session) await session.stop();
    await profile.cleanup();
  }
}

main().catch(error => {
  console.error(JSON.stringify({ ok: false, steps: report, error: String(error?.message ?? error) }, null, 2));
  process.exitCode = 1;
});
