import { probeServer } from '@deepseek-ai/dsh-mcp-client';
import { preflight, redact, resolveReferences } from './config.js';

function safeMessage(error, entry) {
  let message = String(error?.message ?? error);
  const values = [...Object.values(entry.env ?? {}), ...Object.values(entry.headers ?? {}), ...(entry.args ?? []).flatMap(arg => [arg, arg.includes('=') ? arg.slice(arg.indexOf('=')+1) : ''])];
  if (entry.url) { try { const url = new URL(entry.url); values.push(url.password, ...url.searchParams.values()); } catch {} }
  for (const value of values.filter(value => value && typeof value === 'string').sort((a,b)=>b.length-a.length)) message = message.split(value).join('[隐藏]');
  return message.slice(0,1500);
}

/** One real, non-persistent probe using DSH's own protocol implementation. */
export async function testConnection(ctx, name, input, options = {}) {
  const checked = await preflight(name, input, options);
  if (!checked.ok) return { ok: false, checks: checked.checks, variables: checked.variables };
  // 探测需要真实值；这些值只存在于本次调用的内存里，不写回配置。
  const runtime = resolveReferences(checked.entry, options.env ?? process.env);
  const entry = runtime.entry;
  const config = {
    ...entry, serverName: name, args: entry.args ?? [], env: entry.env ?? {},
    cwd: entry.cwd ?? '', headers: entry.headers ?? {}, expandTemplates: true,
    startupTimeoutMs: entry.startupTimeoutMs ?? 20000, toolCallTimeoutMs: entry.toolCallTimeoutMs ?? 30000,
    closeTimeoutMs: entry.closeTimeoutMs ?? 2000,
  };
  const checks = [...checked.checks];
  try {
    const result = await (options.probe ?? probeServer)(ctx, config, { timeoutMs: options.timeoutMs ?? config.startupTimeoutMs, signal: options.signal });
    checks.push({ label: 'MCP 握手与工具发现', ok: result.ok, detail: result.ok ? `已连接 ${result.serverInfo?.name ?? name}，发现 ${result.toolNames.length} 个工具${result.truncated ? '（列表已截断）' : ''}` : safeMessage(result.message, entry) });
    const cleaned = result.closeConfirmed === true && !result.cleanupError;
    checks.push({ label: '测试连接已关闭', ok: cleaned, detail: cleaned ? '未保存配置，未注册工具到会话' : '测试清理未完成，请检查服务进程后重试' });
    return { ok: result.ok && cleaned, checks, variables: checked.variables, entry: redact(checked.entry), serverInfo: result.ok ? result.serverInfo : undefined };
  } catch(error) {
    checks.push({ label: 'MCP 连接测试', ok: false, detail: safeMessage(error, entry) });
    return { ok: false, checks, variables: checked.variables };
  }
}