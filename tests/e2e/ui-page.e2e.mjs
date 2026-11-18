/**
 * 端到端验收（页面层）：在临时 profile 的 Web 页面里真的点一遍设置页。
 *
 * 覆盖单元测试和 API 测试都替代不了的部分：
 *   - 插件是否出现在「设置 → MCP Hub」导航里，页面是否渲染
 *   - JSON 粘贴 → 逐行自动识别 → 测试全部 → 一次添加多个
 *   - 表格行是否显示连接状态与工具数
 *   - 删除确认弹窗 → 删除 → 回到空状态
 *   - JSON / 表单两个页签切换后草稿是否还在
 *   - 连接测试进行中显示进度并可取消
 *   - 已存在的同名服务在粘贴后标为跳过，只测试、只添加新服务
 *   - 连接测试失败时行内给出失败状态，且不允许添加
 *   - 环境变量引用缺失时指出缺哪一项
 *   - 编辑已有服务后保存，编辑器关闭、行内重新验证
 *   - 保存成功后编辑器自动关闭
 *   - 带明文 token 的服务保存后提示「密钥已写入 DSH 凭证」
 *   - 编辑时对凭证引用点「显示」能通过 Host 读回值
 * 失败时会往 tests/e2e/artifacts/ 留一张全页截图。
 *
 * 用法：npm run test:ui
 * 依赖本机 Chrome（用 CHROME_PATH 覆盖）与 puppeteer-core（devDependency）。
 * 找不到 dsh 或 Chrome 时打印 SKIP 并以 0 退出；CI 里设 `DSH_E2E_REQUIRED=1`
 * 让 SKIP 变成失败。
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
const report = [];
let failurePage;
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

async function waitForInputValue(page, value, { timeoutMs = 15000 } = {}) {
  const started = Date.now();
  for (;;) {
    const ok = await page.evaluate(wanted => [...document.querySelectorAll('input')].some(input => input.value === wanted && input.type === 'text' && input.readOnly), value);
    if (ok) return true;
    if (Date.now() - started > timeoutMs) return false;
    await sleep(120);
  }
}

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
    failurePage = page;
    await page.setViewport({ width: 1280, height: 900 });
    page.on('pageerror', error => console.error('PAGE-ERROR', error.message));
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

    // 连接测试取消：让一个服务一直不停握手，点「取消测试」应立即结束等待。
    await pasteJson(page, JSON.stringify({ mcpServers: { uislow: { command: process.execPath, args: [fixture], cwd: repoRoot, env: { MCP_ECHO_DELAY: '3000' } } } }, null, 2));
    assert.equal(await clickLabel(page, '测试全部'), true, '找不到「测试全部」');
    await waitForText(page, /测试中 \d+\/\d+/, { label: '测试进行中' });
    assert.equal(await clickLabel(page, '取消测试'), true, '找不到「取消测试」');
    await waitForText(page, '已取消测试', { label: '取消测试提示' });
    step('test-cancel', { ok: true });

    // 失败原因：命令立即以非零码退出，行内要显示「测试失败」且不给添加。
    await pasteJson(page, JSON.stringify({ mcpServers: { uibad: { command: '/bin/sh', args: ['-c', 'exit 3'], cwd: repoRoot } } }, null, 2));
    assert.equal(await clickLabel(page, '测试全部'), true, '找不到「测试全部」');
    await waitForText(page, '测试失败', { label: '测试失败状态', timeoutMs: 30000 });
    const addDisabled = await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll('button')).find(node => /^添加 1 个$/.test((node.textContent || '').trim()));
      return button ? button.disabled : null;
    });
    assert.equal(addDisabled, true, '测试失败后仍允许添加');
    step('test-fail-reason', { ok: true });

    // 缺失环境变量：引用不存在时测试要直接指出缺哪一项，而不是报告连接超时。
    await pasteJson(page, JSON.stringify({ mcpServers: { uienv: { command: process.execPath, args: [fixture], cwd: repoRoot, env: { TOKEN: '${env:MCP_E2E_MISSING}' } } } }, null, 2));
    assert.equal(await clickLabel(page, '测试全部'), true, '找不到「测试全部」');
    await waitForText(page, '缺少变量：MCP_E2E_MISSING', { label: '缺失环境变量提示', timeoutMs: 30000 });
    step('env-missing', { ok: true });

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

    // 重名跳过：已有 uitest1 时再粘贴它和新服务，只测试/添加新服务。
    assert.equal(await clickLabel(page, '添加 MCP'), true, '添加完成后找不到「添加 MCP」');
    await waitForText(page, 'JSON 编辑', { label: '再次打开编辑器' });
    await pasteJson(page, JSON.stringify({ mcpServers: { uitest1: entry(process.execPath), uitest3: entry(process.execPath) } }, null, 2));
    await waitForText(page, '已存在跳过 1', { label: '重名跳过提示' });
    assert.equal(await clickLabel(page, '测试全部'), true, '找不到「测试全部」');
    await waitForText(page, /已测试 1\/1/, { label: '只测试新服务' });
    if (!(await clickLabel(page, /^添加 1 个$/))) throw new Error('找不到「添加 1 个」按钮');
    await waitForText(page, '已添加 1 个服务', { label: '只添加新服务' });
    await waitForText(page, /uitest3.*已连接/, { label: '新服务连接', timeoutMs: 60000 });
    step('duplicate-skip', { ok: true, added: 1, skipped: 1 });

    // 保存成功后编辑器自动关闭，列表里能看到新行。
    const editorOpen = await page.evaluate(() => Boolean(document.getElementById('hub-editor-title')));
    assert.equal(editorOpen, false, '保存成功后编辑器没有关闭');
    step('save-closed', { ok: true });

    // 编辑已有服务：改配置 → 保存 → 编辑器关闭、行内重新验证。
    assert.equal(await clickLabel(page, '编辑 uitest1'), true, '找不到「编辑 uitest1」');
    await waitForText(page, '编辑 MCP 服务', { label: '编辑已有服务' });
    assert.equal(await clickLabel(page, 'JSON 编辑'), true, '编辑弹窗里找不到「JSON 编辑」');
    await pasteJson(page, JSON.stringify({ mcpServers: { uitest1: { command: process.execPath, args: [fixture], cwd: repoRoot, env: { EDIT_MARK: '1' } } } }, null, 2));
    assert.equal(await clickLabel(page, '保存'), true, '找不到「保存」');
    await waitForText(page, 'uitest1 已保存', { label: '编辑保存提示' });
    const editorAfterEdit = await page.evaluate(() => Boolean(document.getElementById('hub-editor-title')));
    assert.equal(editorAfterEdit, false, '编辑保存后编辑器没有关闭');
    await waitForText(page, /uitest1.*已连接/, { label: '编辑后重新连接', timeoutMs: 60000 });
    step('edit-save', { ok: true });

    // 密钥写入凭证服务：带明文 token 保存后，页面提示「密钥已写入 DSH 凭证」。
    assert.equal(await clickLabel(page, '添加 MCP'), true, '凭据化步骤找不到「添加 MCP」');
    await waitForText(page, 'JSON 编辑', { label: '凭据化编辑器' });
    await pasteJson(page, JSON.stringify({ mcpServers: { uiauth: { command: process.execPath, args: [fixture], cwd: repoRoot, env: { MCP_E2E_TOKEN: 'sk-live-e2e-0123456789abcdef' } } } }, null, 2));
    assert.equal(await clickLabel(page, '测试全部'), true, '凭据化步骤找不到「测试全部」');
    await waitForText(page, /已测试 1\/1/, { label: '凭据化测试' });
    if (!(await clickLabel(page, /^添加 1 个$/))) throw new Error('凭据化步骤找不到「添加 1 个」按钮');
    await waitForText(page, /已添加 1 个服务（密钥已写入 DSH 凭证）/, { label: '凭证写入提示', timeoutMs: 30000 });
    await waitForText(page, /uiauth.*已连接/, { label: '凭据化行状态', timeoutMs: 60000 });
    step('credential-save', { ok: true });
    // 「显示」通过 Host 解析 DSH 凭证，10 秒后自动隐藏。
    assert.equal(await clickLabel(page, '编辑 uiauth'), true, '凭据化步骤找不到「编辑 uiauth」');
    await waitForText(page, '编辑 MCP 服务', { label: '凭据化编辑窗口' });
    const locked = await page.evaluate(() => [...document.querySelectorAll('input')].some(input => input.readOnly && /^\$\{credential:/.test(input.value)));
    assert.equal(locked, true, '凭证引用字段不是只读');
    assert.equal(await clickLabel(page, '显示密钥'), true, '凭据化步骤找不到「显示密钥」');
    assert.equal(await waitForInputValue(page, 'sk-live-e2e-0123456789abcdef'), true, '凭证值没有出现在只读输入框');
    assert.equal(await clickLabel(page, '复制密钥'), true, '凭据化步骤找不到「复制密钥」');
    await waitForText(page, /已复制/, { label: '凭证复制提示' });
    assert.equal(await clickLabel(page, '隐藏密钥'), true, '凭据化步骤找不到「隐藏密钥」');
    const restored = await page.evaluate(() => [...document.querySelectorAll('input')].some(input => /^\$\{credential:/.test(input.value)));
    assert.equal(restored, true, '隐藏后没有恢复引用模板');
    assert.equal(await clickLabel(page, '编辑密钥'), true, '凭据化步骤找不到「编辑密钥」');
    await waitForText(page, '新密钥', { label: '编辑密钥弹窗' });
    await page.type('input[aria-label="新密钥"]', 'sk-live-rotated-0123456789abcdef');
    assert.equal(await clickLabel(page, '使用此密钥'), true, '编辑密钥弹窗找不到「使用此密钥」');
    await waitForText(page, '保存后写入 DSH 凭证', { label: '新密钥写入提示' });
    step('credential-reveal', { ok: true });
    assert.equal(await clickLabel(page, '关闭配置窗口'), true);
    await waitForText(page, /uiauth/, { label: '凭据化返回列表' });
    assert.equal(await clickLabel(page, '删除 uiauth'), true, '凭据化步骤找不到「删除 uiauth」');
    await waitForText(page, '删除 MCP 服务', { label: '凭据化删除弹窗' });
    assert.equal(await clickLabel(page, '删除'), true);
    await waitForText(page, '已添加 3', { label: '凭据化行删除', timeoutMs: 30000 });

    assert.equal(await clickLabel(page, '删除 uitest1'), true);
    await waitForText(page, '删除 MCP 服务', { label: '删除弹窗' });
    assert.equal(await clickLabel(page, '删除'), true);
    await waitForText(page, '已添加 2', { label: '删除第一行' });
    step('delete-one', { ok: true });

    assert.equal(await clickLabel(page, '删除 uitest2'), true);
    await waitForText(page, '删除 MCP 服务', { label: '删除弹窗' });
    assert.equal(await clickLabel(page, '删除'), true);
    await waitForText(page, '已添加 1', { label: '删除第二行' });

    assert.equal(await clickLabel(page, '删除 uitest3'), true);
    await waitForText(page, '删除 MCP 服务', { label: '删除弹窗' });
    assert.equal(await clickLabel(page, '删除'), true);
    await waitForText(page, '连接你的第一个 MCP', { label: '删除后空状态', timeoutMs: 30000 });
    step('delete-all', { ok: true, count: 0 });
  } catch (error) {
    // 失败时留一张全页截图，CI 的 artifact 能直接看到当时的界面。
    let screenshot = '';
    if (failurePage) {
      try {
        const dir = repoRoot + '/tests/e2e/artifacts';
        await mkdir(dir, { recursive: true });
        screenshot = dir + '/ui-failure-' + Date.now() + '.png';
        await failurePage.screenshot({ path: screenshot, fullPage: true });
      } catch {}
    }
    console.error(JSON.stringify({ ok: false, steps: report, error: String(error?.message ?? error), screenshot }, null, 2));
    process.exitCode = 1;
    return;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (session) await session.stop();
    await profile.cleanup();
  }
  console.log(JSON.stringify({ ok: true, steps: report }, null, 2));
}

main().catch(error => {
  // 只有创建 profile / 启动浏览器之前就失败才会走到这里。
  console.error(JSON.stringify({ ok: false, steps: report, error: String(error?.message ?? error) }, null, 2));
  process.exitCode = 1;
});