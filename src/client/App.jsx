/** @jsx h */
/** @jsxFrag React.Fragment */
import React, { Component, useEffect, useRef, useState } from 'react';
import { applyEdits, modify } from 'jsonc-parser';
import { parseEditorDocument } from '../shared/mcp-config.js';
import { isSecretKey } from '../shared/display.js';
import { h, setLocale } from './i18n.js';

const MASK = '••••••••';
const STATUS = { connected: ['已连接', 'good'], disabled: ['已停用', 'muted'], connecting: ['连接中', 'warn'], reconnecting: ['重连中', 'warn'], 'waiting-credentials': ['缺少凭证', 'warn'], failed: ['连接失败', 'bad'], closed: ['未连接', 'muted'] };
// 官方 reason 是英文枚举，直接展示会让人看不懂。
const REASON = { 'gave-up': '重连预算已耗尽，工具已撤回', 'reconnect-disabled': '重连已关闭，连接中断后不再恢复', 'unclosed-generation': '上次连接未确认关闭，已阻止替换', load: '启动失败', cleanup: '清理未完成，需要重启 DSH' };
const MANAGED = { config: null, inherited: '继承配置', plugin: '插件注册', cleanup: '已删除，清理中', broken: '配置异常' };
const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
/** 字段级差异：只在来源配置与将要写入的配置之间比较，数组按整体比较。 */
export function diffRows(from = {}, to = {}, path = []) {
  const rows = [];
  const keys = new Set([...Object.keys(from ?? {}), ...Object.keys(to ?? {})]);
  for (const key of keys) {
    const a = from?.[key], b = to?.[key];
    if (isPlainObject(a) && isPlainObject(b)) { rows.push(...diffRows(a, b, path.concat(key))); continue; }
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    rows.push({ path: path.concat(key).join('.'), from: a, to: b });
  }
  return rows;
}
const showValue = value => value === undefined ? '（未设置）' : typeof value === 'string' ? (value === MASK ? '（已隐藏）' : value) : JSON.stringify(value);
function download(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
const ICONS = {
  plus: <path d="M12 5v14M5 12h14" />, refresh: <><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></>,
  chevron: <path d="m9 5 7 7-7 7"/>, search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></>,
  edit: <><path d="m15 4 5 5-11 11H4v-5zM12 7l5 5"/></>, trash: <><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/></>,
  check: <path d="m5 12 4 4L19 6"/>, close: <path d="m6 6 12 12M6 18 18 6"/>,
  box: <><path d="m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9M7 5l10 6"/></>,
  import: <><path d="M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6"/></>,
  folder: <path d="M3 6h7l2 3h9v11H3z"/>, arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
  external: <><path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M20 14v6H4V4h6"/></>,
  bolt: <path d="m13 2-9 12h7l-1 8 10-12h-7z"/>, info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/></>,
  pulse: <><path d="M3 12h4l2-6 3 12 2-6h5"/></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
};
export function Icon({ name, size = 18, ...props }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{ICONS[name] ?? ICONS.box}</svg>; }

/** Hub glyph for the plugin's own navigation identity: a central node with four peers. */
export function HubIcon({ size = 18, active = false, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.9 : 1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <circle cx="12" cy="12" r="2.1"/>
    <path d="M12 9.9V7.4M12 14.1v2.5M9.9 12H7.4M14.1 12h2.5"/>
    <circle cx="12" cy="5.2" r="1.7"/><circle cx="12" cy="18.8" r="1.7"/><circle cx="5.2" cy="12" r="1.7"/><circle cx="18.8" cy="12" r="1.7"/>
  </svg>;
}
function GitHubMark({ size = 15 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>;
}
const blank = () => ({ transport: 'stdio', command: '', args: [], env: {}, cwd: '', enabled: true });
const textError = error => error.message || '操作失败，请重试';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function apiRequest(path, body, signal) {
  // 与第一方客户端一致：使用文档相对路径，浏览器与桌面页面都经同一条 /api 通道。
  const response = await globalThis.fetch('api/dsh-mcp-hub' + path, { method: body ? 'POST' : 'GET', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal });
  if (!response.ok) {
    let message = '无法连接 MCP Hub，请确认 Host 插件已启用';
    let code;
    try { const payload = await response.json(); message = payload.error || message; code = payload.code; } catch {}
    const error = new Error(message);
    error.code = code;
    error.status = response.status;
    throw error;
  }
  return response.json();
}

/** A crashed row or panel must not blank the whole settings entry. */
class Boundary extends Component {
  constructor(props) { super(props); this.state = { error: undefined }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="hub-banner bad" role="alert"><Icon name="info"/><span>这个面板出错了：{this.state.error.message || '未知错误'}</span><button className="hub-text-button" onClick={() => this.setState({ error: undefined })}>重试</button></div>;
  }
}

function Badge({ children, tone = '' }) { return <span className={'hub-badge ' + tone}>{children}</span>; }
function Status({ status = {} }) { const [label, tone] = STATUS[status.state] ?? [`状态未知（${status.state ?? '无'}）`, 'muted']; return <span className={'hub-status ' + tone}><i />{label}</span>; }
function StatusNote({ status = {}, verification }) {
  if (verification?.state === 'verifying') return <span className="hub-note warn" role="status"><i className="hub-spinner"/>{verification.detail || '正在验证连接…'}</span>;
  // 失败结论在「未连上」时始终可见——包括自动停用之后，否则用户只剩一条停用的服务而不知道原因。
  if (verification?.state === 'failed' && status.state !== 'connected') return <span className="hub-note bad" role="alert">{status.state === 'disabled' ? '上次验证未通过：' : ''}{verification.detail || '连接验证未通过'}</span>;
  if (status.state === 'reconnecting' && status.attempt != null) return <span className="hub-note warn">第 {status.attempt}/{status.maxAttempts ?? '?'} 次重试</span>;
  if (status.state === 'waiting-credentials') return <span className="hub-note warn">缺少 DSH 凭证</span>;
  if (status.state === 'failed' && status.reason) return <span className="hub-note bad">{REASON[status.reason] ?? status.reason}</span>;
  return null;
}
function IconButton({ icon, label, size = 18, className = '', ...props }) { return <button type="button" className={'hub-icon-button ' + className} title={label} aria-label={label} {...props}><Icon name={icon} size={size} /></button>; }
function useDialog(onClose, busy = false) {
  const ref = useRef(null), close = useRef(onClose), pending = useRef(busy);
  close.current = onClose; pending.current = busy;
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.querySelector('button:not(:disabled),input:not(:disabled)')?.focus();
    const keydown = event => {
      if (event.key === 'Escape' && !pending.current) { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const elements = [...ref.current.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled)')];
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, []);
  return ref;
}

function ConfirmDialog({ title, description, confirmLabel, busy, error, onCancel, onConfirm }) {
  const ref = useDialog(onCancel, busy);
  return <div className="hub-overlay"><section ref={ref} className="hub-dialog hub-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="hub-confirm-title" aria-describedby="hub-confirm-description">
    <header className="hub-dialog-header"><h2 id="hub-confirm-title">{title}</h2><IconButton icon="close" label="取消" disabled={busy} onClick={onCancel}/></header>
    <div className="hub-dialog-body"><p id="hub-confirm-description">{description}</p>{error && <div className="hub-banner bad" role="alert">{error}</div>}</div>
    <footer className="hub-dialog-footer"><div className="hub-actions"><button className="hub-button" onClick={onCancel} disabled={busy}>取消</button><button className="hub-button destructive" onClick={onConfirm} disabled={busy}>{busy ? '处理中…' : confirmLabel}</button></div></footer>
  </section></div>;
}

function ExportDialog({ busy, error, onCancel, onExport }) {
  const ref = useDialog(onCancel, busy);
  const [includeSecrets, setIncludeSecrets] = useState(false);
  return <div className="hub-overlay"><section ref={ref} className="hub-dialog hub-export-dialog" role="dialog" aria-modal="true" aria-labelledby="hub-export-title" aria-describedby="hub-export-description">
    <header className="hub-dialog-header"><h2 id="hub-export-title">导出配置</h2><IconButton icon="close" label="取消" disabled={busy} onClick={onCancel}/></header>
    <div className="hub-dialog-body">
      <p id="hub-export-description">选择是否把密钥一起导出。</p>
      <div className="hub-export-options">
        <label className="hub-export-option">
          <input type="radio" name="hub-export-secrets" checked={!includeSecrets} onChange={() => setIncludeSecrets(false)} disabled={busy}/>
          <span><strong>不包含密钥</strong><small>适合分享给他人或做通用备份。凭据只保留 $&#123;credential:…&#125; 引用，换一台机器后需要配置同名凭证。</small></span>
        </label>
        <label className="hub-export-option">
          <input type="radio" name="hub-export-secrets" checked={includeSecrets} onChange={() => setIncludeSecrets(true)} disabled={busy}/>
          <span><strong>同时导出密钥</strong><small>适合迁移到自己的另一台电脑。引用会解析为当前值并以明文写入 JSON，请只保存在可信位置，不要分享这份文件。</small></span>
        </label>
      </div>
      {includeSecrets && <div className="hub-banner warn" role="alert"><Icon name="info"/><span>导出文件将包含明文密钥。发送或上传前请确认接收方可信。</span></div>}
      {error && <div className="hub-banner bad" role="alert">{error}</div>}
    </div>
    <footer className="hub-dialog-footer"><div className="hub-actions"><button className="hub-button" onClick={onCancel} disabled={busy}>取消</button><button className={'hub-button ' + (includeSecrets ? 'destructive' : 'primary')} onClick={() => onExport(includeSecrets)} disabled={busy}>{busy ? '导出中…' : includeSecrets ? '导出（含密钥）' : '导出'}</button></div></footer>
  </section></div>;
}

function DeleteDialog({ server, busy, error, onCancel, onDelete }) {
  return <ConfirmDialog title="删除 MCP 服务？" confirmLabel="删除" busy={busy} error={error} onCancel={onCancel} onConfirm={onDelete}
    description={<>将从 DSH 移除 <strong>{server.name}</strong> 的配置并断开连接。</>}/>;
}

/**
 * Render-local list identity: rows are keyed by name, so deleting a middle row no
 * longer moves focus and controlled values to the wrong row.
 */
function useRowIds() {
  const ids = useRef(new Map()), counter = useRef(0);
  return key => { if (!ids.current.has(key)) ids.current.set(key, 'r' + (++counter.current)); return ids.current.get(key); };
}

function Pairs({ value = {}, onChange, label, field, variables = [], onReveal }) {
  const [revealed, setRevealed] = useState({}), [names, setNames] = useState({}), [error, setError] = useState('');
  const idOf = useRowIds();
  const entries = Object.entries(value);
  const set = (key, val) => onChange({ ...value, [key]: val });
  async function show(key, val) {
    setError('');
    try { if (val.includes(MASK)) set(key, await onReveal(field, key)); setRevealed(current => ({...current,[key]:true})); }
    catch (error) { setError(textError(error)); }
  }
  async function rename(key, next) {
    setNames({}); if (key === next) return;
    if (!next || Object.hasOwn(value,next)) { setError('名称不能为空或重复'); return; }
    try { const val = value[key].includes(MASK) ? await onReveal(field,key) : value[key]; onChange(Object.fromEntries(entries.map(([k,v])=>[k===key?next:k,k===key?val:v]))); setError(''); }
    catch(error) { setError(textError(error)); }
  }
  return <div className="hub-pairs"><div className="hub-field-caption">{label}<button type="button" className="hub-text-button" onClick={() => { let key = field === 'headers' ? 'Authorization' : 'NEW_VARIABLE'; while (Object.hasOwn(value,key)) key += '_'; onChange({...value,[key]:''}); }}>＋ 添加一项</button></div>
    {entries.map(([key,val],index) => {
      const ref = String(val).match(/^(Bearer\s+)?(?:\$\{(env:|credential:)?([^}]*)\}|\{env:([^}]*)\})$/i);
      const prefix = ref?.[1] ?? '';
      const defaultPrefix = field === 'headers' && key.toLowerCase() === 'authorization' ? 'Bearer ' : '';
      const kind = ref ? ref[2] === 'credential:' ? 'credential' : 'env' : 'literal';
      const shown = ref ? ref[3] ?? ref[4] : val;
      const info = variables.find(row=>row.field === field && row.key === key);
      // Written-out secrets deserve the same treatment as fetched ones.
      const secret = kind === 'literal' && (isSecretKey(key) || /^(?:Bearer|Basic|Token)\s/i.test(String(val)));
      return <div className="hub-variable-row" key={idOf(key)}><div className={"hub-pair" + (field === "env" ? " no-mode" : "")}>
        <input aria-label={label+'名称 '+(index+1)} value={names[index] ?? key} placeholder="KEY" onChange={event=>setNames({...names,[index]:event.target.value})} onBlur={event=>rename(key,event.target.value.trim())}/>
        {field !== 'env' && <select aria-label={label+'配置方式 '+(index+1)} value={kind} onChange={event=>set(key,event.target.value==='literal'?'':event.target.value==='env'?defaultPrefix+'${env:}':defaultPrefix+'${credential:}')}><option value="literal">直接填写</option><option value="env">环境变量引用</option><option value="credential">DSH 凭证引用</option></select>}
        <input aria-label={label+'值 '+(index+1)} type={secret&&!revealed[key]?'password':'text'} value={field === 'env' ? (typeof val === 'string' ? val : '') : shown} placeholder={field === 'env' ? '填写值' : kind==='literal'?'填写值':kind==='env'?'例如 GITHUB_TOKEN':'凭证名称'} autoComplete="off" onChange={event=>set(key, field === 'env' ? event.target.value : kind==='literal'?event.target.value:kind==='env'?prefix+'${env:'+event.target.value+'}':prefix+'${credential:'+event.target.value+'}')}/>
        {secret && <button type="button" className="hub-text-button" onClick={()=>{ if(revealed[key]) { setRevealed({...revealed,[key]:false}); return; } if(String(val).includes(MASK)) { show(key,val); return; } setRevealed({...revealed,[key]:true}); }}>{revealed[key]?'隐藏':'显示'}</button>}
        <IconButton icon="close" label={'移除 '+key} onClick={()=>onChange(Object.fromEntries(entries.filter(([k])=>k!==key)))}/>
      </div><small className={info?.state==='missing'?'bad':'hub-help'}>{info?.state==='missing'?'找不到引用：'+info.missing.join('、'):info?.source?'已配置（来自 '+info.source+'）':field==='env'&&kind!=='literal'?'当前是引用；改为普通值会按明文保存':kind==='credential'?'由 DSH 凭证服务解析，连接时验证':kind==='env'?'保存为 ${credential:…} 引用，连接时从 DSH 凭证服务读取':String(val).includes(MASK)?'已配置；保持原样将保留原值':val?'已填写':'未填写'}</small></div>;
    })}
    {!entries.length && <p className="hub-help">没有额外的{label}。</p>}{error && <p className="bad" role="alert">{error}</p>}
  </div>;
}

function Arguments({ value = [], onChange, onReveal }) {
  const [shown,setShown] = useState({}), [error,setError] = useState('');
  const idOf = useRowIds();
  const sensitive = (arg,index) => arg.includes(MASK) || /^-.*(?:token|password|secret|key|authorization)/i.test(arg) || /^-.*(?:token|password|secret|key|authorization)/i.test(value[index-1] ?? '');
  async function reveal(index) { try { const next=[...value]; if(next[index].includes(MASK))next[index]=await onReveal('args',index);onChange(next);setShown({...shown,[index]:true}); } catch(error){setError(textError(error));} }
  async function remove(index) { try { const next=await Promise.all(value.map((arg,i)=>arg.includes(MASK)?onReveal('args',i):arg));setShown({});onChange(next.filter((_,i)=>i!==index)); }catch(error){setError(textError(error));} }
  return <div className="hub-pairs"><div className="hub-field-caption">启动参数<button type="button" className="hub-text-button" onClick={()=>onChange([...value,''])}>＋ 添加参数</button></div>
    {value.map((arg,index)=><div className="hub-argument" key={idOf('a' + index)}><span>{index+1}</span><input aria-label={'启动参数 '+(index+1)} type={sensitive(arg,index)&&!shown[index]?'password':'text'} value={arg} spellCheck="false" onChange={event=>onChange(value.map((v,i)=>i===index?event.target.value:v))}/>{sensitive(arg,index)&&<button type="button" className="hub-text-button" onClick={()=>shown[index]?setShown({...shown,[index]:false}):reveal(index)}>{shown[index]?'隐藏':'显示'}</button>}<IconButton icon="close" label={'删除参数 '+(index+1)} onClick={()=>remove(index)}/></div>)}
    <p className="hub-help">每项是一个参数，空格和空参数会原样保留；仅隐藏疑似凭证。</p>{error&&<p className="bad" role="alert">{error}</p>}
  </div>;
}

function Checks({ checks, busy, testing }) {
  if (busy) return <div className="hub-test-status testing" role="status"><span className="hub-test-icon"><span className="hub-spinner"/></span><div className="hub-test-copy"><strong>{testing ? '正在测试连接…' : '正在保存…'}</strong>{testing && <p>启动服务并完成握手</p>}</div></div>;
  if (!checks?.length) return null;
  const failed = checks.filter(check => !check.ok);
  const hard = failed.find(check => check.hard);
  const connection = failed.find(check => check.label === 'MCP 连接' || check.label === 'MCP 连接测试');
  const capability = failed.find(check => check.label === '工具发现');
  const cleanup = failed.find(check => check.label === '测试连接已关闭');
  const concise = (text, max = 170) => {
    const value = String(text ?? '').replace(/\s+/g, ' ').trim();
    return value.length > max ? value.slice(0, max - 1) + '…' : value;
  };
  let tone = 'bad', title = '配置检查未通过', detail = '';
  if (!failed.length) {
    tone = 'good'; title = '连接正常';
    detail = checks.find(check => check.label === '工具发现')?.detail ?? '服务可用，可以添加';
  } else if (hard) {
    detail = `${hard.label}：${hard.detail}`;
  } else if (connection) {
    title = '连接失败';
    detail = connection.detail;
  } else if (capability) {
    tone = 'warn'; title = '已连接，但工具发现失败'; detail = capability.detail;
  } else if (cleanup) {
    tone = 'warn'; title = '连接已建立，但测试进程未清理'; detail = cleanup.detail;
  } else {
    detail = `${failed[0].label}：${failed[0].detail}`;
  }
  return <div className={'hub-test-status ' + tone} role={tone === 'bad' ? 'alert' : 'status'}>
    <span className="hub-test-icon"><Icon name={tone === 'good' ? 'check' : 'info'} size={16}/></span>
    <div className="hub-test-copy">
      <strong>{title}</strong>
      {detail && <p>{concise(detail)}</p>}
      {tone !== 'good' && <details className="hub-test-details"><summary>查看检查详情</summary>
        <div className="hub-check-list">{checks.map((check, i) => <div className={'hub-check ' + (check.ok ? 'good' : 'bad')} key={i}><span className="hub-check-symbol">{check.ok ? '✓' : '!'}</span><div><strong>{check.label}</strong><p>{check.detail}</p></div></div>)}</div>
      </details>}
    </div>
  </div>;
}

const NAME_RE = /^[A-Za-z0-9_-]{1,32}$/;
const rowKey = row => (row.path?.length ? row.path.join('\u0000') : '$direct');
const rowSignature = row => JSON.stringify({ name: row.name, entry: row.entry });
const JSON_FORMATTING = { formattingOptions: { insertSpaces: true, tabSize: 2 } };
const resultState = result => {
  if (!result) return 'untested';
  if (result.error) return 'failed';
  const connected = result.connectionOk ?? result.ok;
  const cleanup = result.cleanupOk ?? result.ok;
  if (!connected || !cleanup) return 'failed';
  return result.capability === 'failed' ? 'warn' : 'passed';
};
const resultDetail = result => {
  if (result?.error) return result.error;
  if (!result) return '';
  const failed = (result.checks ?? []).find(check => !check.ok);
  return failed?.detail ?? (result.capability === 'failed' ? '服务已连接，但工具列表获取失败；添加后会再次验证。' : '测试通过，可以添加。');
};

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function Editor({ draft, request, revision, reloadRevision, onClose, onSaved, existing = [] }) {
  const [formName, setFormName] = useState(draft.name ?? '');
  const [formEntry, setFormEntry] = useState(() => structuredClone(draft.entry ?? blank()));
  const [formChecks, setFormChecks] = useState([]);
  const [formVariables, setFormVariables] = useState([]);
  const [formAccept, setFormAccept] = useState(false);
  const [jsonText, setJsonText] = useState(() => draft.jsonText ?? (draft.originalName || draft.candidateId ? JSON.stringify(draft.entry ?? blank(), null, 2) : ''));
  const [jsonFormat, setJsonFormat] = useState(draft.jsonFormat ?? 'jsonc');
  const [jsonRows, setJsonRows] = useState([]);
  const [jsonDirectName, setJsonDirectName] = useState(draft.name ?? '');
  const [jsonError, setJsonError] = useState('');
  const [jsonBatchError, setJsonBatchError] = useState('');
  const [jsonChecks, setJsonChecks] = useState([]);
  const [tests, setTests] = useState({});
  const [accepted, setAccepted] = useState({});
  const [mode, setMode] = useState(draft.initialMode ?? (draft.originalName || draft.candidateId ? 'form' : 'json'));
  const [busy, setBusy] = useState(false);
  const [testingAll, setTestingAll] = useState(false);
  const [testingRow, setTestingRow] = useState('');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [reading, setReading] = useState(0);
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const [saved, setSaved] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [willWrite, setWillWrite] = useState(null);
  const transportDrafts = useRef({});
  const originalName = useRef(draft.originalName);
  const currentRevision = useRef(revision);
  const dialog = useRef(null);
  const onCloseRef = useRef(onClose);
  const askCloseRef = useRef(null);
  const busyRef = useRef(false);
  const abortRef = useRef(null);
  const initialForm = useRef(JSON.stringify({ name: formName, entry: formEntry }));
  const initialJson = useRef(jsonText);
  onCloseRef.current = onClose;
  const formDirty = JSON.stringify({ name: formName, entry: formEntry }) !== initialForm.current;
  const jsonDirty = jsonText !== initialJson.current;
  const closeEditor = () => {
    if (busyRef.current) return;
    onCloseRef.current?.();
  };
  askCloseRef.current = closeEditor;
  busyRef.current = busy || reading > 0 || testingAll;
  useEffect(() => {
    const previous = document.activeElement;
    const root = dialog.current;
    root?.querySelector('input,button')?.focus();
    const listener = event => {
      if (event.key === 'Escape' && !busyRef.current) askCloseRef.current?.();
      if (event.key !== 'Tab' || !root) return;
      const focusable = [...root.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]')];
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', listener);
    return () => { document.removeEventListener('keydown', listener); previous?.focus(); };
  }, []);
  useEffect(() => () => { abortRef.current?.abort(); }, []);
  useEffect(() => {
    if (mode !== 'json') return;
    setJsonBatchError('');
    if (!jsonText.trim()) { setJsonRows([]); setJsonError(''); return; }
    const timer = setTimeout(() => {
      try {
        const rows = parseEditorDocument(jsonText, originalName.current || jsonDirectName, jsonFormat === 'toml' ? 'paste.toml' : 'paste.jsonc');
        setJsonRows(rows);
        setJsonError('');
      } catch (parseError) { setJsonRows([]); setJsonError(textError(parseError)); }
    }, 220);
    return () => clearTimeout(timer);
  }, [jsonText, mode, jsonFormat, jsonDirectName]);
  const existingSet = new Set(existing ?? []);
  const original = originalName.current;
  const duplicateName = value => Boolean(value) && value !== original && existingSet.has(value);
  const nameMessage = (value, duplicate) => {
    if (!value) return '请填写服务名称';
    if (!NAME_RE.test(value)) return '名称只能包含字母、数字、下划线或连字符，1–32 位';
    if (duplicate) return '已存在同名服务；请修改名称后重试';
    return '';
  };
  const formNameValue = formName.trim();
  const formDuplicate = duplicateName(formNameValue);
  const formNameError = formName ? nameMessage(formNameValue, formDuplicate) : '';
  const editorIssues = draft.issues ?? [];
  const formIssues = [...new Set(editorIssues)];
  const formReady = Boolean(formNameValue) && !formNameError && (!formIssues.length || formAccept);
  const formCheckReady = Boolean(formNameValue) && !nameMessage(formNameValue, false);
  const counts = new Map();
  for (const row of jsonRows) counts.set(row.name, (counts.get(row.name) ?? 0) + 1);
  const invalidRow = row => Boolean(row.invalid || !row.name?.trim() || !row.entry?.transport);
  const conflictRow = row => (counts.get(row.name) ?? 0) > 1;
  const rowIssues = row => [...new Set([...(row.issues ?? []), ...(jsonRows.length === 1 ? editorIssues : [])])];
  const jsonSkipped = jsonRows.filter(row => !invalidRow(row) && duplicateName(row.name) && !conflictRow(row));
  const jsonConflicts = jsonRows.filter(row => !invalidRow(row) && conflictRow(row));
  const jsonAddRows = jsonRows.filter(row => !invalidRow(row) && !duplicateName(row.name) && !conflictRow(row));
  const jsonNeedsReview = jsonAddRows.filter(row => rowIssues(row).length && !accepted[rowKey(row)]);
  const jsonInvalid = jsonRows.filter(invalidRow);
  const recordFor = row => {
    const record = tests[rowKey(row)];
    return record && record.signature === rowSignature(row) ? record : null;
  };
  const stateFor = row => {
    const record = recordFor(row);
    if (!record) return 'untested';
    if (record.error) return 'failed';
    return resultState(record.result);
  };
  const canTest = row => !invalidRow(row) && !duplicateName(row.name) && !conflictRow(row)
    && (!rowIssues(row).length || Boolean(accepted[rowKey(row)]));
  const rowReady = row => canTest(row) && ['passed', 'warn'].includes(stateFor(row));
  const directUnnamed = !original && jsonRows.length === 1 && jsonRows[0].direct && !jsonRows[0].raw?.name && !jsonRows[0].raw?.serverName;
  const jsonDirectNameError = directUnnamed && jsonDirectName && !NAME_RE.test(jsonDirectName) ? '名称只能包含字母、数字、下划线或连字符，1–32 位' : '';
  const jsonReady = !original && jsonRows.length > 0 && !jsonInvalid.length && !jsonConflicts.length
    && jsonAddRows.length > 0 && jsonAddRows.every(rowReady) && !jsonError && !jsonDirectNameError;
  const jsonEditRow = original && jsonRows.length === 1 ? jsonRows[0] : null;
  const jsonEditReady = Boolean(jsonEditRow) && !invalidRow(jsonEditRow) && !duplicateName(jsonEditRow.name)
    && !conflictRow(jsonEditRow) && (!rowIssues(jsonEditRow).length || Boolean(accepted[rowKey(jsonEditRow)])) && !jsonError;
  const jsonCandidateId = draft.candidateId && jsonRows.length === 1 ? draft.candidateId : undefined;
  const edit = (key, value) => { setFormEntry(current => ({ ...current, [key]: value })); setFormChecks([]); setFormVariables([]); setError(''); setSaved(false); };
  const editName = value => { setFormName(value); setFormChecks([]); setError(''); setSaved(false); };
  function runRowTest(row, signal) {
    const key = rowKey(row);
    return request('/test', {
      name: row.name.trim(),
      entry: row.entry,
      candidateId: jsonCandidateId,
      acceptUnsupported: Boolean(accepted[key]),
    }, signal).then(result => {
      if (!signal?.aborted) setTests(current => ({ ...current, [key]: { signature: rowSignature(row), result } }));
      return result;
    }).catch(testError => {
      if (!signal?.aborted) setTests(current => ({ ...current, [key]: { signature: rowSignature(row), error: textError(testError) } }));
      return null;
    });
  }
  async function testRow(row) {
    if (!canTest(row)) return;
    setTestingRow(rowKey(row)); setError('');
    try { await runRowTest(row); } finally { setTestingRow(''); }
  }
  async function testAll() {
    const queue = jsonAddRows.filter(canTest);
    if (!queue.length) { setJsonBatchError('没有可以测试的服务；请先处理无法解析、重名或需要核对的配置。'); return; }
    const controller = new AbortController(); abortRef.current = controller;
    setTestingAll(true); setProgress({ done: 0, total: queue.length }); setJsonBatchError(''); setError('');
    let cursor = 0;
    const worker = async () => {
      for (;;) {
        const index = cursor++;
        if (index >= queue.length || controller.signal.aborted) return;
        await runRowTest(queue[index], controller.signal);
        if (!controller.signal.aborted) setProgress(current => ({ ...current, done: Math.min(current.done + 1, current.total) }));
      }
    };
    try { await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker)); }
    finally { setTestingAll(false); abortRef.current = null; }
  }
  function cancelTests() {
    abortRef.current?.abort(); abortRef.current = null; setTestingAll(false); setTestingRow('');
    setJsonBatchError('已取消测试；已完成的测试结果会保留。');
  }
  function removeRow(row) {
    setJsonBatchError('');
    if (!row.path?.length || jsonFormat !== 'jsonc') { setJsonBatchError('这个配置无法在行内删除，请在文本中删除它。'); return; }
    try {
      const next = applyEdits(jsonText, modify(jsonText, row.path, undefined, JSON_FORMATTING));
      setJsonText(next);
      setTests(current => { const copy = { ...current }; delete copy[rowKey(row)]; return copy; });
    } catch (removeError) { setJsonBatchError(textError(removeError)); }
  }
  function acceptRow(row, value) {
    setAccepted(current => ({ ...current, [rowKey(row)]: value }));
  }
  async function submitForm(action) {
    setError(''); setStale(false); setWarnings([]); setFormChecks([]);
    if (action === 'check' && !formCheckReady) { setError(formNameError || '请先填写合法的服务名称'); return; }
    if (action !== 'check' && !formReady) { setError(formNameError || (formIssues.length && !formAccept ? '请先核对并确认不迁移的配置字段' : '请先补全配置')); return; }
    setBusy(true); setBusyAction(action);
    try {
      const body = {
        action: action === 'check' ? 'check' : 'save',
        name: formNameValue,
        // New services are always enabled; enabled:false in a pasted config is a
        // leftover from another app, not a choice made here. Editing keeps the row's state.
        entry: original ? formEntry : { ...formEntry, enabled: true },
        candidateId: original ? undefined : draft.candidateId,
        originalName: original,
        revision: currentRevision.current,
        acceptUnsupported: formAccept,
        mode: original && formEntry.enabled === false ? 'draft' : undefined,
      };
      const result = await request(action === 'check' ? '/test' : '/mutate', body);
      if (result.entry) setWillWrite(result.entry);
      setFormChecks(result.checks ?? []);
      setFormVariables(result.variables ?? []);
      if (action === 'check') return;
      setWarnings(result.warnings ?? []);
      if (result.saved) {
        setSaved(true); originalName.current = formNameValue;
        const latest = await onSaved({ result, names: [formNameValue], batch: false });
        if (latest?.revision !== undefined) currentRevision.current = latest.revision;
      } else {
        setError('保存未完成，请查看下方的检查结果。');
      }
      if (result.saved && !result.ok && !result.draft) setError('配置已保存，连接验证未通过。请补全后重试；可在已添加列表查看状态。');
    } catch (submitError) {
      setError(textError(submitError));
      if (submitError.code === 'REVISION_CONFLICT') setStale(true);
    } finally { setBusy(false); setBusyAction(''); }
  }
  async function submitJson() {
    setError(''); setJsonBatchError(''); setStale(false); setWarnings([]); setJsonChecks([]);
    if (jsonError) { setError('JSON 还不能解析，请先修正文本中的错误。'); return; }
    if (original) {
      if (!jsonEditReady) {
        setError(jsonRows.length !== 1 ? '编辑模式需要在 JSON 中只保留一个服务配置' : '请先处理重名或需要核对的配置字段');
        return;
      }
      const row = jsonEditRow;
      setBusy(true); setBusyAction('save');
      try {
        const result = await request('/mutate', {
          action: 'save', name: row.name.trim(), entry: row.entry, originalName: original,
          revision: currentRevision.current, acceptUnsupported: Boolean(accepted[rowKey(row)]),
          mode: row.entry.enabled === false ? 'draft' : undefined,
        });
        if (result.entry) setWillWrite(result.entry);
        setJsonChecks(result.checks ?? []); setWarnings(result.warnings ?? []);
        if (result.saved) {
          setSaved(true); originalName.current = row.name.trim();
          const latest = await onSaved({ result, names: [row.name.trim()], batch: false });
          if (latest?.revision !== undefined) currentRevision.current = latest.revision;
        } else setError('保存未完成，请查看下方的检查结果。');
        if (result.saved && !result.ok && !result.draft) setError('配置已保存，连接验证未通过。请补全后重试；可在已添加列表查看状态。');
      } catch (submitError) {
        setError(textError(submitError));
        if (submitError.code === 'REVISION_CONFLICT') setStale(true);
      } finally { setBusy(false); setBusyAction(''); }
      return;
    }
    if (!jsonReady) {
      if (jsonInvalid.length) setJsonBatchError('有服务无法解析，请修正或删除这些行后再添加。');
      else if (jsonConflicts.length) setJsonBatchError('有服务重名，请修改名称或删除重复行。');
      else if (jsonNeedsReview.length) setJsonBatchError('有配置需要核对，请逐行确认后再添加。');
      else if (jsonAddRows.length) setJsonBatchError('请先让所有待添加服务通过连接测试。');
      else setJsonBatchError('没有可添加的服务。已存在的服务会跳过；如需新增，请修改名称。');
      return;
    }
    const entries = jsonAddRows.map(row => ({
      name: row.name.trim(), entry: row.entry, candidateId: jsonCandidateId,
      acceptUnsupported: Boolean(accepted[rowKey(row)]),
    }));
    setBusy(true); setBusyAction('import');
    try {
      const result = await request('/mutate', { action: 'import', revision: currentRevision.current, entries });
      setJsonChecks(result.checks ?? []); setWarnings(result.warnings ?? []);
      if (result.ok && result.saved) {
        setSaved(true);
        const names = result.imported ?? jsonAddRows.map(row => row.name.trim());
        const latest = await onSaved({ result, names, batch: true });
        if (latest?.revision !== undefined) currentRevision.current = latest.revision;
      } else if (result.ok) {
        setJsonBatchError('没有新的服务需要添加；已存在的服务会被跳过。');
      } else if (result.failed) {
        setJsonBatchError(`服务「${result.failed.name}」未通过校验，本次没有写入任何配置。`);
      } else {
        setJsonBatchError('本次没有写入任何配置，请检查测试结果和配置。');
      }
    } catch (submitError) {
      setError(textError(submitError));
      if (submitError.code === 'REVISION_CONFLICT') setStale(true);
    } finally { setBusy(false); setBusyAction(''); }
  }
  /** Pull the freshly read revision into this dialog instead of closing and losing edits. */
  async function resync() {
    try { const latest = await reloadRevision(); currentRevision.current = latest; setStale(false); setError('已同步到最新版本，请再次点击保存'); }
    catch (resyncError) { setError(textError(resyncError)); }
  }
  async function reveal(field, key) {
    setReading(count => count + 1);
    try {
      const result = await request('/reveal', { field, key, originalName: original, candidateId: original ? undefined : draft.candidateId });
      return result.value;
    } finally { setReading(count => count - 1); }
  }
  const transport = formEntry.transport;
  const jsonPassed = jsonAddRows.filter(rowReady).length;
  const jsonSummary = [
    `已识别 ${jsonRows.length} 个服务`,
    jsonAddRows.length ? `待添加 ${jsonAddRows.length}` : '',
    jsonSkipped.length ? `已存在跳过 ${jsonSkipped.length}` : '',
    jsonConflicts.length ? `重名冲突 ${jsonConflicts.length}` : '',
    jsonInvalid.length ? `无法解析 ${jsonInvalid.length}` : '',
    jsonNeedsReview.length ? `需核对 ${jsonNeedsReview.length}` : '',
  ].filter(Boolean).join(' · ');
  const jsonPlaceholder = jsonFormat === 'toml'
    ? '[mcp_servers.context7]\ncommand = "npx"\nargs = ["-y", "@upstash/context7-mcp"]'
    : '{\n  "mcpServers": {\n    "服务名": { "command": "npx", "args": ["-y", "some-mcp"] }\n  }\n}';
  const jsonHelp = original
    ? '编辑模式只保存当前这一个服务；JSON 与表单各自保留修改，切换页签不会覆盖。'
    : jsonRows.length
      ? '待添加服务必须全部测试通过；已存在的同名服务会跳过，修改文本中的服务名后可作为新服务重测。'
      : '粘贴一个或多个服务配置；支持 JSON、JSONC、TOML 和 mcpServers 容器格式。';
  return <div className="hub-overlay"><section ref={dialog} className="hub-dialog" role="dialog" aria-modal="true" aria-labelledby="hub-editor-title">
    <header className="hub-dialog-header"><div><h2 id="hub-editor-title">{draft.originalName ? '编辑 MCP 服务' : '添加 MCP 服务'}</h2></div><IconButton icon="close" label="关闭配置窗口" onClick={closeEditor} disabled={busy || reading > 0 || testingAll}/></header>
    <div className="hub-dialog-body">
      {draft.source && <div className="hub-source-note"><Icon name="import"/><div>从 {draft.source} 导入<code title={draft.sourcePath}>{draft.sourcePath}</code><small>{draft.detail ? '项目级配置 · ' + draft.detail : '配置复制到 DSH 后独立管理'}</small></div></div>}
      {willWrite && (() => {
        const rows = draft.sourcePath ? diffRows(draft.entry ?? {}, willWrite) : [];
        return <details className="hub-willwrite"><summary>{rows.length ? `将写入 DSH 的配置（${rows.length} 处与来源不同）` : '将写入 DSH 的配置'}</summary>
          {rows.length > 0 && <ul>{rows.slice(0, 12).map(row => <li key={row.path}><code>{row.path}</code><span>{showValue(row.from)} → {showValue(row.to)}</span></li>)}</ul>}
          {rows.length > 12 && <p className="hub-help">另有 {rows.length - 12} 处差异，见下方完整配置。</p>}
          <pre>{JSON.stringify(willWrite, null, 2)}</pre>
          <p className="hub-help">凭据按字段名遮蔽；引用保存为 $&#123;credential:…&#125;，由 DSH 凭证服务在连接时解析。</p>
        </details>;
      })()}
      <div className="hub-editor-modes">
        <button type="button" className={mode === 'json' ? 'active' : ''} disabled={busy || reading > 0} onClick={() => { setMode('json'); setError(''); }}>JSON 编辑{jsonDirty && <span className="hub-dirty-dot" title="有未保存的修改"/>}</button>
        <button type="button" className={mode === 'form' ? 'active' : ''} disabled={busy || reading > 0} onClick={() => { setMode('form'); setError(''); }}>表单配置{formDirty && <span className="hub-dirty-dot" title="有未保存的修改"/>}</button>
      </div>
      <fieldset disabled={busy || reading > 0 || testingAll} className="hub-fields">
        {mode === 'json' ? <div className="hub-json-config">
          <div className="hub-json-toolbar">{directUnnamed && <label className="hub-field hub-json-format">服务名称<input value={jsonDirectName} onChange={event => setJsonDirectName(event.target.value)} placeholder="例如 context7"/>{jsonDirectNameError && <small className="bad">{jsonDirectNameError}</small>}</label>}<label className="hub-field hub-json-format">格式<select value={jsonFormat} onChange={event => { setJsonFormat(event.target.value); setJsonRows([]); setJsonError(''); setTests({}); setAccepted({}); setJsonChecks([]); }} aria-label="配置格式"><option value="jsonc">JSON / JSONC</option><option value="toml">TOML</option></select></label><span className="hub-help">{jsonFormat === 'toml' ? 'TOML 支持批量粘贴；改名和删除请在文本中操作。' : '可直接粘贴整份 mcpServers 配置；重名时在文本中改名后重新测试。'}</span></div>
          <label className="hub-field">服务器配置<textarea aria-label="JSON 配置" className="hub-json-editor" value={jsonText} onChange={event => { setJsonText(event.target.value); setJsonError(''); setJsonBatchError(''); setJsonChecks([]); setError(''); setSaved(false); }} placeholder={jsonPlaceholder} spellCheck="false"/></label>
          {jsonError ? <p className="bad" role="alert">{jsonError}</p> : jsonRows.length > 0 ? <p className="hub-help" role="status">{jsonSummary}</p> : <p className="hub-help">粘贴后会立即解析；可以一次添加多个服务。</p>}
          {!!jsonBatchError && <div className="hub-banner warn" role="alert">{jsonBatchError}</div>}
          {!!jsonRows.length && <div className="hub-json-rows">{jsonRows.map(row => {
            const key = rowKey(row);
            const state = stateFor(row);
            const duplicate = duplicateName(row.name);
            const conflict = conflictRow(row);
            const invalid = invalidRow(row);
            const issues = rowIssues(row);
            const record = recordFor(row);
            return <article className={'hub-json-row ' + state + (duplicate ? ' duplicate' : '') + (conflict ? ' conflict' : '')} key={key}>
              <div className="hub-json-row-head"><strong>{row.name || '未命名服务'}</strong><Badge>{row.entry?.transport || '未知'}</Badge>
                {invalid && <Badge tone="bad">无法解析</Badge>}
                {duplicate && <Badge tone="warn">已存在 · 将跳过</Badge>}
                {conflict && <Badge tone="bad">重名冲突</Badge>}
                {!invalid && !!row.entry?.enabled === false && <Badge tone="muted">停用</Badge>}
                {state === 'passed' && <Badge tone="good">测试通过</Badge>}
                {state === 'warn' && <Badge tone="warn">已连接 · 工具发现失败</Badge>}
                {state === 'failed' && <Badge tone="bad">测试失败</Badge>}
                {state === 'untested' && <Badge tone="muted">未测试</Badge>}
              </div>
              {invalid ? <p className="bad">{row.issues?.join('；') || '这个服务配置无法解析'}</p> : <>
                <p className="hub-json-row-meta">{row.entry.transport === 'stdio' ? <code>{row.entry.command}</code> : <code>{row.entry.url}</code>}<span>·</span>{Object.keys(row.entry.env ?? row.entry.headers ?? {}).length} 项{row.entry.transport === 'stdio' ? '环境变量' : '请求头'}</p>
                {duplicate && <p className="hub-json-rename-hint bad" role="status">名称已存在，将跳过；如需作为新服务添加，请修改 JSON 中的服务名后重新测试。</p>}
                {conflict && <p className="hub-json-rename-hint bad" role="status">与其他待添加服务重名；请修改 JSON 中的服务名后重新测试。</p>}
                {!!issues.length && <div className="hub-json-issues"><p>有 {issues.length} 项配置需要核对：{issues.join('；')}</p><label><input type="checkbox" checked={Boolean(accepted[key])} onChange={event => acceptRow(row, event.target.checked)}/>我已核对，确认不迁移上述字段</label></div>}
                {state !== 'untested' && <p className={'hub-test-note ' + state}>{resultDetail(record?.error ? { error: record.error } : record.result)}</p>}
                <div className="hub-json-row-actions">
                  <button type="button" className="hub-text-button" disabled={!canTest(row) || testingRow === key || testingAll} onClick={() => testRow(row)}>{testingRow === key ? '测试中…' : '测试连接'}</button>
                  <button type="button" className="hub-text-button danger" disabled={testingAll || !row.path?.length || jsonFormat !== 'jsonc'} onClick={() => removeRow(row)}>删除</button>
                </div>
              </>}
            </article>;
          })}</div>}
          {!!jsonChecks.length && <Checks checks={jsonChecks} busy={false} testing={false}/>}
        </div> : <>
          <label className="hub-field">服务名称<input value={formName} onChange={event => editName(event.target.value)} placeholder="例如 context7"/><small>字母、数字、下划线或连字符，最多 32 位；改名会在保存后重建连接</small>{formNameError && <small className="bad">{formNameError}</small>}</label>
          <label className="hub-field">连接方式<select value={transport} onChange={event => { const nextTransport = event.target.value; transportDrafts.current[formEntry.transport] = formEntry; setFormEntry({ ...(transportDrafts.current[nextTransport] ?? (nextTransport === 'stdio' ? blank() : { transport: nextTransport, url: '', headers: {} })), enabled: formEntry.enabled }); setFormChecks([]); setFormVariables([]); }}>{!['stdio','streamable-http'].includes(transport) && <option value={transport}>{transport}（暂不支持）</option>}<option value="stdio">stdio · 本地命令</option><option value="streamable-http">Streamable HTTP · 远程服务</option></select></label>
          {transport === 'stdio' ? <>
            <label className="hub-field">启动命令<input value={formEntry.command ?? ''} onChange={event => edit('command', event.target.value)} placeholder="npx、uvx 或可执行文件的绝对路径"/></label>
            <Arguments value={formEntry.args} onChange={value => edit('args', value)} onReveal={reveal}/>
            <label className="hub-field">工作目录 <span className="hub-optional">可选</span><input value={formEntry.cwd ?? ''} onChange={event => edit('cwd', event.target.value)} placeholder="留空由 DSH 决定"/><small>本地命令的运行目录；命令或参数使用相对路径时填写，例如项目根目录。留空则继承 DSH 当前目录。</small></label>
            <Pairs label="环境变量" field="env" value={formEntry.env} variables={formVariables} onReveal={reveal} onChange={value => edit('env', value)}/>
          </> : <><label className="hub-field">服务地址<input value={formEntry.url ?? ''} onChange={event => edit('url', event.target.value)} placeholder="https://example.com/mcp"/><small>地址中的凭证已隐藏，修改地址时请填写完整新地址。</small></label><Pairs label="请求头" field="headers" value={formEntry.headers} variables={formVariables} onReveal={reveal} onChange={value => edit('headers', value)}/></>}
          {!!formIssues.length && <div className="hub-compatibility"><strong>有配置需要核对</strong><ul>{formIssues.map(issue => <li key={issue}>{issue}</li>)}</ul><label><input type="checkbox" checked={formAccept} onChange={event => setFormAccept(event.target.checked)}/>我已核对，确认不迁移上述不支持的字段</label></div>}
        </>}
      </fieldset>
      {mode === 'form' && <Checks checks={formChecks} busy={busy} testing={busyAction === 'check'}/>}
      {error && <div className="hub-banner warn" role="alert">{error}{stale && <button className="hub-text-button" onClick={resync}>同步最新版本</button>}</div>}
      {warnings.map(warning => <div className="hub-banner warn" key={warning}>{warning}</div>)}
    </div>
    <footer className="hub-dialog-footer">
      <span className="hub-help">{mode === 'json' ? (original ? jsonHelp : `${jsonHelp}${jsonAddRows.length ? `（已测试 ${jsonPassed}/${jsonAddRows.length}）` : ''}`) : saved ? '配置已保存，可修正后重试' : original && formEntry.enabled === false ? '保存配置，保持停用' : '保存后验证正式连接；新建服务默认启用'}</span>
      <div className="hub-actions">
        {mode === 'json' ? <>
          {!original && testingAll && <button className="hub-button" onClick={cancelTests}>取消测试</button>}
          {!original && <button className="hub-button" disabled={busy || testingAll || !jsonAddRows.filter(canTest).length} onClick={testAll}>{testingAll ? `测试中 ${progress.done}/${progress.total}` : '测试全部'}</button>}
          {original && <button className="hub-button" disabled={busy || !jsonEditRow || !canTest(jsonEditRow)} onClick={() => jsonEditRow && testRow(jsonEditRow)}>{testingRow ? '测试中…' : '测试连接'}</button>}
          <button className="hub-button primary" disabled={busy || testingAll || !(original ? jsonEditReady : jsonReady)} onClick={submitJson}>{busy && busyAction === 'import' ? '添加中…' : busy && busyAction === 'save' ? '保存中…' : original ? '保存' : jsonSkipped.length && !jsonAddRows.length ? '没有可添加' : `添加${jsonAddRows.length ? ` ${jsonAddRows.length} 个` : ''}`}</button>
        </> : <>
          <button className="hub-button" disabled={busy || !formCheckReady} onClick={() => submitForm('check')}>{busy && busyAction === 'check' ? '测试中…' : '测试连接'}</button>
          <button className="hub-button primary" disabled={busy || !formReady} onClick={() => submitForm('save')}>{busy && busyAction !== 'check' ? '保存中…' : original ? '保存' : '添加'}</button>
        </>}
      </div>
    </footer>
  </section></div>;
}
function ServerRow({ server, busy, detail, detailLoading, onLoadTools, onEdit, onAction }) {
  const [open, setOpen] = useState(false);
  const [detailTab, setDetailTab] = useState('tools');
  const [query, setQuery] = useState('');
  const { name, entry, status, source, tools, verification } = server;
  const connected = status.state === 'connected';
  const managed = server.managed ?? (server.editable ? 'config' : 'plugin');
  const verifying = verification?.state === 'verifying';
  const signature = `${status.connectedAt ?? ''}:${status.toolCount ?? ''}`;
  // Tool parameter schemas are large: fetch them only for the row the user opened.
  useEffect(() => {
    if (!open || detailTab !== 'tools' || !connected) return;
    void onLoadTools(name, signature);
  }, [open, detailTab, connected, name, signature]);
  const rows = detail?.tools ?? tools;
  const loading = detailLoading && !detail;
  return <article className={'hub-server ' + (open ? 'expanded' : '')}>
    <div className="hub-server-top"><button type="button" className="hub-expand-button" aria-expanded={open} aria-label={(open ? '收起 ' : '展开 ') + name} onClick={() => setOpen(!open)}><Icon name="chevron" className={open ? 'rotated' : ''}/></button>
      <span className="hub-avatar">{name.slice(0, 1).toUpperCase()}</span><button type="button" className="hub-server-name" onClick={() => setOpen(!open)} aria-expanded={open}><strong>{name}</strong><span><Status status={status}/><Badge>{connected ? (status.toolCount ?? tools.length) : '—'} 个工具</Badge>{MANAGED[managed] && <Badge>{MANAGED[managed]}</Badge>}{!MANAGED[managed] && <Badge>{entry?.transport === 'stdio' ? 'stdio' : entry?.transport === 'streamable-http' ? 'HTTP' : '插件管理'}</Badge>}<span className="hub-origin">{source?.app}</span><StatusNote status={status} verification={verification}/></span></button>
      <div className="hub-actions">{verifying && <IconButton icon="close" label={'取消验证 ' + name} disabled={busy} onClick={() => onAction('cancel', server)}/>}<IconButton icon="edit" label={'编辑 ' + name} disabled={!server.editable || busy} onClick={() => onEdit(server)}/><IconButton icon="refresh" label={'重启 ' + name} disabled={status.state === 'disabled' || !server.editable || busy} onClick={() => onAction('restart', server)}/><IconButton icon="trash" label={'删除 ' + name} className="danger" disabled={!server.removable || busy} onClick={() => onAction('remove', server)}/><button type="button" className="hub-switch" role="switch" aria-label={'启用 ' + name} aria-checked={entry?.enabled !== false && !!entry} disabled={!server.editable || busy} onClick={() => onAction('toggle', server)}><span/></button></div>
    </div>
    {open && <div className="hub-server-details"><div className="hub-detail-tabs">{[['tools','工具'],['config','配置'],['diagnostics','诊断']].map(([id,label]) => <button type="button" key={id} className={id === detailTab ? 'active' : ''} onClick={() => setDetailTab(id)}>{label}{id === 'tools' && <small>{status.toolCount ?? tools.length}</small>}</button>)}</div>
      {detailTab === 'tools' && <div className="hub-tools"><div className="hub-detail-heading"><span>服务提供的工具</span>{rows.length > 3 && <input aria-label={'搜索 ' + name + ' 的工具'} value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索工具…"/>}</div>{loading && <p className="hub-help" role="status"><i className="hub-spinner"/>正在读取工具参数…</p>}{!rows.length && !loading && <p className="hub-help">{connected ? '服务已连接，但没有返回工具；工具清单由保存后的正式连接重新获取，可在「诊断」中复诊。' : '服务连接成功后，这里将显示可用工具。'}</p>}{connected && !!rows.length && <p className="hub-help">工具清单来自保存后的正式连接，不沿用添加页的测试结果。</p>}{rows.filter(tool => (tool.name + tool.description).toLowerCase().includes(query.toLowerCase())).map(tool => <details className="hub-tool" key={tool.fullName ?? tool.name}><summary><Icon name="bolt" size={15}/><code>{tool.name}</code><Icon name="chevron" size={14}/></summary><p>{tool.description || '无描述'}</p>{tool.schema ? <pre>{JSON.stringify(tool.schema, null, 2)}</pre> : <p className="hub-help">展开后加载参数 Schema。</p>}</details>)}</div>}
      {detailTab === 'config' && <div className="hub-config"><div className="hub-definition"><span>配置归属</span><strong>{MANAGED[managed] ?? 'DSH 全局配置'}</strong><span>导入来源</span><strong>{source?.app ?? 'DSH'}</strong>{source?.path && <><span>来源文件</span><code>{source.path}</code></>}</div><pre>{JSON.stringify(entry, null, 2)}</pre><p className="hub-help">凭据按字段名隐藏；普通环境变量与启动参数按原值显示。</p></div>}
      {detailTab === 'diagnostics' && <div className="hub-diagnostics"><div className="hub-detail-heading"><span>连接诊断</span><Status status={status}/></div><StatusNote status={status} verification={verification}/><p>{status.lastError || (connected ? '服务已连接，工具已同步到 DSH。' : status.state === 'disabled' ? '配置已保留，启用后开始连接。' : '请检查运行环境、变量和认证配置。')}</p><div className="hub-definition">{status.reason && <><span>停止原因</span><strong>{REASON[status.reason] ?? status.reason}</strong></>}{status.attempt != null && <><span>重试次数</span><strong>{status.attempt}/{status.maxAttempts ?? '?'}</strong></>}{!!status.nextRetryAtMs && <><span>下次重试</span><strong>{new Date(status.nextRetryAtMs).toLocaleTimeString()}</strong></>}{status.closeConfirmed === false && <><span>连接清理</span><strong className="bad">未确认关闭</strong></>}{!!status.cleanupError && <><span>清理错误</span><strong className="bad">{status.cleanupError}</strong></>}{verification?.finishedAt && <><span>最近一次验证</span><strong className={verification.state === 'ok' ? 'good' : verification.state === 'failed' ? 'bad' : 'muted'}>{verification.detail ?? verification.state}</strong></>}{entry && <><span>复诊</span><button className="hub-text-button" disabled={busy} onClick={() => onAction('probe', server)}>现在复诊（不影响运行中的实例）</button></>}</div></div>}
    </div>}
  </article>;
}

function Sources({ sources, scanning, scanError, onScan, onImport, onRemove }) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState({});
  const populated = (sources ?? []).filter(source => source.candidates.length > 0);
  const failures = (sources ?? []).flatMap(source => source.files.filter(file => file.state === 'error').map(file => ({ ...file, app: source.name })));
  const filtered = populated.filter(source => (source.name + source.candidates.map(row => row.name).join(' ')).toLowerCase().includes(query.toLowerCase()));
  return <>
    <div className="hub-toolbar">
      <label className="hub-search"><Icon name="search"/><input aria-label="搜索本地 MCP" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索 MCP 名称或来源…"/></label>
      <button className="hub-button" onClick={onScan} disabled={scanning}><Icon name="refresh" className={scanning ? 'spinning' : ''}/>{scanning ? '扫描中…' : '重新扫描'}</button>
    </div>
    {scanError && <div className="hub-banner bad" role="alert">{scanError}</div>}
    {failures.map(file => <div className="hub-banner warn" key={file.path} role="alert"><Icon name="info"/><span>{file.app} 的配置无法读取，请检查文件格式和权限。</span></div>)}
    {!sources && !scanError && <div className="hub-empty" role="status"><span className="hub-spinner"/><p>正在查找本机 MCP 配置…</p></div>}
    {sources && !populated.length && <div className="hub-empty"><Icon name="import" size={30}/><h2>未发现可导入的 MCP</h2><p>可以选择配置文件，或在其他应用配置 MCP 后重新扫描。</p></div>}
    {!!populated.length && !filtered.length && <div className="hub-empty"><Icon name="search" size={30}/><h2>没有匹配的服务</h2><p>试试其他名称或来源。</p></div>}
    <div className="hub-source-list">{filtered.map(source => {
      const candidates = source.candidates.filter(row => (row.name + source.name).toLowerCase().includes(query.toLowerCase()));
      const open = expanded[source.id] ?? !!query;
      return <article className={'hub-source ' + (open ? 'expanded' : '')} key={source.id}>
        <div className="hub-source-heading-row">
          <button className="hub-source-heading" type="button" aria-expanded={open} onClick={() => setExpanded({ ...expanded, [source.id]: !open })}>
            <Icon name="chevron" className={open ? 'rotated' : ''}/><span className={'hub-source-logo ' + source.id}>{source.id === 'opencode' ? '〈〉' : source.name.slice(0,1)}</span><strong title={source.name}>{source.name}</strong><Badge>{source.candidates.length} 项配置</Badge><code title={source.files.find(file => file.state === 'read')?.path}>{source.files.find(file => file.state === 'read')?.path}</code>
          </button>
          {source.manual && <IconButton icon="trash" label={'移除导入来源 ' + source.name} className="danger" onClick={() => onRemove(source)}/>}
        </div>
        {open && <div className="hub-source-content">{candidates.map(candidate => <div className="hub-candidate" key={candidate.id}>
          <span className="hub-candidate-icon"><Icon name="box"/></span>
          <div className="hub-candidate-info"><strong>{candidate.name}</strong><span title={candidate.entry.transport === 'stdio' ? candidate.entry.command : candidate.entry.url}>{candidate.entry.transport === 'stdio' ? '本地命令' : '远程服务'}<i>·</i>{candidate.entry.transport === 'stdio' ? candidate.entry.command : candidate.entry.url}</span>{candidate.detail && <small>项目级 · {candidate.detail}</small>}{candidate.nameConflict && <small className="warn">同名已存在，但配置不同（导出配置时可能省略了凭据）；确认是新服务时请改名添加</small>}{!!candidate.issues.length && <small className="warn">有 {candidate.issues.length} 项配置需要核对</small>}{candidate.duplicateSource && <small>也发现于 {candidate.duplicateSource}</small>}</div>
          {candidate.duplicate ? <span className="hub-already"><Icon name="check" size={15}/>已添加 · {candidate.duplicate}{candidate.credentialOmitted ? '（凭据未随备份导入）' : ''}</span> : <button className="hub-button" onClick={() => onImport(candidate)}><Icon name="plus" size={16}/>添加</button>}
        </div>)}</div>}
      </article>;
    })}</div>
  </>;
}


function CatalogPanel({ request, onInstall }) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState('');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState('');
  const controller = useRef(null);
  const requestRef = useRef(request);
  const loadingMore = useRef(false);
  const autoCursor = useRef('');
  const sentinel = useRef(null);
  requestRef.current = request;
  async function search(nextQuery, cursor) {
    const trimmed = nextQuery.trim();
    if (trimmed && trimmed.length < 3) { setError('官方 Registry 要求至少输入 3 个字符'); return; }
    if (!cursor) autoCursor.current = '';
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    setBusy(true); setError('');
    try {
      const result = await requestRef.current('/catalog-search', { query: nextQuery, cursor, limit: 20 }, next.signal);
      if (next.signal.aborted) return;
      setItems(current => cursor ? [...current, ...(result.items ?? [])] : (result.items ?? []));
      setNextCursor(result.nextCursor ?? null);
      setSearched(true);
      setSearchedQuery(nextQuery);
    } catch (searchError) {
      if (!next.signal.aborted) setError(textError(searchError));
    } finally {
      if (!next.signal.aborted) setBusy(false);
    }
  }
  async function quickAdd(item) {
    if (!item.canInstall || adding) return;
    setAdding(item.name); setError('');
    try {
      const result = await requestRef.current('/catalog-detail', { name: item.name });
      const install = result?.install;
      const option = install?.options?.[0];
      if (!option) { setSelected(item); return; }
      onInstall(install, option);
    } catch (addError) {
      setError(textError(addError));
    } finally {
      setAdding('');
    }
  }
  useEffect(() => { void search('', null); return () => controller.current?.abort(); }, []);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !nextCursor || busy || searchedQuery !== query) return undefined;
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting) || loadingMore.current || autoCursor.current === nextCursor) return;
      autoCursor.current = nextCursor;
      loadingMore.current = true;
      void search(query, nextCursor).finally(() => { loadingMore.current = false; });
    }, { rootMargin: '240px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [nextCursor, busy, query, searchedQuery]);
  return <>
    <div className="hub-catalog-search">
      <form className="hub-search hub-catalog-search-box" onSubmit={event => { event.preventDefault(); void search(query, null); }}>
        <Icon name="search"/><input aria-label="搜索官方 MCP Registry" value={query} onChange={event => setQuery(event.target.value)} placeholder="按服务名称搜索官方 MCP Registry（至少 3 个字符）…"/>
      </form>
      <button className="hub-button" type="button" disabled={busy} onClick={() => void search(query, null)}>{busy ? '搜索中…' : '搜索'}</button>
    </div>
    <div className="hub-catalog-hint" role="status">
      <Icon name="info" size={15}/>
      <span>只读取官方 MCP Registry 的公开目录；结果按官方服务名顺序返回，没有热度或下载量排序。不会自动安装，添加后仍需测试并保存。</span>
    </div>
    {error && <div className="hub-banner bad" role="alert"><Icon name="info"/><span>{error}</span><button className="hub-text-button" onClick={() => void search(query, null)}>重试</button></div>}
    {busy && !items.length && <div className="hub-empty" role="status"><span className="hub-spinner"/><p>正在读取官方目录…</p></div>}
    {searched && !busy && !items.length && !error && <div className="hub-empty"><Icon name="search" size={30}/><h2>没有找到匹配的服务</h2><p>换个关键词，或直接粘贴配置手动添加。</p></div>}
    {!!items.length && <div className="hub-catalog-list">{items.map(item => <article className="hub-catalog-card" key={item.name}>
      <div className="hub-catalog-content">
        <div className="hub-catalog-card-head"><div><strong>{item.title || item.name}</strong><code title={item.name}>{item.name}</code></div>{item.version && <Badge>{item.version}</Badge>}</div>
        {item.description && <p className="hub-catalog-description">{item.description}</p>}
        <div className="hub-catalog-meta">{!item.canInstall && <Badge tone="warn">暂不支持自动转换</Badge>}{(item.packageTypes ?? []).map(type => <Badge key={'pkg-' + type}>{type}</Badge>)}{(item.transports ?? []).map(transport => <Badge key={'transport-' + transport}>{transport === 'streamable-http' ? 'HTTP' : transport.toUpperCase()}</Badge>)}{item.updatedAt && <span className="hub-catalog-updated">更新于 {formatDate(item.updatedAt)}</span>}</div>
      </div>
      <div className="hub-catalog-card-actions"><IconButton icon="eye" size={16} label="查看详情" onClick={() => setSelected(item)}/>{item.canInstall && <IconButton icon="plus" size={17} label={adding === item.name ? '添加中…' : '添加到 MCP Hub（默认使用第一种安装方式）'} disabled={adding === item.name} onClick={() => void quickAdd(item)}/>}</div>
    </article>)}</div>}
    {!!nextCursor && searchedQuery === query && <div className="hub-catalog-sentinel" ref={sentinel} role="status">{busy ? '正在加载更多…' : ''}</div>}
    {selected && <CatalogDialog item={selected} request={request} onClose={() => setSelected(null)}/>}
  </>;
}

function CatalogDialog({ item, request, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const dialog = useDialog(onClose, loading);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    request('/catalog-detail', { name: item.name }, controller.signal)
      .then(result => { if (!controller.signal.aborted) setDetail(result); })
      .catch(detailError => { if (!controller.signal.aborted) setError(textError(detailError)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [item.name, request]);
  const install = detail?.install;
  const options = install?.options ?? [];
  return <div className="hub-overlay"><section ref={dialog} className="hub-dialog hub-catalog-dialog" role="dialog" aria-modal="true" aria-labelledby="hub-catalog-title">
    <header className="hub-dialog-header"><div className="hub-catalog-title-row">{item.icon && <img className="hub-catalog-icon" src={item.icon} alt="" loading="lazy" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = 'none'; }}/>}<div><h2 id="hub-catalog-title">{item.title || item.name}</h2><code className="hub-catalog-registry-name">{item.name}</code></div></div><IconButton icon="close" label="关闭详情" onClick={onClose} disabled={loading}/></header>
    <div className="hub-dialog-body">
      {loading && <p className="hub-help" role="status"><i className="hub-spinner"/>正在读取服务详情…</p>}
      {error && <div className="hub-banner bad" role="alert"><Icon name="info"/><span>{error}</span><button className="hub-text-button" onClick={() => { setDetail(null); setLoading(true); setError(''); request('/catalog-detail', { name: item.name }).then(setDetail).catch(next => setError(textError(next))).finally(() => setLoading(false)); }}>重试</button></div>}
      {!loading && install && <>
        {install.version && <p className="hub-help">版本 <code>{install.version}</code>{item.websiteUrl && <> · <a href={item.websiteUrl} target="_blank" rel="noopener noreferrer">官网</a></>}{install.repository && <> · <a href={install.repository} target="_blank" rel="noopener noreferrer">仓库</a></>}{item.updatedAt && <> · {'更新于 '}<time dateTime={item.updatedAt}>{formatDate(item.updatedAt)}</time></>}</p>}
        {item.description && <p className="hub-catalog-description">{item.description}</p>}
        {!!install.warnings.length && <div className="hub-banner warn" role="alert"><Icon name="info"/><span>{[...new Set(install.warnings)].join('；')}</span></div>}
        {!!install.unsupported.length && <div className="hub-banner warn" role="alert"><Icon name="info"/><span>{install.unsupported.join('；')}</span></div>}
        {!options.length && <div className="hub-empty"><Icon name="info" size={28}/><h2>暂不支持自动添加</h2><p>这个服务没有可转换为 DSH 配置的包或 HTTP 地址；可以复制仓库中的配置手动添加。</p></div>}
        {!!options.length && <>
          <h3 className="hub-catalog-section-title">安装方式</h3>
          <div className="hub-catalog-options">{options.map(row => <div className="hub-catalog-option" key={row.id}>
            <span><strong>{row.label}</strong><small>{row.entry.transport === 'stdio' ? <><code>{row.entry.command}</code> {row.entry.args?.join(' ')}</> : <code>{row.entry.url}</code>}</small>{!!row.warnings?.length && <small className="bad">{row.warnings.join('；')}</small>}</span>
          </div>)}</div>
          {options.length > 1 && <p className="hub-help">列表中的「添加」默认使用第一种方式；其他方式可以添加后在表单或 JSON 中调整。</p>}
          <div className="hub-catalog-entry"><h3 className="hub-catalog-entry-title">默认将写入的配置</h3><pre>{JSON.stringify(options[0].entry, null, 2)}</pre></div>
        </>}
      </>}
    </div>
  </section></div>;
}

export function App({ request = apiRequest, preview = false, locale }) {
  const [, setLocaleTick] = useState(0);
  useEffect(() => {
    if (!locale) return undefined;
    const sync = () => { setLocale(locale.getSnapshot().active); setLocaleTick(tick => tick + 1); };
    sync();
    return locale.subscribe(sync);
  }, [locale]);
  const [tab, setTab] = useState('installed');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState(null);
  const [noticePaused, setNoticePaused] = useState(false);
  const [undo, setUndo] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [sources, setSources] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [draft, setDraft] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState('');
  const [busy, setBusy] = useState('');
  const [toolDetails, setToolDetails] = useState({});
  const fileInput = useRef(null);
  const undoTimer = useRef(null);
  const alive = useRef(true);
  const generation = useRef(0);
  const sourcesLoaded = useRef(false);
  const sourceRevision = useRef(null);
  const sourceGeneration = useRef(0);
  const initialScanStarted = useRef(false);
  const scanningTask = useRef(null);
  const version = useRef(0);
  const revision = useRef(-1);
  const dataRef = useRef(null);
  useEffect(() => { dataRef.current = data; }, [data]);
  async function refresh(quiet = false) {
    const id = ++generation.current;
    if (!quiet) setLoading(true);
    try {
      const next = await request('/servers');
      if (alive.current && id === generation.current) {
        setData(next); setLoadError('');
        version.current = next.version ?? version.current + 1;
        revision.current = next.revision;
        if (sourcesLoaded.current && sourceRevision.current !== next.revision) await syncSources(next.revision);
      }
      return next;
    }
    catch (error) { if (alive.current && id === generation.current) setLoadError(textError(error)); throw error; }
    finally { if (alive.current && id === generation.current) setLoading(false); }
  }
  /** Merge status-only rows into the loaded list; the entries and tool summaries stay put. */
  function mergeStatus(rows) {
    setData(current => {
      if (!current) return current;
      const byName = new Map(rows.map(row => [row.name, row]));
      const servers = current.servers.map(server => {
        const row = byName.get(server.name);
        if (!row) return server;
        const { name, editable, verification, ...status } = row;
        return { ...server, status, verification, editable: editable ?? server.editable };
      });
      return { ...current, servers };
    });
  }
  function applySnapshot(snapshot) {
    if (!snapshot) return;
    version.current = snapshot.version ?? version.current;
    if (snapshot.revision !== revision.current) { refresh(true).catch(() => {}); return; }
    const current = dataRef.current;
    // The initial `refresh()` owns the first load; only reload on a real shape change.
    if (!current) return;
    if ((snapshot.servers ?? []).length !== current.servers.length
      || (snapshot.servers ?? []).some(row => !current.servers.some(server => server.name === row.name))) {
      refresh(true).catch(() => {});
      return;
    }
    mergeStatus(snapshot.servers ?? []);
  }
  useEffect(() => {
    alive.current = true;
    refresh().catch(() => {});
    // Long-poll instead of a fixed interval: the Host answers as soon as a status,
    // a verification, or the configuration revision changes.
    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      while (!cancelled && alive.current) {
        try {
          const snapshot = await request('/wait', { version: version.current, revision: revision.current, timeoutMs: 20000 }, controller.signal);
          if (cancelled || !alive.current) return;
          applySnapshot(snapshot);
        } catch (error) {
          if (cancelled || error?.name === 'AbortError') return;
          await sleep(2000);
        }
      }
    })();
    return () => { cancelled = true; controller.abort(); alive.current = false; };
  }, [request]);
  useEffect(() => () => clearTimeout(undoTimer.current), []);
  useEffect(() => {
    if (!notice || noticePaused) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice, noticePaused]);
  function notify(text, tone = 'good') { setNoticePaused(false); setNotice({text,tone,id:Date.now()}); }
  function showUndo(batchId, names) {
    if (!batchId || !names.length) return;
    clearTimeout(undoTimer.current);
    setUndo({ batchId, names });
    undoTimer.current = setTimeout(() => setUndo(null), 20000);
  }
  async function undoImport() {
    if (!undo) return;
    setBusy('undo');
    try {
      const result = await request('/mutate', { action: 'undo-import', batchId: undo.batchId, revision: revision.current });
      setUndo(null);
      await refresh(true);
      const removed = result.removed ?? [];
      notify(removed.length ? `已撤销 ${removed.length} 个服务` : '没有可撤销的服务', removed.length ? 'good' : 'muted');
      if (result.skipped?.length) notify(`已撤销 ${removed.length} 个；${result.skipped.length} 个已修改，未撤销`, 'muted');
    } catch (error) { notify(textError(error), 'bad'); }
    finally { setBusy(''); }
  }
  async function syncSources(nextRevision) {
    const id = ++sourceGeneration.current;
    try { const result = await request('/sources'); if (alive.current && id === sourceGeneration.current) { setSources(result.sources); setScanError(''); sourceRevision.current = nextRevision; } }
    catch(error) { if(alive.current) setScanError('导入状态更新失败，请重新扫描后重试'); }
  }
  const hostReady = Boolean(data);
  useEffect(() => {
    if (!hostReady || initialScanStarted.current) return;
    initialScanStarted.current = true;
    void scan();
  }, [hostReady]);
  async function scan() {
    if (scanningTask.current) return scanningTask.current;
    setScanning(true); setScanError('');
    const task = (async () => {
      try { const result = await request('/scan', {}); if (alive.current) { setSources(result.sources); sourcesLoaded.current = true; sourceRevision.current = revision.current; } }
      catch (error) { if (alive.current) setScanError(textError(error)); }
      finally { if (alive.current) { setScanning(false); scanningTask.current = null; } }
    })();
    scanningTask.current = task;
    return task;
  }
  async function readConfigFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 200 * 1024) { setError('配置文件超过 200 KB，请使用较小的 MCP 配置文件'); return; }
    setScanning(true); setError('');
    try {
      const result = await request('/parse', { filename: file.name, text: await file.text() });
      setSources(previous => [...(previous ?? []), ...result.sources]); sourcesLoaded.current = true;
    } catch (error) { setError(textError(error)); }
    finally { setScanning(false); }
  }
  async function removeImportedSource(source) {
    setBusy('source'); setError('');
    try {
      await request('/source-remove', { id: source.id });
      if (alive.current) {
        // Remove locally so auto-scanned groups stay visible even if the host response
        // only carries the changed file source.
        setSources(previous => (previous ?? []).filter(item => item.id !== source.id));
        sourcesLoaded.current = true;
      }
    } catch (error) { setError(textError(error)); }
    finally { setBusy(''); }
  }
  async function loadTools(name, signature) {
    const cached = toolDetails[name];
    if (cached?.signature === signature && cached.tools) return;
    if (cached?.loading === signature) return;
    setToolDetails(current => ({ ...current, [name]: { ...current[name], loading: signature } }));
    try {
      const result = await request('/tools', { name });
      if (!alive.current) return;
      setToolDetails(current => ({ ...current, [name]: { signature, tools: result.tools } }));
    } catch (error) {
      if (!alive.current) return;
      setToolDetails(current => ({ ...current, [name]: { ...current[name], loading: undefined } }));
      setError(textError(error));
    }
  }
  async function action(action, server, confirmed = false) {
    if (action === 'remove' && !confirmed) { setDeleteError(''); setConfirm(server); return; }
    if (action === 'cancel') {
      setBusy(server.name); setError('');
      try { await request('/cancel', { name: server.name }); await refresh(true); }
      catch (error) { setError(textError(error)); }
      finally { setBusy(''); }
      return;
    }
    if (action === 'probe') {
      setBusy(server.name); setError('');
      try {
        await request('/probe', { name: server.name });
        await refresh(true);
      } catch (error) { setError(textError(error)); }
      finally { setBusy(''); }
      return;
    }
    setBusy(server.name); setError(''); setDeleteError(''); setNotice(null);
    try {
      const result = await request('/mutate', { action, name: server.name, revision: data.revision, enabled: server.entry?.enabled === false });
      await refresh(true); setConfirm(null);
      if (action === 'remove' && result.cleanup?.length) notify(`已删除 ${server.name}；${result.cleanup.length} 个凭证已无引用，可在 DSH 凭证管理中清理`, 'muted');
    } catch (error) { if(action === 'remove')setDeleteError(textError(error));else setError(textError(error)); }
    finally { setBusy(''); }
  }
  /** One click for "everything failed after a network change": restart each broken server. */
  async function restartFailed() {
    const targets = servers.filter(server => server.editable && ['failed', 'waiting-credentials', 'reconnecting'].includes(server.status.state)).map(server => server.name);
    if (!targets.length) { notify('没有需要重连的服务', 'muted'); return; }
    setBusy('bulk'); setError('');
    try {
      const result = await request('/mutate', { action: 'bulk', operation: 'restart', names: targets, revision: data.revision });
      await refresh(true);
      notify(`已请求重连 ${result.affected} 个服务`);
    } catch (error) { setError(textError(error)); }
    finally { setBusy(''); }
  }
  async function exportConfig(includeSecrets) {
    setExportBusy(true); setExportError('');
    try {
      const result = await request('/export', { includeSecrets });
      const count = Object.keys(result?.backup ?? {}).length;
      if (!count) { setExportOpen(false); notify('没有可导出的配置', 'muted'); return; }
      const suffix = includeSecrets ? '-with-secrets' : '';
      download('mcp-hub-backup-' + new Date().toISOString().slice(0, 10) + suffix + '.json', JSON.stringify({ format: 'dsh-mcp-hub-backup', version: 1, exportedAt: new Date().toISOString(), servers: result.backup }, null, 2));
      setExportOpen(false);
      const omitted = result.omitted?.length ?? 0;
      const unresolved = result.credentialsMissing?.length ?? 0;
      if (includeSecrets) notify(unresolved ? `已导出 ${count} 个服务；${unresolved} 个凭证未配置，仍以引用形式导出` : `已导出 ${count} 个服务（包含密钥），请妥善保管`, 'warn');
      else notify(omitted ? `已导出 ${count} 个服务；${omitted} 个凭据字段未导出，恢复后需重新填写` : `已导出 ${count} 个服务`);
    } catch (error) { setExportError(textError(error)); }
    finally { setExportBusy(false); }
  }
  const servers = data?.servers ?? [];
  const connected = servers.filter(server => server.status.state === 'connected').length;
  const failures = servers.filter(server => ['failed','waiting-credentials','broken'].includes(server.managed) || ['failed','waiting-credentials'].includes(server.status.state)).length;
  const visible = servers.filter(server => (server.name + (server.source?.app ?? '')).toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || filter === 'connected' && server.status.state === 'connected' || filter === 'disabled' && server.status.state === 'disabled' || filter === 'failed' && ['failed', 'waiting-credentials'].includes(server.status.state)));
  return <main className="mcp-hub" data-preview={preview}>
    <header className="hub-header"><div className="hub-brand"><div className="hub-brand-copy"><div className="hub-brand-title"><h1>MCP Hub</h1><div className="hub-repo-links"><a className="hub-github-link" href="https://github.com/mr-hanlu/dsh-mcp-hub" target="_blank" rel="noopener noreferrer" aria-label="打开 GitHub 项目"><GitHubMark/>GitHub</a></div></div></div></div><div className="hub-header-actions"><button className="hub-button primary" disabled={!data} onClick={() => setDraft({ entry: blank() })}><Icon name="plus" size={15}/>添加 MCP</button></div></header>
    <p className="hub-description">连接、管理你的 MCP 服务，把常用工具带到 DSH。</p>
    <nav className="hub-main-tabs" aria-label="MCP Hub 页面"><button type="button" aria-current={tab === 'installed' ? 'page' : undefined} className={tab === 'installed' ? 'active' : ''} onClick={() => setTab('installed')}><Icon name="box"/>已添加 <small>{servers.length}</small></button><button type="button" aria-current={tab === 'import' ? 'page' : undefined} className={tab === 'import' ? 'active' : ''} onClick={() => setTab('import')}><Icon name="import"/>本地导入</button><button type="button" aria-current={tab === 'catalog' ? 'page' : undefined} className={tab === 'catalog' ? 'active' : ''} onClick={() => setTab('catalog')}><Icon name="search"/>在线搜索</button></nav>
    {(error || loadError) && <div className="hub-banner bad" role="alert"><Icon name="info"/><span>{error || loadError}</span><button className="hub-text-button" onClick={() => { setError(''); refresh().catch(() => {}); }}>重试</button></div>}
    {undo && <div className="hub-undo" role="status"><span>已添加 {undo.names.length} 个服务</span><button type="button" className="hub-text-button" disabled={!!busy} onClick={undoImport}>撤销</button><IconButton icon="close" label="关闭撤销提示" onClick={() => setUndo(null)}/></div>}
    {notice && <div className={'hub-toast ' + notice.tone} role="status" onMouseEnter={()=>setNoticePaused(true)} onMouseLeave={()=>setNoticePaused(false)} onFocus={()=>setNoticePaused(true)} onBlur={()=>setNoticePaused(false)}><Icon name={notice.tone === 'good' ? 'check' : 'info'}/><span>{notice.text}</span><IconButton icon="close" label="关闭通知" onClick={() => setNotice(null)}/></div>}
    <Boundary>
    {tab === 'catalog' ? <CatalogPanel request={request} onInstall={(install, option) => setDraft({ name: install.name, entry: option.entry, initialMode: 'form', source: '官方 MCP Registry', sourcePath: install.registryName, jsonText: JSON.stringify({ mcpServers: { [install.name]: option.entry } }, null, 2), jsonFormat: 'json' })}/> : tab === 'installed' ? <>
      <div className="hub-stats"><div><strong>{servers.length}</strong><span>个 MCP 服务</span></div><div><i className="good"/><strong>{connected}</strong><span>已连接</span></div><div><i className={failures ? 'bad' : 'muted'}/><strong>{failures}</strong><span>需要处理</span></div></div>
      <div className="hub-toolbar"><label className="hub-search"><Icon name="search"/><input aria-label="搜索已添加的 MCP" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索服务名称或来源…"/></label><select aria-label="筛选连接状态" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">全部状态</option><option value="connected">已连接</option><option value="disabled">已停用</option><option value="failed">需要处理</option></select><div className="hub-bulk"><button className="hub-button" disabled={!!busy || !failures} onClick={restartFailed}><Icon name="refresh" size={15}/>重连异常项</button><button className="hub-button" disabled={!data} onClick={() => { setExportError(''); setExportOpen(true); }}>导出配置</button></div></div>
      <div className="hub-list-label"><span>服务</span><span>管理</span></div>
      <div className="hub-server-list">{visible.map(server => <ServerRow key={server.name} server={server} busy={!!busy} detail={toolDetails[server.name]?.tools && { tools: toolDetails[server.name].tools }} detailLoading={Boolean(toolDetails[server.name]?.loading)} onLoadTools={loadTools} onEdit={server => setDraft({ name: server.name, entry: server.entry, originalName: server.name })} onAction={action}/>)}</div>
      {!visible.length && <div className="hub-empty"><Icon name="box" size={30}/><h2>{loading ? '正在读取服务…' : servers.length ? '没有匹配的服务' : '连接你的第一个 MCP'}</h2><p>{servers.length ? '试试其他名称或切换状态筛选。' : '手动添加服务，或从其他 AI 应用导入已有配置。'}</p>{!servers.length && !loading && <button className="hub-button" onClick={() => setTab('import')}><Icon name="import"/>从本机导入</button>}</div>}
    </> : <><div className="hub-file-import"><span>从其他应用导入已有 MCP</span><button className="hub-button" disabled={scanning} onClick={() => fileInput.current.click()}><Icon name="folder" size={16}/>选择配置文件</button><input type="file" hidden ref={fileInput} accept=".json,.jsonc,.toml" onChange={readConfigFile}/></div><Sources sources={sources} scanning={scanning} scanError={scanError} onScan={scan} onImport={candidate => setDraft({ ...candidate, candidateId: candidate.id })} onRemove={removeImportedSource}/></>}
    </Boundary>
    {confirm && <DeleteDialog server={confirm} busy={!!busy} error={deleteError} onCancel={()=>setConfirm(null)} onDelete={()=>action('remove',confirm,true)}/>}
    {exportOpen && <ExportDialog busy={exportBusy} error={exportError} onCancel={()=>{ if(!exportBusy) setExportOpen(false); }} onExport={exportConfig}/>}
    {draft && <Editor draft={draft} existing={servers.map(server => server.name)} revision={data?.revision} request={request} reloadRevision={async () => (await refresh(true)).revision} onClose={() => setDraft(null)} onSaved={async ({result,names = [],batch}) => {
      const next = await refresh(true);
      const count = names.length;
      const label = count > 1 ? `${count} 个 MCP 服务` : (names[0] ?? '服务');
      const verifying = Array.isArray(result.verifying) ? result.verifying.length > 0 : Boolean(result.verifying);
      const secrets = result.credentials?.stored?.length ? '（密钥已写入 DSH 凭证）' : '';
      if (batch) {
        setDraft(null);
        showUndo(result.batchId, result.imported ?? names);
      } else if (result.ok || result.draft) {
        setDraft(null);
        notify(result.draft ? label + ' 已保存，保持停用' + secrets : verifying ? label + ' 已保存，正在验证连接' + secrets : label + ' 已保存' + secrets, result.draft ? 'muted' : 'good');
      }
      const warnings = (result.warnings ?? []).filter(item => !String(item).startsWith('已写入 DSH 凭证：'));
      if(warnings.length) setError(warnings.join('；'));
      return next;
    }}/>}
  </main>;
}