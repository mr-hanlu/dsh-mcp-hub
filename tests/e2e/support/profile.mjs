/**
 * 端到端测试共用的小工具：找 dsh、在临时 DSH_HOME 里建 profile、装插件、启动、关停。
 *
 * 设计约束：
 * - 只用临时目录，绝不读写用户的 `~/.dsh`。
 * - 找不到 `dsh` 时调用方应打印 SKIP 并整体跳过，而不是失败。
 * - 启动后必须 stop()，否则 Electron 进程会吊住 Node 的事件循环。
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const APP_CLI = '/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh';
export const sleep = ms => new Promise(done => setTimeout(done, ms));

/** `DSH_BIN` 优先，其次 PATH，最后是桌面应用自带的 launcher。 */
export function findDsh() {
  if (process.env.DSH_BIN) return process.env.DSH_BIN;
  const onPath = spawnSync('sh', ['-c', 'command -v dsh'], { encoding: 'utf8' });
  if (onPath.status === 0 && onPath.stdout.trim()) return onPath.stdout.trim();
  const probe = spawnSync(APP_CLI, ['--version'], { stdio: 'ignore' });
  return probe.status === 0 ? APP_CLI : null;
}

export function runDsh(bin, args, env, { timeoutMs = 180000 } = {}) {
  const result = spawnSync(bin, args, { env, encoding: 'utf8', timeout: timeoutMs });
  if (result.status !== 0) {
    throw new Error(`dsh ${args.join(' ')} 失败（${result.status}）：${(result.stderr || result.stdout || '').slice(-800)}`);
  }
  return result.stdout;
}

/**
 * 建一个临时 profile 并把 bundle 装进去。
 * @param {object} options
 * @param {string} options.bin - dsh 可执行文件。
 * @param {string} options.repoRoot - 本仓库根目录。
 * @param {string} [options.name] - profile 名，默认 `e2e`。
 * @param {string} [options.template] - 随附模板名，UI 测试需要 `web`。
 */
export async function createProfile({ bin, repoRoot, name = 'e2e', template = 'web' }) {
  const home = await mkdtemp(join(tmpdir(), 'dsh-mcp-hub-e2e-'));
  const env = { ...process.env, DSH_HOME: home };
  runDsh(bin, ['--profile', name, '--from-default-profile', template, '--dump-config'], env);
  runDsh(bin, ['plugin', '--profile', name, 'add', repoRoot], env);
  const dumped = runDsh(bin, ['--profile', name, '--dump-config'], env);
  if (!dumped.includes('# == dsh-mcp-hub')) throw new Error('组合后的配置里没有 dsh-mcp-hub 层');
  return {
    home,
    env,
    name,
    /** 删掉临时 DSH_HOME；调用方应保证 profile 已停止。 */
    cleanup: () => rm(home, { recursive: true, force: true }),
  };
}

/** 启动 profile，返回带 token 的地址、会话 cookie，以及 stop()。 */
export async function bootProfile({ bin, profile, env, extraArgs = ['--no-open'] }) {
  const child = spawn(bin, ['--profile', profile, ...extraArgs], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  const stopChild = () => { try { child.kill('SIGTERM'); } catch {} };
  try {
    const url = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('等待 dsh web 启动超时：' + output.slice(-800))), 90000);
      const scan = chunk => {
        output += chunk;
        const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/);
        if (match) { clearTimeout(timer); resolve(match[0]); }
      };
      child.stdout.on('data', chunk => scan(String(chunk)));
      child.stderr.on('data', chunk => scan(String(chunk)));
      child.on('exit', code => { clearTimeout(timer); reject(new Error('dsh 提前退出（' + code + '）：' + output.slice(-800))); });
    });
    const base = new URL(url).origin;
    const token = new URL(url).searchParams.get('token');
    // 令牌在 303 上换成会话 cookie；不要跟随重定向，否则拿不到 Set-Cookie。
    const response = await fetch(base + '/?token=' + encodeURIComponent(token), { redirect: 'manual' });
    const cookies = (response.headers.getSetCookie?.() ?? []).map(value => value.split(';')[0]).join('; ');
    if (!cookies) throw new Error('打开页面没有拿到会话 cookie（HTTP ' + response.status + '）');
    const probe = await fetch(base + '/api/dsh-mcp-hub/servers', { headers: { cookie: cookies } });
    if (probe.status !== 200) throw new Error('会话 cookie 未生效：/servers 返回 ' + probe.status);
    return {
      url,
      base,
      cookies,
      output: () => output,
      stop: async () => { stopChild(); await sleep(500); stopChild(); await sleep(300); },
    };
  } catch (error) {
    stopChild();
    throw error;
  }
}

/** 统一的调用器，供 API 层断言使用。 */
export function createApi(session) {
  return async function call(path, body) {
    const response = await fetch(session.base + '/api/dsh-mcp-hub' + path, body
      ? { method: 'POST', headers: { 'content-type': 'application/json', cookie: session.cookies }, body: JSON.stringify(body) }
      : { method: 'GET', headers: { cookie: session.cookies } });
    let payload = null;
    try { payload = await response.json(); } catch {}
    return { status: response.status, body: payload };
  };
}