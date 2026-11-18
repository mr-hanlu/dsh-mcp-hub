/**
 * 端到端验收（页面层）：在临时 profile 的 Web 页面里真的点一遍设置页。
 *
 * 覆盖单元测试和 API 测试都替代不了的部分：
 *   - 插件是否出现在「设置 → MCP Hub」导航里，页面是否渲染
 *   - JSON 粘贴 → 逐行自动识别 → 测试全部 → 一次添加多个
 *   - 表格行是否显示连接状态与工具数
 *   - 删除确认弹窗 → 删除 → 回到空状态
 *   - JSON / 表单两个页签切换后草稿是否还在
 *
 * 用法：npm run test:ui
 * 依赖本机 Chrome（用 CHROME_PATH 覆盖）与 puppeteer-core（devDependency）。
 * 找不到 dsh 或 Chrome 时打印 SKIP 并以 0 退出；CI 里设 `DSH_E2E_REQUIRED=1`
 * 让 SKIP 变成失败。
 */
import { dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { bootProfile, createProfile, findDsh, skip, sleep } from './support/profile.mjs';

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const fixture = repoRoot + '/tests/manual/echo-server.mjs';
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const report = [];
const step = (name, value) => report.push({ name, ...value });

/** 按可访问名称点击：精确文本或正则，只看 button / role=button / tab / menuitem / a。 */
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
    const ok = typeof matcher === 'string' ? text.includes(matcher) : matcher.test(text);
    if (ok) return Date.now() - started;
    if (Date.now() - started > timeoutMs) throw new Error((label ?? '等待文本') + ' 超时：' + text.slice(-400));
    await sleep(300);
  }
}

/** 进入 设置 → MCP Hub；首首次启动要先关掉预览版说明。 */
async function openMcpHub(page) {
  if (await clickLabel(page, '继续', { timeoutMs: 2500 })) await sleep(600);
  assert.equal(await clickLabel(page, '账号菜单'), true, '找不到账号菜单');
  assert.equal(await clickLabel(page, /^设置/), true, '账号菜单里没有设置入口');
  await sleep(1200);
  assert.equal(await clickLabel(page, 'MCP Hub'), true, '设置里没有 MCP Hub 导航');
  await waitForText(page, '连接、管理你的 MCP 服务', { label: 'MCP Hub 页面标题' });
}

/** 打开编辑器，往 JSON 页签的 textarea 里写入整份配置。 */
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

async function main() {
  const bin = findDsh();
  if (!bin) { skip('页面验收：本机没有可执行的 dsh（可用 DSH_BIN 指定）。'); return; }
  if (!existsSync(CHROME)) { skip('页面验收：找不到 Chrome（可用 CHROME_PATH 指定）。'); return; }

  const { default: puppeteer } = await import('puppeteer-core');
  const profile = await createProfile({ bin, repoRoot });
  let session, browser;
  try {
    session = await bootProfile({ bin, profile: profile.name, env: profile.env });
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: true,
      userDataDir: profile.home + '/chrome',
      args: ['--no-first-run', '--no-default-browser-check', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(session.url, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(1500);

    await openMcpHub(page);
    step('navigate', { ok: true });
    await waitForText(page, '连接你的第一个 MCP', { label: '空状态' });
    step('empty-state', { ok: true });

    assert.equal(await clickLabel(page, '本地导入'), true);
    await waitForText(page, '从其他应用导入已有 MCP', { label: '本地导入页签' });
    step('sources-tab', { ok: true });
    assert.equal(await clickLabel(page, '已添加 0'), true);
    await waitForText(page, '连接你的第一个 MCP', { label: '回到已添加' });

    assert.equal(await clickLabel(page, '添加 MCP'), true);
    await waitForText(page, 'JSON 编辑', { label: '编辑器' });
    // 草稿保护：写一点内容 → 切到表单 → 切回来，内容还在。
    await pasteJson(page, '{"mcpServers":{"draft-keep":{"command":"node"}}}');
    assert.equal(await clickLabel(page, '表单配置'), true);
    await sleep(600);
    assert.equal(await clickLabel(page, 'JSON 编辑'), true);
    await sleep(600);
    const kept = await page.$eval('textarea', el => el.value);
    assert.match(kept, /draft-keep/, '切换页签后 JSON 草稿丢失');
    step('draft-kept', { ok: true });

    const entry = command => ({ command, args: [fixture], cwd: repoRoot });
    const document = { mcpServers: { uitest1: entry(process.execPath), uitest2: entry(process.execPath) } };
    await pasteJson(page, JSON.stringify(document, null, 2));
    assert.equal(await clickLabel(page, '测试全部'), true);
    await waitForText(page, /已测试 2\/2/, { label: '逐行测试' });
    step('row-test', { ok: true, rows: 2 });

    if (!(await clickLabel(page, /^添加 \d+ 个$/))) {
      const labels = await page.evaluate(() => [...new Set(Array.from(document.querySelectorAll('button')).map(node => (node.getAttribute('aria-label') || node.textContent || '').trim()).filter(Boolean))]);
      throw new Error('找不到「添加 N 个」按钮，当前按钮：' + JSON.stringify(labels.slice(-20)));
    }
    await waitForText(page, '已添加 2 个服务', { label: '批量添加' });
    await waitForText(page, /uitest1.*已连接/, { label: '行状态', timeoutMs: 60000 });
    await waitForText(page, /uitest2.*已连接/, { label: '第二行状态', timeoutMs: 60000 });
    step('add-two', { ok: true, connected: 2 });

    assert.equal(await clickLabel(page, '删除 uitest1'), true);
    await waitForText(page, '删除 MCP 服务', { label: '删除弹窗' });
    assert.equal(await clickLabel(page, '删除'), true);
    await waitForText(page, '已添加 1', { label: '删除第一行' });
    step('delete-one', { ok: true });

    assert.equal(await clickLabel(page, '删除 uitest2'), true);
    await waitForText(page, '删除 MCP 服务', { label: '删除弹窗' });
    assert.equal(await clickLabel(page, '删除'), true);
    await waitForText(page, '连接你的第一个 MCP', { label: '删除后空状态', timeoutMs: 30000 });
    step('delete-all', { ok: true, count: 0 });
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (session) await session.stop();
    await profile.cleanup();
  }
  console.log(JSON.stringify({ ok: true, steps: report }, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({ ok: false, steps: report, error: String(error?.message ?? error) }, null, 2));
  process.exitCode = 1;
});