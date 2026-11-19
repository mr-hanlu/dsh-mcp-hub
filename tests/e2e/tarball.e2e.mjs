/**
 * 端到端验收（打包安装）：模拟 README 的方式 B（Release 安装）——`npm pack` 出 tarball，
 * 装进一个全新的临时 profile，确认插件层、接口和页面资源都来自压缩包，
 * 而不是「从仓库目录 link 安装」这条开发路径。
 *
 * 用法：npm run test:tarball
 * 需要本机有 dsh；没有时 SKIP。CI 里设 `DSH_E2E_REQUIRED=1` 让 SKIP 变成失败。
 */
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { bootProfile, createApi, createProfile, findDsh, runDsh, skip } from './support/profile.mjs';

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const report = [];
const step = (name, value) => report.push({ name, ...value });

async function main() {
  const bin = findDsh();
  if (!bin) {
    skip('打包验收：本机没有可执行的 dsh（可用 DSH_BIN 指定）。');
    return;
  }
  const work = await mkdtemp(join(tmpdir(), 'dsh-mcp-hub-tarball-'));
  let profile, session;
  try {
    // 先构建，再打包：压缩包里必须带页面产物；--ignore-scripts 避免 pack 里再跑一次。
    const built = spawnSync('npm', ['run', 'build'], { cwd: repoRoot, encoding: 'utf8', env: process.env });
    assert.equal(built.status, 0, '构建失败：' + (built.stderr || built.stdout).slice(-800));
    const packed = spawnSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', work, '--cache', join(work, 'npm-cache')], { cwd: repoRoot, encoding: 'utf8', env: process.env });
    assert.equal(packed.status, 0, 'npm pack 失败：' + (packed.stderr || packed.stdout).slice(-800));
    // npm 11 用「包名 → 信息」的对象；旧版是单元素数组。两种都要认。
    const manifest = JSON.parse(packed.stdout);
    const info = Array.isArray(manifest) ? manifest[0] : Object.values(manifest)[0];
    assert.ok(info?.filename, 'npm pack 没有返回 tarball 名：' + packed.stdout.slice(0, 400));
    const tarball = join(work, info.filename);
    assert.ok(info.files.some(file => file.path === 'lib/client.js'), '压缩包缺少构建后的页面代码');
    assert.ok(info.files.some(file => file.path === 'src/host/index.js'), '压缩包缺少宿主入口');
    step('pack', { tarball: info.filename, files: info.files.length });

    profile = await createProfile({ bin, repoRoot, name: 'tarball', install: false });
    const added = runDsh(bin, ['plugin', '--profile', profile.name, 'add', tarball], profile.env);
    assert.equal(added.includes('dsh-mcp-hub'), true, '安装输出里没有插件名：' + added.slice(-400));
    const dumped = runDsh(bin, ['--profile', profile.name, '--dump-config'], profile.env);
    assert.equal(dumped.includes('# == dsh-mcp-hub'), true, 'tarball 安装后组合配置里没有插件层');
    step('install', { layer: true });

    session = await bootProfile({ bin, profile: profile.name, env: profile.env });
    const call = createApi(session);
    const servers = await call('/servers');
    assert.equal(servers.status, 200, 'tarball 安装后接口不可用：' + JSON.stringify(servers.body));
    assert.equal(Array.isArray(servers.body?.servers), true);
    const status = await call('/status');
    assert.equal(status.status, 200);
    step('api', { servers: servers.body.servers.length, profile: servers.body.profile });


    console.log(JSON.stringify({ ok: true, steps: report }, null, 2));
  } finally {
    if (session) await session.stop();
    if (profile) await profile.cleanup();
    await rm(work, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(JSON.stringify({ ok: false, steps: report, error: String(error?.message ?? error) }, null, 2));
  process.exitCode = 1;
});
