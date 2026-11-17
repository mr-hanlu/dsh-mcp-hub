import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { setLocale } from './i18n.js';
import { parseEditorDocument } from '../shared/mcp-config.js';
import { redact, restoreMasked } from '../shared/display.js';
import { buildBackup } from '../shared/backup.js';
import { installOptions } from '../host/catalog.js';

setLocale(new URLSearchParams(globalThis.location.search).get('lang') || 'zh');
document.documentElement.dataset.dsThemeSource = 'dark';
document.body.setAttribute('data-ds-dark-theme', '');


const registryServers = [
  { name: 'io.github.upstash/context7', title: 'Context7', description: 'Up-to-date documentation and code examples for libraries, delivered through a remote MCP endpoint.', version: '1.0.0', repository: { url: 'https://github.com/upstash/context7' }, remotes: [{ type: 'streamable-http', url: 'https://mcp.context7.com/mcp', headers: [] }], packages: [{ registryType: 'npm', identifier: '@upstash/context7-mcp', version: '1.0.0', runtimeHint: 'npx' }] },
  { name: 'io.github.modelcontextprotocol/filesystem', title: 'Filesystem', description: 'Secure file operations with configurable access controls.', version: '0.6.2', repository: { url: 'https://github.com/modelcontextprotocol/servers' }, packages: [{ registryType: 'npm', identifier: '@modelcontextprotocol/server-filesystem', version: '0.6.2', runtimeHint: 'npx', packageArguments: [{ type: 'positional', value: '/Users/demo/Documents' }], environmentVariables: [] }] },
  { name: 'com.example/legacy-sse', title: 'Legacy SSE demo', description: 'A legacy SSE endpoint that DSH cannot connect to.', version: '1.0.0', remotes: [{ type: 'sse', url: 'https://example.com/sse', headers: [] }], packages: [] },
];
const registrySummary = server => ({ name: server.name, title: server.title, description: server.description, version: server.version, repository: server.repository?.url, websiteUrl: server.websiteUrl, transports: [...new Set((server.remotes ?? []).map(remote => remote.type))], packageTypes: [...new Set((server.packages ?? []).map(pkg => pkg.registryType))], canInstall: installOptions(server).canInstall });

const tool = (name, description, properties) => ({ name, description, schema: { type: 'object', properties, required: Object.keys(properties) } });
let state = {
  revision: 1, version: 1, location: { hostname: 'MacBook Pro · 预览', home: '/Users/demo', platform: 'darwin' },
  servers: [
    { name: 'context7', entry: { transport: 'streamable-http', url: 'https://mcp.context7.com/mcp', headers: {}, enabled: true }, status: { state: 'connected', toolCount: 2 }, editable: true, removable: true, source: { app: 'Codex', path: '~/.codex/config.toml' }, tools: [tool('resolve-library-id', '查找库的 Context7 ID，获取对应版本的文档。', { libraryName: { type: 'string', description: '库的名称' } }), tool('query-docs', '查询最新的库文档和代码示例。', { libraryId: { type: 'string' }, query: { type: 'string' } })] },
    { name: 'playwright', entry: { transport: 'stdio', command: 'npx', args: ['-y', '@playwright/mcp@latest'], env: {}, enabled: true }, status: { state: 'connected', toolCount: 3 }, editable: true, removable: true, source: { app: 'Cursor' }, tools: [tool('browser_navigate','打开指定页面。',{url:{type:'string'}}), tool('browser_snapshot','获取当前页面快照。',{}),tool('browser_click','点击页面元素。',{element:{type:'string'}})] },
    { name: 'github', entry: { transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'], env: { GITHUB_TOKEN: '••••••••' }, enabled: true }, status: { state: 'waiting-credentials' }, editable: true, removable: true, source: { app: 'Claude Code' }, tools: [] },
    { name: 'filesystem', entry: { transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/Users/demo/Documents'], env: {}, enabled: false }, status: { state: 'disabled' }, editable: true, removable: true, source: { app: '手动添加' }, tools: [] },
  ],
};
const candidates = [
  {id:'context7',name:'context7',entry:state.servers[0].entry,duplicate:'context7',source:'Codex',sourcePath:'~/.codex/config.toml',issues:[]},
  {id:'memory',name:'memory',entry:{transport:'stdio',command:'npx',args:['-y','@modelcontextprotocol/server-memory'],env:{}},source:'Codex',sourcePath:'~/.codex/config.toml',issues:[]},
  {id:'github',name:'github-work',entry:{transport:'stdio',command:'npx',args:['-y','@modelcontextprotocol/server-github'],env:{GITHUB_TOKEN:'${env:GITHUB_TOKEN}'}},source:'Claude Code',sourcePath:'~/.claude.json',issues:[]},
];
const fileSources = [];
const sourceRaw = new Map(candidates.map(row=>[row.id,row.entry]));
const imported = new Map([['context7','context7']]);
const batches = new Map();
const raw = Object.fromEntries(state.servers.map(row=>[row.name,structuredClone(row.entry)]));
raw.github.env.GITHUB_TOKEN='demo-github-token';
function sourceResult() { return {sources:[{id:'codex',name:'Codex',files:[{path:'~/.codex/config.toml',state:'read'}],candidates:candidates.slice(0,2).map(row=>({...row,duplicate:state.servers.some(server=>server.name===imported.get(row.id))?imported.get(row.id):undefined}))},{id:'claude',name:'Claude Code',files:[{path:'~/.claude.json',state:'read'}],candidates:candidates.slice(2)},{id:'opencode',name:'OpenCode',files:[{path:'~/.config/opencode/opencode.json',state:'missing'}],candidates:[]},{id:'cursor',name:'Cursor',files:[{path:'~/.cursor/mcp.json',state:'read'}],candidates:[]},...fileSources.map(source=>({...source,candidates:source.candidates.map(row=>({...row,duplicate:state.servers.some(server=>server.name===imported.get(row.id))?imported.get(row.id):undefined}))}))]}; }
function bump() { state.revision++; state.version++; }
function statusSnapshot() {
  return { revision: state.revision, version: state.version, servers: state.servers.map(server => ({ name: server.name, ...server.status, verification: server.verification, editable: server.editable })) };
}
async function request(path, body) {
  await new Promise(resolve => setTimeout(resolve, 350));
  if(path === '/servers') return structuredClone({ ...state, version: state.version });
  if(path === '/status') return structuredClone(statusSnapshot());
  if(path === '/wait') { await new Promise(resolve => setTimeout(resolve, 1500)); return structuredClone(statusSnapshot()); }
  if(path === '/tools') { const row = state.servers.find(server => server.name === body.name); return { name: body.name, tools: (row?.tools ?? []).map(tool => ({ ...tool })) }; }
  if(path === '/probe') { const row = state.servers.find(server => server.name === body.name); if(!row) throw new Error('找不到该服务'); const tested = await realTest({ name: body.name, originalName: body.name, entry: row.entry }); return tested; }
  if(path === '/parse') {
    const rows=parseEditorDocument(body.text,body.filename.replace(/\.(?:jsonc?|toml)$/i,''),body.filename);
    const source={id:'file-'+crypto.randomUUID(),name:'配置文件 · '+body.filename,manual:true,files:[{path:body.filename,state:'read'}],candidates:rows.map(row=>{const id=crypto.randomUUID();sourceRaw.set(id,row.entry);return {...row,id,entry:redact(row.entry),source:'配置文件',sourcePath:body.filename};})};
    fileSources.push(source); return {sources:[source]};
  }
  if(path === '/scan' || path === '/sources') return sourceResult();
  if(path === '/source-remove') { const index=fileSources.findIndex(source=>source.id===body.id); if(index<0) throw new Error('找不到该导入来源'); fileSources.splice(index,1); return sourceResult(); }
  if(path === '/reveal') { const source = body.originalName ? raw[body.originalName] : sourceRaw.get(body.candidateId); return {value:source?.[body.field]?.[body.key] ?? ''}; }
  if(path === '/catalog-search') { const query=String(body.query??'').trim().toLowerCase(); const matches=registryServers.filter(server=>!query||(server.name+' '+server.title+' '+server.description).toLowerCase().includes(query)); const offset=Number(body.cursor)||0; const items=matches.slice(offset,offset+2).map(registrySummary); return {query:body.query??'',items,nextCursor:offset+2<matches.length?String(offset+2):null,count:items.length}; }
  if(path === '/catalog-detail') { const server=registryServers.find(row=>row.name===body.name); if(!server) throw new Error('官方目录中找不到这个服务'); return {item:registrySummary(server),install:installOptions(server),raw:server}; }
  if(path === '/export') { const servers=Object.entries(raw).map(([name,entry])=>({name,entry:body.includeSecrets===true?entry:redact(entry)})); const result=buildBackup(servers); return {includeSecrets:body.includeSecrets===true,count:Object.keys(result.backup).length,...result}; }
  const variables = ['env','headers'].flatMap(field=>Object.entries(body.entry?.[field]??{}).map(([key,value])=>({field,key,kind:value.includes('${')?'环境引用':'直接填写',state:value.includes('${')?'missing':value?'configured':'empty',missing:value.includes('${')?[value]:[]})));
  const checks = [{label:'变量与请求头名称',ok:!variables.some(row=>row.state==='missing'),detail:variables.some(row=>row.state==='missing')?'引用尚未配置，请补全后重试。':'配置检查通过'}];
  async function realTest(payload = body) {
    const previous = payload.originalName ? raw[payload.originalName] : sourceRaw.get(payload.candidateId);
    const entry = restoreMasked(payload.entry,previous ?? {});
    const response = await fetch('/preview/test', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:payload.name,entry})});
    if(!response.ok) throw new Error('连接测试服务不可用，请重新启动本地预览；未执行实际验证');
    return response.json();
  }
  if(path === '/test') return realTest();
  if(path === '/mutate') {
    if(body.action === 'bulk') {
      const names = body.names ?? [];
      if(body.operation !== 'restart') for(const name of names){const row=state.servers.find(r=>r.name===name);if(!row)continue;row.entry.enabled=body.operation==='enable';row.status.state=body.operation==='enable'?'connected':'disabled';}
      bump();
      return {ok:true,affected:names.length};
    }
    if(body.action === 'import') {
      const importedNames=[],skipped=[];
      for(const item of body.entries ?? []) {
        if(!item?.name) throw new Error('批量配置缺少服务名称');
        if(state.servers.some(row=>row.name===item.name)) { skipped.push({name:item.name,reason:'已存在'}); continue; }
        const entry={...item.entry,enabled:true};
        const next={name:item.name,entry:redact(entry),editable:true,removable:true,status:{state:'connected',toolCount:0},source:{app:'手动添加'},tools:[]};
        state.servers.push(next); raw[item.name]=structuredClone(entry); importedNames.push(item.name);
      }
      if(importedNames.length) bump();
      const batchId=crypto.randomUUID();
      if(importedNames.length) batches.set(batchId,{names:importedNames,entries:Object.fromEntries(importedNames.map(name=>[name,structuredClone(raw[name])]))});
      return {ok:true,saved:importedNames.length>0,batchId,imported:importedNames,skipped,verifying:importedNames.length>0,checks:[{label:'配置已保存',ok:true,detail:`一次写入 ${importedNames.length} 个服务`}]};
    }
    if(body.action === 'undo-import') {
      const batch=batches.get(body.batchId);
      if(!batch) throw new Error('这次添加已失效，无法撤销');
      const removed=[],skipped=[];
      for(const name of batch.names) {
        const row=state.servers.find(row=>row.name===name);
        if(!row) { skipped.push({name,reason:'已被删除或改名'}); continue; }
        if(JSON.stringify(row.entry)!==JSON.stringify(batch.entries[name])) { skipped.push({name,reason:'已被修改'}); continue; }
        removed.push(name);
      }
      state.servers=state.servers.filter(row=>!removed.includes(row.name));
      for(const name of removed) delete raw[name];
      batches.delete(body.batchId); bump();
      return {ok:true,removed,skipped};
    }
    if(body.action === 'save') {
      if(!body.name) throw new Error('请填写服务名称');
      if(body.mode !== 'draft') { const tested = await realTest(); if(!tested.ok) return {...tested,saved:false}; }
      const renamed = Boolean(body.originalName && body.originalName !== body.name);
      if(renamed) {
        if(state.servers.some(row=>row.name === body.name)) throw new Error('已有同名服务器，请修改名称');
        state.servers = state.servers.filter(row=>row.name !== body.originalName);
        if(raw[body.originalName]) { raw[body.name] = raw[body.originalName]; delete raw[body.originalName]; }
      }
      const existing = state.servers.find(row=>row.name === body.name);
      if(existing && !body.originalName) throw new Error('已有同名服务器，请修改名称');
      const next={name:body.name,entry:redact(body.entry),editable:true,removable:true,status:{state:body.mode==='draft'||body.entry.enabled===false?'disabled':'connected',toolCount:0},source:{app:'手动添加'},tools:[]};
      raw[body.name]=restoreMasked(body.entry,(body.originalName ? raw[body.originalName] : sourceRaw.get(body.candidateId)) ?? {}); if(body.candidateId)imported.set(body.candidateId,body.name);
      if(existing) Object.assign(existing,next); else state.servers.push(next);
      bump();
      return {ok:body.mode!=='draft',saved:true,draft:body.mode==='draft',checks};
    }
    if(body.action === 'remove') state.servers=state.servers.filter(row=>row.name!==body.name);
    if(body.action === 'toggle') {const row=state.servers.find(row=>row.name===body.name);row.entry.enabled=body.enabled;row.status.state=body.enabled?'connected':'disabled';}
    bump();
    return {ok:true};
  }
  throw new Error('未知预览操作');
}
createRoot(document.getElementById('root')).render(<App request={request} preview/>);
