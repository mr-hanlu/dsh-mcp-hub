import React, { useEffect, useRef, useState } from 'react';
import { parseEditorDocument } from '../shared/mcp-config.js';

const MASK = '••••••••';
const STATUS = { connected: ['已连接', 'good'], disabled: ['已停用', 'muted'], connecting: ['连接中', 'warn'], reconnecting: ['重连中', 'warn'], 'waiting-credentials': ['缺少凭证', 'warn'], failed: ['连接失败', 'bad'], closed: ['未连接', 'muted'] };
const ICONS = {
  plus: <path d="M12 5v14M5 12h14" />, refresh: <><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></>,
  chevron: <path d="m9 5 7 7-7 7"/>, search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></>,
  edit: <><path d="m15 4 5 5-11 11H4v-5zM12 7l5 5"/></>, trash: <><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/></>,
  check: <path d="m5 12 4 4L19 6"/>, close: <path d="m6 6 12 12M6 18 18 6"/>,
  box: <><path d="m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9M7 5l10 6"/></>,
  import: <><path d="M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6"/></>,
  folder: <path d="M3 6h7l2 3h9v11H3z"/>, arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
  bolt: <path d="m13 2-9 12h7l-1 8 10-12h-7z"/>, info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/></>,
};
export function Icon({ name, size = 18, ...props }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{ICONS[name] ?? ICONS.box}</svg>; }
const blank = () => ({ transport: 'stdio', command: '', args: [], env: {}, cwd: '', enabled: true });
const textError = error => error.message || '操作失败，请重试';

export async function apiRequest(path, body, signal) {
  const carrier = globalThis.__DSH_TRANSPORT__?.fetch;
  const response = await (carrier ?? globalThis.fetch)('api/dsh-mcp-hub' + path, { method: body ? 'POST' : 'GET', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal });
  if (!response.ok) {
    let message = '无法连接 MCP Hub，请确认 Host 插件已启用';
    try { message = (await response.json()).error || message; } catch {}
    throw new Error(message);
  }
  return response.json();
}

function Badge({ children, tone = '' }) { return <span className={'hub-badge ' + tone}>{children}</span>; }
function Status({ status = {} }) { const [label, tone] = STATUS[status.state] ?? ['状态未知', 'muted']; return <span className={'hub-status ' + tone}><i />{label}</span>; }
function IconButton({ icon, label, className = '', ...props }) { return <button type="button" className={'hub-icon-button ' + className} title={label} aria-label={label} {...props}><Icon name={icon} /></button>; }
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

function DeleteDialog({ server, busy, error, onCancel, onDelete }) {
  const ref = useDialog(onCancel, busy);
  return <div className="hub-overlay"><section ref={ref} className="hub-dialog hub-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="hub-delete-title" aria-describedby="hub-delete-description">
    <header className="hub-dialog-header"><h2 id="hub-delete-title">删除 MCP 服务？</h2><IconButton icon="close" label="取消删除" disabled={busy} onClick={onCancel}/></header>
    <div className="hub-dialog-body"><p id="hub-delete-description">将从 DSH 移除 <strong>{server.name}</strong> 的配置并断开连接。其他应用中的原始配置不受影响。</p>{error && <div className="hub-banner bad" role="alert">{error}</div>}</div>
    <footer className="hub-dialog-footer"><div className="hub-actions"><button className="hub-button" onClick={onCancel} disabled={busy}>取消</button><button className="hub-button destructive" onClick={onDelete} disabled={busy}>{busy ? '删除中…' : '删除'}</button></div></footer>
  </section></div>;
}

function Pairs({ value = {}, onChange, label, field, variables = [], onReveal }) {
  const [revealed, setRevealed] = useState({}), [names, setNames] = useState({}), [error, setError] = useState('');
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
      const ref = val.match(/^(Bearer\s+)?(?:\$\{(env:|credential:)?([^}]*)\}|\{env:([^}]*)\})$/i);
      const prefix = ref?.[1] ?? '';
      const defaultPrefix = field === 'headers' && key.toLowerCase() === 'authorization' ? 'Bearer ' : '';
      const kind = ref ? ref[2] === 'credential:' ? 'credential' : 'env' : 'literal';
      const shown = ref ? ref[3] ?? ref[4] : val;
      const info = variables.find(row=>row.field === field && row.key === key);
      return <div className="hub-variable-row" key={index}><div className="hub-pair">
        <input aria-label={label+'名称 '+(index+1)} value={names[index] ?? key} placeholder="KEY" onChange={event=>setNames({...names,[index]:event.target.value})} onBlur={event=>rename(key,event.target.value.trim())}/>
        <select aria-label={label+'配置方式 '+(index+1)} value={kind} onChange={event=>set(key,event.target.value==='literal'?'':event.target.value==='env'?defaultPrefix+'${env:}':defaultPrefix+'${credential:}')}><option value="literal">直接填写</option><option value="env">环境变量引用</option><option value="credential">DSH 凭证引用</option></select>
        <input aria-label={label+'值 '+(index+1)} type={kind==='literal'&&!revealed[key]?'password':'text'} value={shown} placeholder={kind==='literal'?'填写值':kind==='env'?'例如 GITHUB_TOKEN':'凭证名称'} autoComplete="off" onChange={event=>set(key,kind==='literal'?event.target.value:kind==='env'?prefix+'${env:'+event.target.value+'}':prefix+'${credential:'+event.target.value+'}')}/>
        {kind==='literal' && <button type="button" className="hub-text-button" onClick={()=>revealed[key]?setRevealed({...revealed,[key]:false}):show(key,val)}>{revealed[key]?'隐藏':'显示'}</button>}
        <IconButton icon="close" label={'移除 '+key} onClick={()=>onChange(Object.fromEntries(entries.filter(([k])=>k!==key)))}/>
      </div><small className={info?.state==='missing'?'bad':'hub-help'}>{info?.state==='missing'?'找不到引用：'+info.missing.join('、'):kind==='credential'?'由 DSH 凭证服务解析，连接时验证':kind==='env'?'保存时读取 DSH 运行环境中的变量':val.includes(MASK)?'已配置；保持原样将保留原值':val?'已填写':'未填写'}</small></div>;
    })}
    {!entries.length && <p className="hub-help">没有额外的{label}。</p>}{error && <p className="bad" role="alert">{error}</p>}
  </div>;
}

function Arguments({ value = [], onChange, onReveal }) {
  const [shown,setShown] = useState({}), [error,setError] = useState('');
  const sensitive = (arg,index) => arg.includes(MASK) || /^-.*(?:token|password|secret|key|authorization)/i.test(arg) || /^-.*(?:token|password|secret|key|authorization)/i.test(value[index-1] ?? '');
  async function reveal(index) { try { const next=[...value]; if(next[index].includes(MASK))next[index]=await onReveal('args',index);onChange(next);setShown({...shown,[index]:true}); } catch(error){setError(textError(error));} }
  async function remove(index) { try { const next=await Promise.all(value.map((arg,i)=>arg.includes(MASK)?onReveal('args',i):arg));onChange(next.filter((_,i)=>i!==index)); }catch(error){setError(textError(error));} }
  return <div className="hub-pairs"><div className="hub-field-caption">启动参数<button type="button" className="hub-text-button" onClick={()=>onChange([...value,''])}>＋ 添加参数</button></div>
    {value.map((arg,index)=><div className="hub-argument" key={index}><span>{index+1}</span><input aria-label={'启动参数 '+(index+1)} type={sensitive(arg,index)&&!shown[index]?'password':'text'} value={arg} spellCheck="false" onChange={event=>onChange(value.map((v,i)=>i===index?event.target.value:v))}/>{sensitive(arg,index)&&<button type="button" className="hub-text-button" onClick={()=>shown[index]?setShown({...shown,[index]:false}):reveal(index)}>{shown[index]?'隐藏':'显示'}</button>}<IconButton icon="close" label={'删除参数 '+(index+1)} onClick={()=>remove(index)}/></div>)}
    <p className="hub-help">每项是一个参数，空格和空参数会原样保留；仅隐藏疑似凭证。</p>{error&&<p className="bad" role="alert">{error}</p>}
  </div>;
}

function Checks({ checks, busy, testing }) {
  return <div className="hub-checks" role="status">{checks.map((check, i) => <div className={'hub-check ' + (check.ok ? 'good' : 'bad')} key={i}><span className="hub-check-symbol">{check.ok ? '✓' : '!'}</span><div><strong>{check.label}</strong><p>{check.detail}</p></div></div>)}{busy && <div className="hub-check"><span className="hub-spinner"/><div><strong>{testing ? '正在测试连接' : '正在保存'}</strong><p>{testing ? '启动或连接 MCP，完成握手和工具发现后关闭测试连接；不保存配置。' : '保存配置并等待正式连接与工具注册…'}</p></div></div>}</div>;
}

function Editor({ draft, request, revision, onClose, onSaved }) {
  const [name, setName] = useState(draft.name ?? '');
  const [entry, setEntry] = useState(structuredClone(draft.entry ?? blank()));
  const [checks, setChecks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(0);
  const [busyAction, setBusyAction] = useState('');
  const [jsonRows, setJsonRows] = useState([]);
  const [jsonSelected, setJsonSelected] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [jsonIssues, setJsonIssues] = useState([]);
  const appliedJson = useRef('');
  const appliedSelection = useRef('');
  const [error, setError] = useState('');
  const [acceptUnsupported, setAcceptUnsupported] = useState(false);
  const [mode, setMode] = useState('form');
  const [json, setJson] = useState('');
  const [saved, setSaved] = useState(false);
  const [variables, setVariables] = useState([]);
  const transportDrafts = useRef({});
  const [warnings, setWarnings] = useState([]);
  const originalName = useRef(draft.originalName);
  const currentRevision = useRef(revision);
  const dialog = useRef(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy || reading > 0;
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.querySelector('input,button')?.focus();
    const listener = event => {
      if (event.key === 'Escape' && !busyRef.current) closeRef.current();
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]')];
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', listener);
    return () => { document.removeEventListener('keydown', listener); previous?.focus(); };
  }, []);
  function readJson(text, selected = jsonSelected) {
    const rows = parseEditorDocument(text, originalName.current || name);
    const row = rows.length === 1 ? rows[0] : rows.find(row => row.name === selected);
    if (!row) throw new Error('JSON 包含多个服务，请先选择要添加的服务');
    if (originalName.current && row.name && row.name !== originalName.current) throw new Error('编辑时请保持原服务名称；新服务请从添加入口导入');
    return { rows, row };
  }
  function applyJson(text, selected = jsonSelected) {
    try {
      const rows = parseEditorDocument(text, originalName.current || name);
      setJsonRows(rows);
      const { row } = readJson(text, selected);
      setEntry(row.entry); setJsonIssues(row.issues); setJsonError(''); setChecks([]); setVariables([]);
      if (!originalName.current && row.name && (appliedJson.current !== text || appliedSelection.current !== selected)) setName(row.name);
      appliedJson.current = text;
      appliedSelection.current = selected;
      return row;
    } catch(error) { setJsonError(textError(error)); return null; }
  }
  useEffect(() => {
    if (mode !== 'json') return;
    const timer = setTimeout(() => applyJson(json), 250);
    return () => clearTimeout(timer);
  }, [json, mode, jsonSelected]);
  const edit = (key, value) => { setEntry(current => ({ ...current, [key]: value })); setChecks([]); setVariables([]); };
  async function submit(action) {
    setBusy(true); setBusyAction(action); setError(''); setChecks([]);
    try {
      let next = entry, nextName = name.trim(), issues = jsonIssues;
      if (mode === 'json') { const {row} = readJson(json); next = row.entry; issues = row.issues; if (appliedJson.current === json) next.enabled = entry.enabled; if (appliedJson.current !== json || !nextName) nextName = row.name || nextName; setEntry(next); setName(nextName); setJsonIssues(row.issues); }
      if ([...(draft.issues ?? []), ...issues].length && !acceptUnsupported) throw new Error('请先核对并确认不迁移的配置字段');
      const body = { action: 'save', name: nextName, entry: next, candidateId: originalName.current ? undefined : draft.candidateId, originalName: originalName.current, revision: currentRevision.current, acceptUnsupported, mode: next.enabled === false ? 'draft' : undefined };
      const result = await request(action === 'check' ? '/test' : '/mutate', body);
      setChecks(result.checks ?? []);
      setVariables(result.variables ?? []);
      if (action === 'check') { if (result.ok) setError(''); return; }
      if (result.saved) {
        setSaved(true); originalName.current = nextName;
        const latest = await onSaved({ result, name: nextName }); currentRevision.current = latest.revision;
      }
      setWarnings(result.warnings ?? []);
      if (!result.ok && !result.draft && result.saved) setError('配置已保存，连接验证未通过。请补全后重试；可在已添加列表查看状态。');
    } catch (error) { setError(textError(error)); }
    finally { setBusy(false); setBusyAction(''); }
  }
  async function reveal(field, key) {
    setReading(count => count + 1);
    try {
      const result = await request('/reveal', { field, key, originalName: originalName.current, candidateId: originalName.current ? undefined : draft.candidateId });
      return result.value;
    } finally { setReading(count => count - 1); }
  }
  const transport = entry.transport;
  return <div className="hub-overlay"><section ref={dialog} className="hub-dialog" role="dialog" aria-modal="true" aria-labelledby="hub-editor-title">
    <header className="hub-dialog-header"><div><h2 id="hub-editor-title">{draft.originalName ? '编辑 MCP 服务' : '添加 MCP 服务'}</h2></div><IconButton icon="close" label="关闭配置窗口" onClick={onClose} disabled={busy || reading > 0}/></header>
    <div className="hub-dialog-body">
      {draft.source && <div className="hub-source-note"><Icon name="import"/><div>从 {draft.source} 导入<code>{draft.sourcePath}</code><small>配置复制到 DSH 后独立管理</small></div></div>}
      <div className="hub-editor-modes"><button type="button" className={mode === 'form' ? 'active' : ''} disabled={busy || reading > 0} onClick={() => { if (mode === 'json') { if (applyJson(json)) { setMode('form'); setError(''); } } }}>表单配置</button><button type="button" className={mode === 'json' ? 'active' : ''} disabled={busy || reading > 0} onClick={() => { setJson(JSON.stringify(entry, null, 2)); setMode('json'); }}>JSON 编辑</button></div>
      <fieldset disabled={busy || reading > 0} className="hub-fields">
        <label className="hub-field">服务名称<input value={name} disabled={!!originalName.current} onChange={event => { setName(event.target.value); setChecks([]); }} placeholder="例如 context7"/><small>字母、数字、下划线或连字符，最多 32 位</small></label>
        {mode === 'json' ? <div className="hub-json-config">{jsonRows.length > 1 && <label className="hub-field">选择服务<select aria-label="选择 JSON 服务" value={jsonSelected} onChange={event=>{setJsonSelected(event.target.value);applyJson(json,event.target.value);}}><option value="">请选择一个服务</option>{jsonRows.map(row=><option key={row.name} value={row.name}>{row.name}</option>)}</select></label>}<label className="hub-field">服务器配置<textarea aria-label="JSON 配置" className="hub-json-editor" value={json} onChange={event => { setJson(event.target.value); setChecks([]); }} spellCheck="false"/><small>支持单个配置、&#123;服务名: 配置&#125;、mcpServers 格式；服务名和连接方式会自动识别。</small></label>{jsonError ? <p className="bad" role="alert">{jsonError}</p> : jsonRows.length > 0 && <p className="hub-help" role="status">已识别 {name || '未命名服务'} · {entry.transport} · {Object.keys(entry.env ?? {}).length} 项环境变量</p>}</div> : <>
          <label className="hub-field">连接方式<select value={transport} onChange={event => { const t = event.target.value; transportDrafts.current[entry.transport] = entry; setEntry({ ...(transportDrafts.current[t] ?? (t === 'stdio' ? blank() : { transport: t, url: '', headers: {} })), enabled: entry.enabled }); setChecks([]); setVariables([]); }}>{!['stdio','streamable-http'].includes(transport) && <option value={transport}>{transport}（暂不支持）</option>}<option value="stdio">stdio · 本地命令</option><option value="streamable-http">Streamable HTTP · 远程服务</option></select></label>
          {transport === 'stdio' ? <>
            <label className="hub-field">启动命令<input value={entry.command ?? ''} onChange={event => edit('command', event.target.value)} placeholder="npx、uvx 或可执行文件的绝对路径"/></label>
            <Arguments value={entry.args} onChange={value => edit('args', value)} onReveal={reveal}/>
            <label className="hub-field">工作目录 <span className="hub-optional">可选</span><input value={entry.cwd ?? ''} onChange={event => edit('cwd', event.target.value)} placeholder="留空使用 DSH 工作目录"/></label>
            <Pairs label="环境变量" field="env" value={entry.env} variables={variables} onReveal={reveal} onChange={value => edit('env', value)}/>
          </> : <><label className="hub-field">服务地址<input value={entry.url ?? ''} onChange={event => edit('url', event.target.value)} placeholder="https://example.com/mcp"/><small>地址中的凭证已隐藏，修改地址时请填写完整新地址。</small></label><Pairs label="请求头" field="headers" value={entry.headers} variables={variables} onReveal={reveal} onChange={value => edit('headers', value)}/></>}
        </>}
        {!![...(draft.issues ?? []), ...jsonIssues].length && <div className="hub-compatibility"><strong>有配置需要核对</strong><ul>{[...new Set([...(draft.issues ?? []), ...jsonIssues])].map(issue => <li key={issue}>{issue}</li>)}</ul><label><input type="checkbox" checked={acceptUnsupported} onChange={event => setAcceptUnsupported(event.target.checked)}/>我已核对，确认不迁移上述不支持的字段</label></div>}
      </fieldset>
      <label className="hub-enable-field"><input type="checkbox" checked={entry.enabled !== false} disabled={busy || reading > 0} onChange={event => edit('enabled', event.target.checked)}/>启用此服务<span className="hub-help">停用时仅保存配置</span></label>
      <Checks checks={checks} busy={busy} testing={busyAction === 'check'}/>
      {error && <div className="hub-banner warn" role="alert">{error}</div>}
      {warnings.map(warning => <div className="hub-banner warn" key={warning}>{warning}</div>)}

    </div>
    <footer className="hub-dialog-footer"><span className="hub-help">{saved ? '配置已保存，可修正后重试' : entry.enabled === false ? '保存配置，保持停用' : '保存后验证正式连接'}</span><div className="hub-actions"><button className="hub-button" disabled={busy || reading > 0} onClick={onClose}>取消</button><button className="hub-button" disabled={busy || reading > 0} onClick={() => submit('check')}>{busy && busyAction === 'check' ? '测试中…' : '测试连接'}</button><button className="hub-button primary" disabled={busy || reading > 0} onClick={() => submit('save')}>{busy && busyAction !== 'check' ? '保存中…' : draft.originalName ? '保存' : '添加'}</button></div></footer>
  </section></div>;
}

function ServerRow({ server, busy, onEdit, onAction }) {
  const [open, setOpen] = useState(false);
  const [detailTab, setDetailTab] = useState('tools');
  const [query, setQuery] = useState('');
  const { name, entry, status, source, tools } = server;
  const connected = status.state === 'connected';
  return <article className={'hub-server ' + (open ? 'expanded' : '')}>
    <div className="hub-server-top"><button type="button" className="hub-expand-button" aria-expanded={open} aria-label={(open ? '收起 ' : '展开 ') + name} onClick={() => setOpen(!open)}><Icon name="chevron" className={open ? 'rotated' : ''}/></button>
      <span className="hub-avatar">{name.slice(0, 1).toUpperCase()}</span><button type="button" className="hub-server-name" onClick={() => setOpen(!open)} aria-expanded={open}><strong>{name}</strong><span><Status status={status}/><Badge>{connected ? tools.length : '—'} 个工具</Badge><Badge>{entry?.transport === 'stdio' ? 'stdio' : entry?.transport === 'streamable-http' ? 'HTTP' : '插件管理'}</Badge><span className="hub-origin">{source?.app}</span></span></button>
      <div className="hub-actions"><IconButton icon="edit" label={'编辑 ' + name} disabled={!server.editable || busy} onClick={() => onEdit(server)}/><IconButton icon="refresh" label={'重启 ' + name} disabled={status.state === 'disabled' || !server.editable || busy} onClick={() => onAction('restart', server)}/><IconButton icon="trash" label={'删除 ' + name} className="danger" disabled={!server.removable || busy} onClick={() => onAction('remove', server)}/><button type="button" className="hub-switch" role="switch" aria-label={'启用 ' + name} aria-checked={entry?.enabled !== false && !!entry} disabled={!server.editable || busy} onClick={() => onAction('toggle', server)}><span/></button></div>
    </div>
    {open && <div className="hub-server-details"><div className="hub-detail-tabs">{[['tools','工具'],['config','配置'],['diagnostics','诊断']].map(([id,label]) => <button type="button" key={id} className={id === detailTab ? 'active' : ''} onClick={() => setDetailTab(id)}>{label}{id === 'tools' && <small>{tools.length}</small>}</button>)}</div>
      {detailTab === 'tools' && <div className="hub-tools"><div className="hub-detail-heading"><span>服务提供的工具</span>{tools.length > 3 && <input aria-label={'搜索 ' + name + ' 的工具'} value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索工具…"/>}</div>{!tools.length && <p className="hub-help">{connected ? '此服务暂未提供工具。' : '服务连接成功后，这里将显示可用工具。'}</p>}{tools.filter(tool => (tool.name + tool.description).toLowerCase().includes(query.toLowerCase())).map(tool => <details className="hub-tool" key={tool.name}><summary><Icon name="bolt" size={15}/><code>{tool.name}</code><Icon name="chevron" size={14}/></summary><p>{tool.description || '无描述'}</p><pre>{JSON.stringify(tool.schema, null, 2)}</pre></details>)}</div>}
      {detailTab === 'config' && <div className="hub-config"><div className="hub-definition"><span>配置归属</span><strong>{server.editable ? 'DSH 全局配置' : '由其他插件管理'}</strong><span>导入来源</span><strong>{source?.app ?? 'DSH'}</strong>{source?.path && <><span>来源文件</span><code>{source.path}</code></>}</div><pre>{JSON.stringify(entry, null, 2)}</pre><p className="hub-help">凭证已隐藏；普通启动参数按原值显示。</p></div>}
      {detailTab === 'diagnostics' && <div className="hub-diagnostics"><Status status={status}/><p>{status.lastError || (connected ? '服务已连接，工具已同步到 DSH。' : status.state === 'disabled' ? '配置已保留，启用后开始连接。' : '请检查运行环境、变量和认证配置。')}</p>{status.reason && <code>{status.reason}</code>}</div>}
    </div>}
  </article>;
}

function Sources({ sources, scanning, scanError, onScan, onImport }) {
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
        <button className="hub-source-heading" type="button" aria-expanded={open} onClick={() => setExpanded({ ...expanded, [source.id]: !open })}>
          <Icon name="chevron" className={open ? 'rotated' : ''}/><span className={'hub-source-logo ' + source.id}>{source.id === 'opencode' ? '〈〉' : source.name.slice(0,1)}</span><strong>{source.name}</strong><Badge>{source.candidates.length} 项配置</Badge><code>{source.files.find(file => file.state === 'read')?.path}</code>
        </button>
        {open && <div className="hub-source-content">{candidates.map(candidate => <div className="hub-candidate" key={candidate.id}>
          <span className="hub-candidate-icon"><Icon name="box"/></span>
          <div className="hub-candidate-info"><strong>{candidate.name}</strong><span>{candidate.entry.transport === 'stdio' ? '本地命令' : '远程服务'}<i>·</i>{candidate.entry.transport === 'stdio' ? candidate.entry.command : candidate.entry.url}</span>{candidate.nameConflict && <small className="warn">名称冲突，添加时需要修改名称</small>}{!!candidate.issues.length && <small className="warn">有 {candidate.issues.length} 项配置需要核对</small>}{candidate.duplicateSource && <small>也发现于 {candidate.duplicateSource}</small>}</div>
          {candidate.duplicate ? <span className="hub-already"><Icon name="check" size={15}/>已添加 · {candidate.duplicate}</span> : <button className="hub-button" onClick={() => onImport(candidate)}><Icon name="plus" size={16}/>添加</button>}
        </div>)}</div>}
      </article>;
    })}</div>
  </>;
}

export function App({ request = apiRequest, preview = false }) {
  const [tab, setTab] = useState('installed');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState(null);
  const [noticePaused, setNoticePaused] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [sources, setSources] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [draft, setDraft] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState('');
  const fileInput = useRef(null);
  const alive = useRef(true);
  const generation = useRef(0);
  const sourcesLoaded = useRef(false);
  const sourceRevision = useRef(null);
  const sourceGeneration = useRef(0);
  const initialScanStarted = useRef(false);
  const scanningTask = useRef(null);
  async function refresh(quiet = false) {
    const id = ++generation.current;
    if (!quiet) setLoading(true);
    try { const next = await request('/servers'); if (alive.current && id === generation.current) { setData(next); setLoadError(''); if (sourcesLoaded.current && sourceRevision.current !== next.revision) await syncSources(next.revision); } return next; }
    catch (error) { if (alive.current && id === generation.current) setLoadError(textError(error)); throw error; }
    finally { if (alive.current && id === generation.current) setLoading(false); }
  }
  useEffect(() => {
    alive.current = true;
    refresh().catch(() => {});
    const timer = setInterval(() => { if (!document.hidden) refresh(true).catch(() => {}); }, 4000);
    return () => { alive.current = false; clearInterval(timer); };
  }, [request]);
  useEffect(() => {
    if (!notice || noticePaused) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice, noticePaused]);
  function notify(text, tone = 'good') { setNoticePaused(false); setNotice({text,tone,id:Date.now()}); }
  async function syncSources(revision) {
    const id = ++sourceGeneration.current;
    try { const result = await request('/sources'); if (alive.current && id === sourceGeneration.current) { setSources(result.sources); setScanError(''); sourceRevision.current = revision; } }
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
      try { const result = await request('/scan', {}); if (alive.current) { setSources(result.sources); sourcesLoaded.current = true; sourceRevision.current = data?.revision; } }
      catch (error) { if (alive.current) setScanError(textError(error)); }
      finally { if (alive.current) setScanning(false); scanningTask.current = null; }
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
  async function action(action, server, confirmed = false) {
    if (action === 'remove' && !confirmed) { setDeleteError(''); setConfirm(server); return; }
    setBusy(server.name); setError(''); setDeleteError(''); setNotice(null);
    try {
      await request('/mutate', { action, name: server.name, revision: data.revision, enabled: server.entry?.enabled === false });
      await refresh(true); setConfirm(null);
      notify(action === 'remove' ? server.name + ' 已删除' : action === 'restart' ? '已请求重启 ' + server.name : server.name + (server.entry?.enabled === false ? ' 已启用' : ' 已停用'));
    } catch (error) { if(action === 'remove')setDeleteError(textError(error));else setError(textError(error)); }
    finally { setBusy(''); }
  }
  const servers = data?.servers ?? [];
  const connected = servers.filter(server => server.status.state === 'connected').length;
  const failures = servers.filter(server => ['failed','waiting-credentials'].includes(server.status.state)).length;
  const visible = servers.filter(server => (server.name + (server.source?.app ?? '')).toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || filter === 'connected' && server.status.state === 'connected' || filter === 'disabled' && server.status.state === 'disabled' || filter === 'failed' && ['failed', 'waiting-credentials'].includes(server.status.state)));
  return <main className="mcp-hub" data-preview={preview}>
    <header className="hub-header"><div className="hub-brand"><span className="hub-brand-mark"><Icon name="box" size={25}/></span><div><h1>MCP Hub</h1></div></div><div className="hub-header-actions"><IconButton icon="refresh" label="刷新服务状态" disabled={loading} onClick={() => refresh().catch(() => {})}/><button className="hub-button primary" disabled={!data} onClick={() => setDraft({ entry: blank() })}><Icon name="plus" size={18}/>添加 MCP</button></div></header>
    <p className="hub-description">连接、管理你的 MCP 服务，把常用工具带到 DSH。</p>
    <nav className="hub-main-tabs" aria-label="MCP Hub 页面"><button type="button" aria-current={tab === 'installed' ? 'page' : undefined} className={tab === 'installed' ? 'active' : ''} onClick={() => setTab('installed')}><Icon name="box"/>已添加 <small>{servers.length}</small></button><button type="button" aria-current={tab === 'import' ? 'page' : undefined} className={tab === 'import' ? 'active' : ''} onClick={() => setTab('import')}><Icon name="import"/>本地导入</button><span className="hub-coming" title="后续版本支持在线 MCP 目录">搜索发现 <small>即将推出</small></span></nav>
    {(error || loadError) && <div className="hub-banner bad" role="alert"><Icon name="info"/><span>{error || loadError}</span><button className="hub-text-button" onClick={() => { setError(''); refresh().catch(() => {}); }}>重试</button></div>}
    {notice && <div className={'hub-toast ' + notice.tone} role="status" onMouseEnter={()=>setNoticePaused(true)} onMouseLeave={()=>setNoticePaused(false)} onFocus={()=>setNoticePaused(true)} onBlur={()=>setNoticePaused(false)}><Icon name="check"/><span>{notice.text}</span><IconButton icon="close" label="关闭通知" onClick={() => setNotice(null)}/></div>}
    {tab === 'installed' ? <>
      <div className="hub-stats"><div><strong>{servers.length}</strong><span>个 MCP 服务</span></div><div><i className="good"/><strong>{connected}</strong><span>已连接</span></div><div><i className={failures ? 'bad' : 'muted'}/><strong>{failures}</strong><span>需要处理</span></div><span className="hub-scope"><Icon name="folder" size={15}/>DSH 全局配置</span></div>
      <div className="hub-toolbar"><label className="hub-search"><Icon name="search"/><input aria-label="搜索已添加的 MCP" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索服务名称或来源…"/></label><select aria-label="筛选连接状态" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">全部状态</option><option value="connected">已连接</option><option value="disabled">已停用</option><option value="failed">需要处理</option></select></div>
      <div className="hub-list-label"><span>服务</span><span>管理</span></div>
      <div className="hub-server-list">{visible.map(server => <ServerRow key={server.name} server={server} busy={!!busy} onEdit={server => setDraft({ name: server.name, entry: server.entry, originalName: server.name })} onAction={action}/>)}</div>
      {!visible.length && <div className="hub-empty"><Icon name="box" size={30}/><h2>{loading ? '正在读取服务…' : servers.length ? '没有匹配的服务' : '连接你的第一个 MCP'}</h2><p>{servers.length ? '试试其他名称或切换状态筛选。' : '手动添加服务，或从其他 AI 应用导入已有配置。'}</p>{!servers.length && !loading && <button className="hub-button" onClick={() => setTab('import')}><Icon name="import"/>从本机导入</button>}</div>}
    </> : <><div className="hub-file-import"><span>从其他应用导入已有 MCP</span><button className="hub-button" disabled={scanning} onClick={() => fileInput.current.click()}><Icon name="folder" size={16}/>选择配置文件</button><input type="file" hidden ref={fileInput} accept=".json,.jsonc,.toml" onChange={readConfigFile}/></div><Sources sources={sources} scanning={scanning} scanError={scanError} onScan={scan} onImport={candidate => setDraft({ ...candidate, candidateId: candidate.id })}/></>}
    {confirm && <DeleteDialog server={confirm} busy={!!busy} error={deleteError} onCancel={()=>setConfirm(null)} onDelete={()=>action('remove',confirm,true)}/>}
    {draft && <Editor draft={draft} revision={data?.revision} request={request} onClose={() => setDraft(null)} onSaved={async ({result,name}) => {
      const next = await refresh(true);
      if(result.ok || result.draft) { setDraft(null); notify(result.draft ? name + ' 已保存，保持停用' : name + ' 已保存', result.draft ? 'muted' : 'good'); }
      if(result.warnings?.length) setError(result.warnings.join('；'));
      return next;
    }}/>}
  </main>;
}
