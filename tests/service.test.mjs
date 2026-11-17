import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HubService } from '../src/host/service.js';
import { createHandler, apply } from '../src/host/index.js';
import { HubError } from '../src/shared/errors.js';
function fixture({ status = {state:'connected',toolCount:1}, schemas = [{name:'mcp__demo__read',parameters:{type:'object'}}], servers = {}, base = {}, waitMs = 8, env = { MCP_HUB_TEST_TOKEN: 'test-value' }, extraRows = [], metaPath = null } = {}) {
  const form={ns:'mcp-manager',revision:1,value:{servers},base:{servers:base}};
  const writes=[];
  const ctx={settings:{describe:()=>[structuredClone(form)],mutate:async(ns,ops,revision)=>{
    assert.equal(ns,form.ns);assert.equal(revision,form.revision);writes.push(ops);
    for(const op of ops){const name=op.path[1];if(op.op==='unset')delete form.value.servers[name];else if(op.path.length===2)form.value.servers[name]=op.value;else form.value.servers[name][op.path[2]]=op.value;}
    form.revision++;
  }},mcpManager:{list:()=>[...Object.keys(form.value.servers).map(name=>({name,status,configured:true})),...extraRows],restart:async()=>{}},tools:{schemas:()=>schemas}};
  return {service:new HubService(ctx,{metaPath,waitMs,intervalMs:1,env}),form,writes};
}
const body={action:'save',name:'demo',entry:{transport:'streamable-http',url:'https://example.com/mcp',headers:{}},revision:1};
const settle = (ms = 40) => new Promise(resolve => setTimeout(resolve, ms));
test('saving returns immediately and the background verification reports agreement',async()=>{
  const {service,writes}=fixture();const result=await service.mutate(body);
  assert.equal(result.ok,true);assert.equal(result.saved,true);assert.equal(result.verifying,true);
  assert.equal(writes.length,1);assert.equal(service.verifications.get('demo').state,'ok');
});
test('schema defaults in the effective entry do not cause a false verification failure',async()=>{
  const {service,form}=fixture();
  const mutate=service.ctx.settings.mutate;
  service.ctx.settings.mutate=async(...args)=>{await mutate(...args);Object.assign(form.value.servers.demo,{args:[],env:{},cwd:'',command:'',startupTimeoutMs:30000,reconnect:{enabled:true}});};
  assert.equal((await service.mutate(body)).ok,true);
});
test('editing must not mistake the previous connection for the new generation',async()=>{
  const {service}=fixture({servers:{demo:{...body.entry,url:'https://old.example/mcp',enabled:true}},status:{state:'connected',toolCount:1,connectedAt:123}});
  const result=await service.mutate({...body,originalName:'demo'});
  assert.equal(result.verifying,true);
  await settle();
  const record=service.verifications.get('demo');
  assert.equal(record.state,'failed');assert.match(record.detail,/超时/);
});
test('persisted but failed connection is not success and is disabled',async()=>{
  const {service,form}=fixture({status:{state:'failed',reason:'auth',lastError:'denied'}});
  const result=await service.mutate(body);assert.equal(result.verifying,true);
  await settle();
  assert.equal(service.verifications.get('demo').state,'failed');
  assert.equal(form.value.servers.demo.enabled,false);
});
test('connected without promised registered tools never counts as verified',async()=>{
  const {service}=fixture({schemas:[]});const result=await service.mutate(body);
  assert.equal(result.verifying,true);
  await settle();
  const record=service.verifications.get('demo');
  assert.equal(record.state,'failed');assert.match(record.detail,/超时/);
});
test('a running verification can be cancelled without disabling the server',async()=>{
  const {service,form}=fixture({servers:{demo:{...body.entry,enabled:true}},status:{state:'connecting'}});
  const result=await service.mutate({...body,originalName:'demo'});
  assert.equal(result.verifying,true);assert.equal(service.verifications.get('demo').state,'verifying');
  assert.deepEqual(service.cancelVerification('demo'),{cancelled:true});
  assert.equal(service.verifications.get('demo').state,'cancelled');
  assert.equal(form.value.servers.demo.enabled,true);
});
test('retained cleanup rows are reported as cleanup rather than plugin servers',async()=>{
  const {service}=fixture({extraRows:[{name:'gone',configured:false,status:{state:'failed',reason:'cleanup',result:{closeConfirmed:false,cleanupError:'busy'}}}]});
  const [row]=(await service.list()).servers;
  assert.equal(row.managed,'cleanup');assert.equal(row.removable,false);assert.equal(row.editable,false);
  assert.equal(row.status.closeConfirmed,false);assert.equal(row.status.cleanupError,'busy');
  assert.equal(row.source.app,'已删除，清理中');
});
test('retry details from the official status reach the client',async()=>{
  const {service}=fixture({servers:{demo:body.entry},status:{state:'reconnecting',attempt:3,maxAttempts:10,nextRetryAtMs:1234,lastError:'boom'}});
  const [row]=(await service.list()).servers;
  assert.deepEqual({attempt:row.status.attempt,maxAttempts:row.status.maxAttempts,nextRetryAtMs:row.status.nextRetryAtMs},{attempt:3,maxAttempts:10,nextRetryAtMs:1234});
});
test('missing ambient variable prevents all writes',async()=>{
  const {service,writes}=fixture();const result=await service.mutate({...body,entry:{...body.entry,headers:{Authorization:'${env:MCP_HUB_NONEXISTENT_TEST}'}}});
  assert.equal(result.ok,false);assert.equal(result.saved,false);assert.equal(writes.length,0);
});
test('stale revisions and duplicate names are refused before writing',async()=>{
  const {service,writes}=fixture({servers:{demo:body.entry}});
  await assert.rejects(service.mutate({...body,revision:0}),/配置已发生变化/);
  await assert.rejects(service.mutate(body),/已有同名/);assert.equal(writes.length,0);
});
test('draft saving is explicitly unsuccessful and disabled',async()=>{
  const {service,form}=fixture();const result=await service.mutate({...body,mode:'draft'});
  assert.equal(result.ok,false);assert.equal(result.draft,true);assert.equal(form.value.servers.demo.enabled,false);
});
test('a new save ignores a pasted disabled flag unless a draft is explicit',async()=>{
  const {service,form}=fixture();
  const result=await service.mutate({...body,entry:{...body.entry,enabled:false}});
  assert.equal(result.ok,true);assert.equal(form.value.servers.demo.enabled,true);
});
test('editing a disabled service preserves its disabled state',async()=>{
  const {service,form}=fixture({servers:{demo:{...body.entry,enabled:false}}});
  const result=await service.mutate({...body,originalName:'demo',entry:{...body.entry,enabled:false}});
  assert.equal(result.draft,true);assert.equal(form.value.servers.demo.enabled,false);
});
test('cached import membership is recomputed after deletion without rescanning or losing ids',async()=>{
  const {service}=fixture({servers:{demo:body.entry}});
  const imported=await service.parseFile({filename:'demo.json',text:JSON.stringify({mcpServers:{copy:body.entry}})});
  const id=imported.sources[0].candidates[0].id;
  assert.equal(imported.sources[0].candidates[0].duplicate,'demo');
  await service.mutate({action:'remove',name:'demo',revision:1});
  const refreshed=await service.sources();
  assert.equal(refreshed.sources[0].candidates[0].id,id);assert.equal(refreshed.sources[0].candidates[0].duplicate,undefined);
});
test('a backup entry with omitted credentials is recognized as the same connection',async()=>{
  const existing={...body.entry,headers:{Authorization:'Bearer ${env:MCP_HUB_TEST_TOKEN}'}};
  const {service}=fixture({servers:{demo:existing}});
  const imported=await service.parseFile({filename:'backup.json',text:JSON.stringify({mcpServers:{demo:{...body.entry,headers:{}}}})});
  const candidate=imported.sources[0].candidates[0];
  assert.equal(candidate.duplicate,'demo');
  assert.equal(candidate.nameConflict,false);
  assert.equal(candidate.credentialOmitted,true);
});
test('batch import writes every new service in one revision and skips existing names',async()=>{
  const {service,form,writes}=fixture({servers:{demo:body.entry}});
  const result=await service.mutate({action:'import',revision:1,entries:[
    {name:'alpha',entry:{transport:'streamable-http',url:'https://alpha.example/mcp',headers:{},enabled:false}},
    {name:'demo',entry:body.entry},
    {name:'beta',entry:{transport:'streamable-http',url:'https://beta.example/mcp',headers:{}}},
  ]});
  assert.equal(result.ok,true);assert.equal(result.saved,true);
  assert.deepEqual(result.imported,['alpha','beta']);assert.equal(result.skipped[0].name,'demo');
  assert.equal(writes.length,1);assert.equal(writes[0].length,2);
  assert.ok(form.value.servers.alpha);assert.ok(form.value.servers.beta);assert.ok(form.value.servers.demo);
  assert.equal(form.value.servers.alpha.enabled,true);
  const listed=(await service.list()).servers.find(row=>row.name==='alpha');
  assert.equal(listed.entry.enabled,true);assert.equal(listed.editable,true);
});
test('undoing a batch removes only the entries the batch still owns',async()=>{
  const {service,form,writes}=fixture();
  const first=await service.mutate({action:'import',revision:1,entries:[
    {name:'alpha',entry:{transport:'streamable-http',url:'https://alpha.example/mcp',headers:{},enabled:false}},
    {name:'beta',entry:{transport:'streamable-http',url:'https://beta.example/mcp',headers:{}}},
  ]});
  assert.ok(first.batchId);
  form.value.servers.beta.url='https://changed.example/mcp';
  const undo=await service.mutate({action:'undo-import',revision:form.revision,batchId:first.batchId});
  assert.deepEqual(undo.removed,['alpha']);assert.equal(undo.skipped[0].name,'beta');
  assert.equal(Object.hasOwn(form.value.servers,'alpha'),false);assert.ok(form.value.servers.beta);
  assert.equal(writes.length,2);
});
test('one invalid row aborts a batch import without writing anything',async()=>{
  const {service,writes}=fixture();
  const result=await service.mutate({action:'import',revision:1,entries:[
    {name:'alpha',entry:{transport:'streamable-http',url:'https://alpha.example/mcp',headers:{},enabled:false}},
    {name:'bad name',entry:{transport:'streamable-http',url:'https://bad.example/mcp',headers:{}}},
  ]});
  assert.equal(result.ok,false);assert.equal(result.saved,false);assert.equal(result.failed.name,'bad name');assert.equal(writes.length,0);
});
test('a batch with duplicate names is refused before writing',async()=>{
  const {service,writes}=fixture();
  const entry={transport:'streamable-http',url:'https://same.example/mcp',headers:{}};
  await assert.rejects(service.mutate({action:'import',revision:1,entries:[{name:'same',entry},{name:'same',entry}]}),/重复/);
  assert.equal(writes.length,0);
});
test('only a manually imported source can be removed',async()=>{
  const {service}=fixture();
  const imported=await service.parseFile({filename:'manual.json',text:JSON.stringify({mcpServers:{copy:body.entry}})});
  const source=imported.sources[0];
  assert.equal(source.manual,true);
  const result=await service.removeSource(source.id);
  assert.deepEqual(result.sources,[]);
  service.sourceGroups.push({id:'file-auto',name:'自动扫描',manual:false,files:[],candidates:[]});
  await assert.rejects(()=>service.removeSource('file-auto'),/自动扫描/);
  assert.equal(service.sourceGroups.length,1);
});
test('explicit reveal reads exactly the selected value and subsequent edits restore the latest saved value',async()=>{
  const entry={...body.entry,headers:{Authorization:'old-token'}};
  const {service,form}=fixture({servers:{demo:entry}});
  assert.deepEqual(service.reveal({originalName:'demo',field:'headers',key:'Authorization'}),{value:'old-token'});
  assert.throws(()=>service.reveal({originalName:'demo',field:'command',key:'x'}),/不支持/);
  form.value.servers.demo.headers.Authorization='new-token';
  assert.equal(service.draft({originalName:'demo',entry:{...entry,headers:{Authorization:'••••••••'}}},form.value.servers).entry.headers.Authorization,'new-token');
});
test('inherited rows cannot be deleted',async()=>{
  const {service,writes}=fixture({servers:{demo:body.entry},base:{demo:body.entry}});
  await assert.rejects(service.mutate({action:'remove',name:'demo',revision:1}),/只能停用/);assert.equal(writes.length,0);
});
test('list does not leak secret headers, args, env or diagnostic values',async()=>{
  const entry={...body.entry,env:{KEY:'thisisasecret'},args:['--key=argsecret'],headers:{Authorization:'headsecret'}};
  const {service}=fixture({servers:{demo:entry},status:{state:'failed',lastError:'thisisasecret headsecret --key=argsecret'}});
  const result=JSON.stringify(await service.list());for(const value of ['thisisasecret','headsecret','argsecret'])assert.ok(!result.includes(value));
});
test('export omits credentials by default and includes them only on request',async()=>{
  const entry={...body.entry,headers:{Authorization:'Bearer real-token'},env:{API_KEY:'secret'}};
  const {service}=fixture({servers:{demo:entry}});
  const safe=await service.exportBackup({});
  assert.equal(safe.includeSecrets,false);
  assert.equal(safe.backup.demo.headers.Authorization,undefined);
  assert.equal(safe.backup.demo.env.API_KEY,undefined);
  assert.ok(safe.omitted.length>0);
  const full=await service.exportBackup({includeSecrets:true});
  assert.equal(full.includeSecrets,true);
  assert.equal(full.backup.demo.headers.Authorization,'Bearer real-token');
  assert.equal(full.backup.demo.env.API_KEY,'secret');
  assert.deepEqual(full.omitted,[]);
});
test('API uses official owner-only Fetch routes for browser and desktop',()=>{
  const routes=[];
  apply({inject:()=>{},effect:fn=>fn(),connection:{fetch:{register:route=>{routes.push(route);return ()=>{};}}}});
  assert.equal(routes.length,16);assert.ok(routes.every(route=>route.path.startsWith('/api/dsh-mcp-hub/')));
  assert.deepEqual(routes.find(route=>route.path.endsWith('/mutate')).methods,['POST']);
  assert.deepEqual(routes.find(route=>route.path.endsWith('/servers')).methods,['GET']);
  assert.deepEqual(routes.find(route=>route.path.endsWith('/wait')).methods,['POST']);
  assert.deepEqual(routes.find(route=>route.path.endsWith('/tools')).methods,['POST']);
});
test('source removal route awaits the service result',async()=>{
  const req=new Request('http://localhost/api/dsh-mcp-hub/source-remove',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:'file-1'})});
  const response=await createHandler(()=>({removeSource:async()=>{await new Promise(resolve=>setTimeout(resolve,1));return {sources:[]};}}),'source-remove')(req);
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{sources:[]});
});
test('catalog routes pass the query and request signal to the registry client',async()=>{
  const calls=[];
  const service={maxConfigBytes:1024,
    catalogSearch:async(body,signal)=>{calls.push(['search',body,signal]);return {items:[],query:body.query};},
    catalogDetail:async(body,signal)=>{calls.push(['detail',body,signal]);return {item:{name:body.name}};}};
  const searchRequest=new Request('http://localhost/api/dsh-mcp-hub/catalog-search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'filesystem',limit:5})});
  const search=await createHandler(()=>service,'catalog-search')(searchRequest);
  assert.equal(search.status,200);assert.equal((await search.json()).query,'filesystem');
  const detailRequest=new Request('http://localhost/api/dsh-mcp-hub/catalog-detail',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'io.github.acme/fs'})});
  const detail=await createHandler(()=>service,'catalog-detail')(detailRequest);
  assert.equal(detail.status,200);assert.deepEqual(await detail.json(),{item:{name:'io.github.acme/fs'}});
  assert.equal(calls[0][1].limit,5);assert.ok(calls[0][2] instanceof AbortSignal);assert.equal(calls[1][1].name,'io.github.acme/fs');
});
test('API refuses unavailable services and masks foreign parse exceptions',async()=>{
  const req=new Request('http://localhost/api/dsh-mcp-hub/scan',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  assert.equal((await createHandler(()=>null,'scan')(req)).status,503);
  const response=await createHandler(()=>({scan:()=>{throw new Error('secret foreign message')}}),'scan')(req);
  assert.equal(response.status,500);assert.ok(!JSON.stringify(await response.json()).includes('secret'));
});
test('known failures keep their code and status while unknown ones are logged away',async()=>{
  const req=new Request('http://localhost/api/dsh-mcp-hub/mutate',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  const conflict=await createHandler(()=>({mutate:()=>{throw new HubError('REVISION_CONFLICT','配置已变化');}}),'mutate')(req);
  assert.equal(conflict.status,409);assert.equal((await conflict.json()).code,'REVISION_CONFLICT');
  const logged=[];
  const broken=await createHandler(()=>({mutate:()=>{throw new TypeError('boom');}}),'mutate',{error:error=>logged.push(error)})(req);
  assert.equal(broken.status,500);assert.equal((await broken.json()).code,'INTERNAL');assert.equal(logged.length,1);
});
test('a disabled save still rejects entries that violate hard constraints',async()=>{
  const {service,writes}=fixture();
  const invalidName=await service.mutate({...body,name:'bad name',mode:'draft'});
  assert.equal(invalidName.saved,false);assert.equal(invalidName.ok,false);
  const invalidTransport=await service.mutate({...body,entry:{...body.entry,transport:'sse'},mode:'draft'});
  assert.equal(invalidTransport.saved,false);assert.equal(writes.length,0);
});
test('failures carry structured codes for the client',async()=>{
  const {service}=fixture({servers:{demo:body.entry},base:{demo:body.entry}});
  await assert.rejects(service.mutate({...body,revision:9}),error=>error.code==='REVISION_CONFLICT');
  await assert.rejects(service.mutate(body),error=>error.code==='NAME_TAKEN');
  await assert.rejects(service.mutate({action:'remove',name:'demo',revision:1}),error=>error.code==='INHERITED_ROW');
});
test('saved entries keep references as credential templates',async()=>{
  const {service,form}=fixture();
  const result=await service.mutate({...body,entry:{...body.entry,headers:{Authorization:'Bearer ${env:MCP_HUB_TEST_TOKEN}'}}});
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(form.value.servers.demo.headers.Authorization,'Bearer ${credential:MCP_HUB_TEST_TOKEN}');
});
test('renaming writes the new and old key in one revision',async()=>{
  const {service,form,writes}=fixture({servers:{demo:{...body.entry,enabled:true}},status:{state:'connected',toolCount:1,connectedAt:5}});
  const result=await service.mutate({...body,originalName:'demo',name:'renamed'});
  assert.equal(result.ok,true);assert.equal(result.renamed,true);assert.equal(writes.length,1);
  assert.deepEqual(writes[0].map(op=>op.op),['set','unset']);
  assert.equal(Object.hasOwn(form.value.servers,'demo'),false);
  assert.equal(form.value.servers.renamed.enabled,true);
  service.cancelVerification('renamed');
});
test('renaming is refused for inherited entries and for taken names',async()=>{
  const inherited=fixture({servers:{demo:body.entry},base:{demo:body.entry}});
  await assert.rejects(inherited.service.mutate({...body,originalName:'demo',name:'renamed'}),error=>error.code==='INHERITED_ROW');
  const taken=fixture({servers:{demo:body.entry,other:{...body.entry,url:'https://other.example/mcp'}}});
  await assert.rejects(taken.service.mutate({...body,originalName:'demo',name:'other'}),error=>error.code==='NAME_TAKEN');
});
test('bulk enable and disable commit once and skip unchanged rows',async()=>{
  const {service,form,writes}=fixture({servers:{a:{...body.entry,enabled:true},b:{...body.entry,url:'https://b.example/mcp',enabled:false}}});
  const off=await service.mutate({action:'bulk',operation:'disable',names:['a','b'],revision:1});
  assert.equal(off.affected,1);assert.equal(form.value.servers.a.enabled,false);
  const on=await service.mutate({action:'bulk',operation:'enable',names:['a','b'],revision:form.revision});
  assert.equal(on.affected,2);assert.equal(writes.length,2);
});
test('bulk restart tolerates individual failures',async()=>{
  const {service}=fixture({servers:{a:body.entry,b:{...body.entry,url:'https://b.example/mcp'}}});
  service.ctx.mcpManager.restart=async()=>{throw new Error('blocked');};
  const result=await service.mutate({action:'bulk',operation:'restart',names:['a','b'],revision:1});
  assert.equal(result.ok,true);assert.equal(result.affected,0);
});

test('save reports the redacted entry that was written',async()=>{
  const {service}=fixture();
  const result=await service.mutate({...body,entry:{...body.entry,headers:{Authorization:'Bearer ${env:MCP_HUB_TEST_TOKEN}'}}});
  assert.equal(result.entry.headers.Authorization,'Bearer ${credential:MCP_HUB_TEST_TOKEN}');
  service.cancelVerification('demo');
});

test('a failing status read ends verification instead of escaping the timer', async () => {
  const {service}=fixture({servers:{demo:body.entry},status:{state:'connecting'}});
  service.startVerification('demo',{transport:'streamable-http',url:'https://example.com/mcp',enabled:true},undefined);
  service.ctx.mcpManager.list=()=>{throw new Error('manager gone');};
  assert.doesNotThrow(()=>service.checkVerification(service.verifications.get('demo')));
  assert.equal(service.verifications.get('demo').state,'failed');
  assert.match(service.verifications.get('demo').detail,/读取连接状态失败/);
});

test('one unreadable stored entry becomes a broken row instead of a failed page', async () => {
  const {service}=fixture({servers:{demo:body.entry,badtx:{command:'node'},badargs:{transport:'stdio',command:'node',args:'--bad'}}});
  const rows=(await service.list()).servers;
  assert.equal(rows.find(row=>row.name==='demo').managed,'config');
  const broken=rows.find(row=>row.name==='badtx');
  assert.equal(broken.managed,'broken');assert.equal(broken.editable,false);assert.equal(broken.removable,false);
  assert.match(broken.status.lastError,/无法读取/);
  // The import list must survive both shapes: preflight throws for the bad args.
  const sources=await service.sources();
  assert.ok(Array.isArray(sources.sources));
  // The pushed status view must agree with the list, or it would overwrite the broken row.
  const pushed=service.status().servers.find(row=>row.name==='badtx');
  assert.equal(pushed.state,'failed');assert.equal(pushed.editable,false);
});

test('the pushed view never marks an unreadable entry as editable', async () => {
  const {service}=fixture({servers:{legacy:{command:'node'}}});
  const pushed=service.status().servers[0];
  assert.equal(pushed.state,'failed');assert.equal(pushed.editable,false);
  assert.match(pushed.lastError,/无法读取/);
});

test('a cancelled wait releases its slot and returns the current view', async () => {
  const {service}=fixture({servers:{demo:body.entry}});
  const controller=new AbortController();
  const pending=service.wait({version:service.version,revision:1,timeoutMs:5000},controller.signal);
  setTimeout(()=>controller.abort(),10);
  const snapshot=await pending;
  assert.equal(snapshot.revision,1);
  assert.equal(service.waiters.size,0);
});

test('the configuration view is cached between reads but never across a write', async () => {
  const {service}=fixture();
  let calls=0;const describe=service.ctx.settings.describe;
  service.ctx.settings.describe=()=>{calls+=1;return describe();};
  service.descriptor();service.descriptor();service.status();service.list();
  assert.equal(calls,1);
  await service.mutate(body);
  // The write path (and the verification that follows it) never reuse the cached view.
  assert.ok(calls>1);
});

test('the last verification is persisted for the next Host run', async () => {
  const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
  const home=await mkdtemp(join(tmpdir(),'mcp-hub-meta-'));
  try {
    const metaPath=join(home,'.dsh','mcp-hub','test','sources.json');
    const first=fixture({status:{state:'failed',reason:'auth',lastError:'denied'},metaPath});
    await first.service.mutate(body);
    await settle(120);
    const second=fixture({servers:{demo:body.entry},metaPath});
    const restored=await new HubService(second.service.ctx,{metaPath,waitMs:8,intervalMs:1,env:{}}).init();
    const row=(await restored.list()).servers.find(entry=>entry.name==='demo');
    assert.equal(row.verification?.state,'failed');
    assert.match(row.verification.detail,/denied/);
  } finally { await rm(home,{recursive:true,force:true}); }
});

test('manual imported sources survive a Host restart', async () => {
  const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
  const home=await mkdtemp(join(tmpdir(),'mcp-hub-sources-'));
  try {
    const metaPath=join(home,'.dsh','mcp-hub','test','sources.json');
    const first=fixture({metaPath});
    const imported=await first.service.parseFile({filename:'manual.json',text:JSON.stringify({mcpServers:{copy:body.entry}})});
    const id=imported.sources[0].id;
    assert.equal(imported.sources[0].manual,true);
    const second=new HubService(first.service.ctx,{metaPath,waitMs:8,intervalMs:1,env:{}});
    await second.init();
    const restored=await second.sources();
    assert.equal(restored.sources.length,1);assert.equal(restored.sources[0].id,id);
    assert.equal(restored.sources[0].candidates[0].name,'copy');
    await second.removeSource(id);
    const third=new HubService(first.service.ctx,{metaPath,waitMs:8,intervalMs:1,env:{}});
    await third.init();
    assert.deepEqual((await third.sources()).sources,[]);
  } finally { await rm(home,{recursive:true,force:true}); }
});
test('a manager cleanup failure is explained in Chinese, not as a raw enum', async () => {
  const {service}=fixture({extraRows:[{name:'gone',configured:false,status:{state:'failed',reason:'cleanup',result:{closeConfirmed:false,cleanupError:'busy'}}}]});
  const row=(await service.list()).servers.find(entry=>entry.name==='gone');
  assert.match(row.status.lastError,/清理未完成/);
});

test('the push channel answers as soon as a status changes', async () => {
  const {service}=fixture({servers:{demo:body.entry}});
  const started=Date.now();
  const pending=service.wait({version:service.version,revision:1,timeoutMs:5000});
  setTimeout(()=>service.notify(),10);
  const snapshot=await pending;
  assert.ok(Date.now()-started<1000);
  assert.equal(snapshot.revision,1);
  assert.equal(snapshot.servers[0].name,'demo');
});

test('the lightweight status view omits entries and tool details', async () => {
  const {service}=fixture({servers:{demo:body.entry}});
  const view=service.status();
  assert.equal(view.version,service.version);
  assert.equal(view.servers[0].entry,undefined);
  assert.equal(view.servers[0].tools,undefined);
  assert.equal(view.servers[0].name,'demo');
});

test('the list carries tool summaries while full schemas load on demand', async () => {
  const {service}=fixture({servers:{demo:body.entry}});
  const row=(await service.list()).servers[0];
  assert.equal(row.tools[0].name,'read');
  assert.equal(row.tools[0].schema,undefined);
  assert.equal(row.toolCount,1);
  const full=service.toolsFor('demo');
  assert.deepEqual(full.tools[0].schema,{type:'object'});
});

test('an existing entry can be re-probed without touching the live instance', async () => {
  const {service}=fixture({servers:{demo:body.entry}});
  service.ctx.mcpManager.probe=async()=>({ok:true,toolNames:['read'],truncated:false,durationMs:12,closeConfirmed:true,serverInfo:{name:'demo',version:'1'}});
  const result=await service.probeExisting({name:'demo'});
  assert.equal(result.ok,true);
  assert.match(result.checks[0].detail,/12 ms/);
  assert.equal((await service.list()).servers[0].verification.state,'ok');
  service.ctx.mcpManager.probe=async()=>{throw new Error('cleanup for "demo" is incomplete')};
  const failed=await service.probeExisting({name:'demo'});
  assert.equal(failed.ok,false);
  assert.match(failed.checks[0].detail,/incomplete/);
});
