/**
 * 布局验收（页面层）：在真实插件页面上截「浅色 / 深色 / 窄窗口 / 窄窗口编辑」四张图，
 * 并断言没有横向溢出。它替代不了桌面里「DSH 主题变量」那一条（Web 构建不注入
 * `--dsw-alias-*`，这里走的是插件自带的深浅色回退），但能把纯布局问题自动化。
 *
 * 用法：npm run test:layout
 * 截图写到 tests/e2e/artifacts/layout-*.png（已在 .gitignore 里）。
 * 找不到 dsh 或 Chrome 时打印 SKIP 并以 0 退出；CI 里设 DSH_E2E_REQUIRED=1 让 SKIP 变成失败。
 */
import { dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { bootProfile, createProfile, findDsh, skip, sleep } from './support/profile.mjs';

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const fixture = repoRoot + '/tests/manual/echo-server.mjs';
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const artifacts = repoRoot + '/tests/e2e/artifacts';
const report = [];
const step = (name, value) => report.push({ name, ...value });

async function clickLabel(page, matcher, { timeoutMs = 8000 } = {}) {
  const started = Date.now();
  for (;;) {
    const clicked = await page.evaluate(source => {
      const pattern = source.startsWith('/') ? new RegExp(source.slice(1, source.lastIndexOf('/')), source.slice(source.lastIndexOf('/') + 1)) : null;
      const nodes = Array.from(document.querySelectorAll('button, [role="button"], [role="tab"], [role="menuitem"], a'));
      const match = nodes.find(node => {
        const label = (node.getAttribute('aria-label') || node.textContent || '').trim();
        return pattern ? pattern.test(label) : label === source;
      });
      if (!match) return false;
      match.click();
      return true;
    }, matcher instanceof RegExp ? `/${matcher.source}/${matcher.flags}` : matcher);
    if (clicked) { await sleep(600); return true; }
    if (Date.now() - started > timeoutMs) return false;
    await sleep(250);
  }
}

const bodyText = page => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

async function waitForText(page, matcher, { timeoutMs = 30000, label } = {}) {
  const started = Date.now();
  for (;;) {
    const text = await bodyText(page);
    if (typeof matcher === 'string' ? text.includes(matcher) : matcher.test(text)) return Date.now() - started;
    if (Date.now() - started > timeoutMs) throw new Error((label ?? '等待文本') + ' 超时：' + text.slice(-300));
    await sleep(300);
  }
}

async function pasteJson(page, value) {
  const area = await page.$('textarea');
  assert.ok(area, '编辑器里没有 textarea');
  await area.click();
  await page.evaluate(el => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(el, '');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, area);
  await area.type(value, { delay: 0 });
  await sleep(800);
}

async function openMcpHub(page) {
  if (await clickLabel(page, '继续', { timeoutMs: 2000 })) await sleep(500);
  assert.equal(await clickLabel(page, '账号菜单'), true, '找不到账号菜单');
  assert.equal(await clickLabel(page, /^设置/), true, '账号菜单里没有设置入口');
  await sleep(1200);
  assert.equal(await clickLabel(page, 'MCP Hub'), true, '设置里没有 MCP Hub 导航');
  await waitForText(page, '连接、管理你的 MCP 服务', { label: 'MCP Hub 页面标题' });
}

/** 横向溢出：整页不应出现横向滚动条。 */
const overflow = page => page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
  widest: [...document.querySelectorAll('main, section, article, div')]
    .map(node => ({ tag: node.tagName.toLowerCase(), cls: String(node.className).slice(0, 40), right: Math.round(node.getBoundingClientRect().right) }))
    .filter(node => node.right > document.documentElement.clientWidth + 1)
    .slice(0, 5),
}));

async function shoot(page, name) {
  await mkdir(artifacts, { recursive: true });
  const path = `${artifacts}/layout-${name}.png`;
  await page.screenshot({ path });
  return path;
}

async function main() {
  const bin = findDsh();
  if (!bin) { skip('布局验收：本机没有可执行的 dsh（可用 DSH_BIN 指定）。'); return; }
  if (!existsSync(CHROME)) { skip('布局验收：找不到 Chrome（可用 CHROME_PATH 指定）。'); return; }

  const { default: puppeteer } = await import('puppeteer-core');
  const profile = await createProfile({ bin, repoRoot });
  let session, browser;
  try {
    session = await bootProfile({ bin, profile: profile.name, env: profile.env });
    browser = await puppeteer.launch({
      executablePath: CHROME, headless: true, userDataDir: profile.home + '/chrome',
      args: ['--no-first-run', '--no-default-browser-check', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(session.url, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(1500);
    await openMcpHub(page);

    // 列表里至少有一行，布局才有代表性。
    assert.equal(await clickLabel(page, '添加 MCP'), true, '找不到「添加 MCP」');
    await waitForText(page, 'JSON 编辑', { label: '编辑器' });
    await pasteJson(page, JSON.stringify({ mcpServers: { layoutdemo: { command: process.execPath, args: [fixture], cwd: repoRoot } } }, null, 2));
    assert.equal(await clickLabel(page, '测试全部'), true, '找不到「测试全部」');
    await waitForText(page, /已测试 1\/1/, { label: '布局样本测试' });
    if (!(await clickLabel(page, /^添加 1 个$/))) throw new Error('找不到「添加 1 个」按钮');
    await waitForText(page, /layoutdemo.*已连接/, { label: '布局样本连接', timeoutMs: 60000 });

    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    await sleep(400);
    const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const light = await shoot(page, 'light');
    const lightOverflow = await overflow(page);
    assert.ok(lightOverflow.scrollWidth <= lightOverflow.clientWidth + 1, '浅色下出现横向溢出：' + JSON.stringify(lightOverflow.widest));
    step('light', { path: light, background: lightBg });

    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
    await sleep(500);
    const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const dark = await shoot(page, 'dark');
    assert.notEqual(darkBg, lightBg, '深浅色没有产生不同的底色，回退配色可能没生效');
    assert.ok((await overflow(page)).scrollWidth <= lightOverflow.clientWidth + 1, '深色下出现横向溢出');
    step('dark', { path: dark, background: darkBg });

    // 窄窗口：列表行与工具条都要在一屏宽度内。
    await page.setViewport({ width: 700, height: 900 });
    await sleep(600);
    const narrow = await shoot(page, 'narrow');
    const narrowOverflow = await overflow(page);
    assert.ok(narrowOverflow.scrollWidth <= narrowOverflow.clientWidth + 1, '窄窗口出现横向溢出：' + JSON.stringify(narrowOverflow.widest));
    step('narrow', { path: narrow, width: 700, scrollWidth: narrowOverflow.scrollWidth });

    // 窄窗口下的编辑窗口：环境变量行是行内元素最多的一处。
    assert.equal(await clickLabel(page, '编辑 layoutdemo'), true, '找不到「编辑 layoutdemo」');
    await waitForText(page, '编辑 MCP 服务', { label: '窄窗口编辑器' });
    assert.equal(await clickLabel(page, '表单配置'), true, '找不到「表单配置」');
    const dialog = await page.evaluate(() => {
      const node = document.querySelector('.hub-dialog');
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { width: Math.round(box.width), right: Math.round(box.right), viewport: window.innerWidth };
    });
    assert.ok(dialog && dialog.right <= dialog.viewport + 1, '窄窗口下编辑窗口超出视口：' + JSON.stringify(dialog));
    const editor = await shoot(page, 'narrow-editor');
    step('narrow-editor', { path: editor, dialog });

    console.log(JSON.stringify({ ok: true, steps: report }, null, 2));
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (session) await session.stop();
    await profile.cleanup();
  }
}

main().catch(error => {
  console.error(JSON.stringify({ ok: false, steps: report, error: String(error?.message ?? error) }, null, 2));
  process.exitCode = 1;
});
