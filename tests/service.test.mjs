import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HubService } from '../src/host/service.js';
import { createHandler, apply } from '../src/host/index.js';
import { HubError } from '../src/shared/errors.js';
function fixture({ status = {state:'connected',toolCount:1}, schemas = [{name:'mcp__demo__read',parameters:{type:'object'}}], servers = {}, base = {}, waitMs = 8, env = { MCP_HUB_TEST_TOKEN: 'test-value' }, extraRows = [], metaPath = null, credentials = null } = {}) {
  const form={ns:'mcp-manager',revision:1,value:{servers},base:{servers:base}};
  const writes=[];
  // Credential service stand-in: the Host resolves `${credential:…}` through it,
  // so the fixture must provide the same seam the real plugin gets.
  const store = new Map();
  const credentialsService = credentials ?? {
    describe: ref => ({ configured: store.has(ref), writable: true, source: store.has(ref) ? 'file' : undefined }),
    resolve: ref => (store.has(ref) ? { value: store.get(ref), source: 'file' } : undefined),
    set: async (ref, value) => { if (!value) throw new Error('empty credential'); store.set(ref, value); },
    unset: async ref => { store.delete(ref); },
  };
  const ctx={settings:{describe:()=>[structuredClone(form)],mutate:async(ns,ops,revision)=>{
    assert.equal(ns,form.ns);assert.equal(revision,form.revision);writes.push(ops);
    for(const op of ops){const name=op.path[1];if(op.op==='unset')delete form.value.servers[name];else if(op.path.length===2)form.value.servers[name]=op.value;else form.value.servers[name][op.path[2]]=op.value;}
    form.revision++;
  }},mcpManager:{list:()=>[...Object.keys(form.value.servers).map(name=>({name,status,configured:true})),...extraRows],restart:async()=>{}},tools:{schemas:()=>schemas},credentials:credentialsService};
  return {service:new HubService(ctx,{metaPath,waitMs,intervalMs:1,env}),form,writes,store,credentials:credentialsService};
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
test('the first connection gets a longer budget because it may download dependencies',async()=>{
  const {service}=fixture({waitMs:1000,status:{state:'connecting'}});
  await service.mutate(body);
  const first=service.verifications.get('demo');
  assert.equal(first.state,'verifying');
  assert.ok(first.deadline-first.startedAt>=2000,'首次连接应给两倍预算，实际 '+(first.deadline-first.startedAt)+' ms');
  const {service:second}=fixture({waitMs:1000,status:{state:'connecting'},servers:{demo:{...body.entry,enabled:true}}});
  second.lastVerifications.demo={state:'ok',finishedAt:Date.now()};
  await second.mutate({...body,originalName:'demo'});
  const again=second.verifications.get('demo');
  assert.ok(again.deadline-again.startedAt<2000,'已成功验证过的条目不应再翻倍预算，实际 '+(again.deadline-again.startedAt)+' ms');
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
test('an auth failure is reported as needing authentication instead of a timeout',async()=>{
  // 客户端没有 needs-auth 状态：401 只在 lastError 里，实例会一直重连到验证预算耗尽。
  const {service}=fixture({status:{state:'reconnecting',attempt:1,maxAttempts:10,nextRetryAtMs:Date.now()+1000,lastError:'Error POSTing to endpoint (HTTP 401): {"error":"invalid token"}'}});
  const result=await service.mutate(body);assert.equal(result.verifying,true);
  await settle();
  const record=service.verifications.get('demo');
  assert.equal(record.state,'failed');
  assert.match(record.detail,/^需要认证/);
  assert.match(record.detail,/401/);
});
test('an OAuth row that loses its grant stays enabled and asks for authorization again',async()=>{
  // 401 对 OAuth 行是令牌过期，不是坏配置：自动停用会让重新授权后没有可用实例。
  const status={state:'reconnecting',attempt:1,maxAttempts:10,nextRetryAtMs:Date.now()+1000,lastError:'Error POSTing to endpoint (HTTP 401): {"error":"invalid token"}'};
  const {service,form}=fixture({servers:{demo:{...body.entry,enabled:true}},status});
  service.oauth.demo={ref:'MCPHUB_DEMO_ACCESS_TOKEN',key:'dsh-mcp-hub/oauth-demo',state:'authorized'};
  const record={name:'demo',state:'verifying',startedAt:Date.now()-10,deadline:Date.now()+5000,expected:form.value.servers.demo};
  service.statusWatchers.add(record);
  service.evaluateVerification(record,{runtime:[{name:'demo',configured:true,status}],schemas:[]});
  assert.equal(record.state,'failed');assert.match(record.detail,/^需要认证/);
  assert.equal(service.oauth.demo.state,'needs-auth');
  assert.equal(form.value.servers.demo.enabled,true,'OAuth 认证失败不该自动停用');
  await settle();
  const [row]=(await service.list()).servers;
  assert.equal(row.oauth.state,'needs-auth');
});
test('a 401 seen after a restart marks an OAuth row for authorization again',async()=>{
  const {service}=fixture({servers:{demo:{...body.entry,enabled:true}},status:{state:'failed',reason:'auth',lastError:'Error POSTing to endpoint (HTTP 401): invalid token'}});
  service.oauth.demo={ref:'MCPHUB_DEMO_ACCESS_TOKEN',key:'dsh-mcp-hub/oauth-demo',state:'authorized'};
  const [row]=(await service.list()).servers;
  assert.equal(row.oauth.state,'needs-auth');
  assert.match(row.oauth.error,/401/);
});
test('an unreachable endpoint is settled instead of retrying until the budget runs out',async()=>{
  // 禁用端口/不存在的域名会被客户端当成可重试错误，重连到预算耗尽；应立刻给出结论。
  const {service}=fixture({waitMs:1000,status:{state:'reconnecting',attempt:1,maxAttempts:10,nextRetryAtMs:Date.now()+1000,lastError:'TypeError: fetch failed, cause: bad port'}});
  const result=await service.mutate(body);assert.equal(result.verifying,true);
  const record=service.verifications.get('demo');
  assert.equal(record.state,'failed');
  assert.match(record.detail,/连接地址不可用/);
  assert.match(record.detail,/bad port/);
  const dead=fixture({waitMs:1000,status:{state:'reconnecting',attempt:1,maxAttempts:10,lastError:'getaddrinfo ENOTFOUND missing.invalid'}});
  await dead.service.mutate(body);
  assert.equal(dead.service.verifications.get('demo').state,'failed');
  assert.match(dead.service.verifications.get('demo').detail,/ENOTFOUND/);
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
test('manually enabling a service starts a fresh verification',async()=>{
  // 启停只写 enabled；如果不起新验证，诊断页会一直显示停用前的旧结论。
  const {service}=fixture({servers:{demo:{...body.entry,enabled:false}},status:{state:'connected',toolCount:1}});
  const result=await service.mutate({action:'toggle',name:'demo',enabled:true,revision:1});
  assert.equal(result.verifying,true);
  assert.equal(service.verifications.get('demo').state,'ok');
  assert.equal((await service.list()).servers[0].verification.state,'ok');
});
test('enabling after a failed verdict replaces the stale conclusion',async()=>{
  const {service,form}=fixture({servers:{demo:{...body.entry,enabled:false}},status:{state:'connected',toolCount:1}});
  service.lastVerifications.demo={state:'failed',detail:'上次连接被拒绝',startedAt:1,finishedAt:2};
  await service.mutate({action:'toggle',name:'demo',enabled:true,revision:1});
  const row=(await service.list()).servers[0];
  assert.equal(row.verification.state,'ok');
  assert.match(row.verification.detail,/已注册 1 个工具/);
  assert.equal(form.value.servers.demo.enabled,true);
});
test('disabling a service ends the verification that was still running',async()=>{
  const {service}=fixture({servers:{demo:{...body.entry,enabled:true}},status:{state:'connecting'}});
  service.startVerification('demo',{...body.entry,enabled:true});
  assert.equal(service.verifications.get('demo').state,'verifying');
  await service.mutate({action:'toggle',name:'demo',enabled:false,revision:1});
  assert.equal(service.verifications.get('demo').state,'cancelled');
});
test('a long first connect is explained instead of looking stuck',async()=>{
  const {service}=fixture({waitMs:2000,status:{state:'connecting'}});
  await service.mutate(body);
  const record=service.verifications.get('demo');
  assert.equal(record.detail,'正在连接…');
  // 把开始时间推回 16 秒前：首次跑 npx 可能要下载依赖，这时要给解释而不是让用户以为卡死。
  record.startedAt=Date.now()-16000;
  await settle(60);
  const current=service.verifications.get('demo');
  assert.equal(current.state,'verifying');
  assert.match(current.detail,/首次运行可能需要下载依赖/);
  service.cancelVerification('demo');
});
test('a transient disabled status does not cancel an enable verification',async()=>{
  // 写回 enabled=true 之后、官方实例真正启动之前，状态可能还停在 disabled。
  const {service}=fixture({servers:{demo:{...body.entry,enabled:false}},status:{state:'disabled'},waitMs:600});
  const result=await service.mutate({action:'toggle',name:'demo',enabled:true,revision:1});
  assert.equal(result.verifying,true);
  await settle(30);
  const record=service.verifications.get('demo');
  assert.equal(record.state,'verifying');
  assert.match(record.detail,/等待服务启动/);
});
test('bulk enable verifies the rows it turns back on',async()=>{
  const {service}=fixture({servers:{demo:{...body.entry,enabled:false}},status:{state:'connected',toolCount:1}});
  const result=await service.mutate({action:'bulk',operation:'enable',names:['demo'],revision:1});
  assert.equal(result.verifying,true);
  assert.equal(service.verifications.get('demo').state,'ok');
});
test('a candidate whose token is already stored is recognized as the same connection',async()=>{
  // 同一个服务在各应用里写法不同：一边是 `${env:DOCS_TOKEN}`，另一边已经存成
  // `${credential:MCPHUB_DOCS_TOKEN}`。只看模板文本会判成两个服务。
  const {service,store}=fixture({
    env:{ DOCS_TOKEN:'docs-token-value' },
    servers:{ mine:{ transport:'streamable-http', url:'https://x.example/mcp', headers:{ Authorization:'Bearer ${credential:MCPHUB_DOCS_TOKEN}' } } },
  });
  store.set('DOCS_TOKEN','docs-token-value');
  store.set('MCPHUB_DOCS_TOKEN','docs-token-value');
  const candidateEntry={ transport:'streamable-http', url:'https://x.example/mcp', headers:{ Authorization:'Bearer ${env:DOCS_TOKEN}' } };
  const present=async entry=>(await service.presentSources([{ id:'sim', name:'模拟', files:[], candidates:[{ id:'c1', name:'other', entry, issues:[] }] }])).sources[0].candidates[0];
  assert.equal((await present(candidateEntry)).duplicate,'mine','同一个 token 应该认成同一个连接');
  // 明文写法同样要能认出来。
  assert.equal((await present({ ...candidateEntry, headers:{ Authorization:'Bearer docs-token-value' } })).duplicate,'mine');
  // 换成别的 token 就不是同一个连接了。
  store.set('MCPHUB_DOCS_TOKEN','rotated-value');
  assert.equal((await present(candidateEntry)).duplicate,undefined,'不同 token 不该被合并');
});
test('retained cleanup rows are reported as cleanup rather than plugin servers',async()=>{
  const {service}=fixture({extraRows:[{name:'gone',configured:false,status:{state:'failed',reason:'cleanup',result:{closeConfirmed:false,cleanupError:'busy'}}}]});
  const [row]=(await service.list()).servers;
  assert.equal(row.managed,'cleanup');assert.equal(row.removable,false);assert.equal(row.editable,false);
  assert.equal(row.status.closeConfirmed,false);assert.equal(row.status.cleanupError,'busy');
  assert.equal(row.source.app,'已删除，清理中');
});
test('re-adding a name whose old instance is still cleaning up reports cleaning, not duplication',async()=>{
  // 删除后官方会保留一行 configured=false 的实例：名字已从配置空出，但进程还没退出。
  const extraRows=[{name:'demo',configured:false,status:{state:'connecting',reason:'cleanup',result:{closeConfirmed:false,cleanupError:'tool cleanup timed out'}}}];
  const {service,form}=fixture({extraRows});
  await assert.rejects(service.mutate(body),error=>{
    assert.equal(error.code,'NAME_CLEANING');
    assert.match(error.message,/清理中/);
    assert.match(error.message,/tool cleanup timed out/);
    return true;
  });
  assert.equal(Object.hasOwn(form.value.servers,'demo'),false,'清理期间不该写入同名配置');
  extraRows.length=0;
  const saved=await service.mutate(body);
  assert.equal(saved.saved,true,'清理行消失后同一个名字应能添加');
  service.cancelVerification('demo');
});
test('a live row from another plugin still counts as a taken name',async()=>{
  const {service}=fixture({extraRows:[{name:'demo',configured:true,status:{state:'connected'}}]});
  await assert.rejects(service.mutate(body),error=>error.code==='NAME_TAKEN');
});
test('batch import reports a cleaning name instead of silently skipping it',async()=>{
  const {service,form}=fixture({extraRows:[{name:'demo',configured:false,status:{state:'connecting',reason:'cleanup'}}]});
  await assert.rejects(service.mutate({action:'import',revision:1,entries:[{name:'demo',entry:body.entry},{name:'other',entry:body.entry}]}),error=>error.code==='NAME_CLEANING');
  assert.deepEqual(Object.keys(form.value.servers),[],'整批都不该写入');
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
test('a batch import gives each service its own copy of a shared environment variable',async()=>{
  const {service,store}=fixture({env:{SHARED_TOKEN:'shared-value'}});
  const entry=name=>({transport:'streamable-http',url:'https://'+name+'.example/mcp',headers:{Authorization:'Bearer ${env:SHARED_TOKEN}'}});
  const result=await service.mutate({action:'import',revision:1,entries:[
    {name:'alpha',entry:entry('alpha')},
    {name:'beta',entry:entry('beta')},
  ]});
  assert.equal(result.ok,true);
  assert.deepEqual(result.credentials.stored.map(item=>item.name).sort(),['MCPHUB_SHARED_TOKEN','MCPHUB_SHARED_TOKEN_2']);
  assert.equal(store.get('MCPHUB_SHARED_TOKEN'),'shared-value');
  assert.equal(store.get('MCPHUB_SHARED_TOKEN_2'),'shared-value');
  const listed=(await service.list()).servers;
  assert.equal(listed.find(row=>row.name==='alpha').entry.headers.Authorization,'Bearer ${credential:MCPHUB_SHARED_TOKEN}');
  assert.equal(listed.find(row=>row.name==='beta').entry.headers.Authorization,'Bearer ${credential:MCPHUB_SHARED_TOKEN_2}');
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
  assert.deepEqual(await service.reveal({originalName:'demo',field:'headers',key:'Authorization'}),{value:'old-token'});
  await assert.rejects(()=>service.reveal({originalName:'demo',field:'command',key:'x'}),/不支持/);
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
  assert.equal(routes.length,19);assert.ok(routes.every(route=>route.path.startsWith('/api/dsh-mcp-hub/')));
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
test('saved references are moved into the credential store and rewritten',async()=>{
  const {service,form,store}=fixture();
  const result=await service.mutate({...body,entry:{...body.entry,headers:{Authorization:'Bearer ${env:MCP_HUB_TEST_TOKEN}'}}});
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(form.value.servers.demo.headers.Authorization,'Bearer ${credential:MCPHUB_MCP_HUB_TEST_TOKEN}');
  assert.equal(store.get('MCPHUB_MCP_HUB_TEST_TOKEN'),'test-value');
  assert.deepEqual(result.credentials.stored.map(item=>({name:item.name,mode:item.mode})),[{name:'MCPHUB_MCP_HUB_TEST_TOKEN',mode:'create'}]);
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
test('single restart is idempotent and needs no matching revision',async()=>{
  const {service}=fixture({servers:{demo:{...body.entry,enabled:true}}});
  const restarted=[];
  service.ctx.mcpManager.restart=async name=>{restarted.push(name);};
  // 重启不写配置：并发下旧的 revision 不应把一次重启判成保存冲突。
  assert.deepEqual(await service.mutate({action:'restart',name:'demo',revision:999}),{ok:true});
  assert.deepEqual(restarted,['demo']);
  await assert.rejects(()=>service.mutate({action:'restart',name:'ghost',revision:1}),/其他插件管理/);
});

test('save reports the redacted entry that was written',async()=>{
  const {service}=fixture();
  const result=await service.mutate({...body,entry:{...body.entry,headers:{Authorization:'Bearer ${env:MCP_HUB_TEST_TOKEN}'}}});
  assert.equal(result.entry.headers.Authorization,'Bearer ${credential:MCPHUB_MCP_HUB_TEST_TOKEN}');
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

test('a verification interrupted by a Host shutdown is settled instead of staying verifying', async () => {
  const {mkdtemp,rm,mkdir,writeFile,readFile}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join,dirname}=await import('node:path');
  const home=await mkdtemp(join(tmpdir(),'mcp-hub-interrupted-'));
  try {
    const metaPath=join(home,'.dsh','mcp-hub','test','sources.json');
    await mkdir(dirname(metaPath),{recursive:true});
    await writeFile(metaPath,JSON.stringify({version:1,origins:{},verifications:{demo:{state:'verifying',startedAt:1}},sources:[]}));
    const {service}=fixture({metaPath,servers:{demo:{...body.entry,enabled:true}}});
    const restored=await service.init();
    const row=(await restored.list()).servers.find(entry=>entry.name==='demo');
    assert.equal(row.verification?.state,'failed');
    assert.match(row.verification.detail,/中断/);
    assert.equal(JSON.parse(await readFile(metaPath,'utf8')).verifications.demo.state,'failed');
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

// ---- credential vault integration -----------------------------------------

const TOKEN='sk-live-1234567890abcdef';
const bearer = token => 'Bearer ' + token;

test('a plaintext secret is moved into the credential store',async()=>{
  const {service,form,store}=fixture();
  const result=await service.mutate({...body,entry:{...body.entry,headers:{Authorization:bearer(TOKEN)},env:{API_KEY:'abcdefghijklmnopqrstuvwxyz1234'}}});
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(form.value.servers.demo.headers.Authorization,'Bearer ${credential:MCPHUB_DEMO_TOKEN}');
  assert.equal(form.value.servers.demo.env.API_KEY,'${credential:MCPHUB_DEMO_API_KEY}');
  assert.equal(store.get('MCPHUB_DEMO_TOKEN'),TOKEN);
  assert.equal(store.get('MCPHUB_DEMO_API_KEY'),'abcdefghijklmnopqrstuvwxyz1234');
});

test('a server-named environment variable does not repeat the server prefix',async()=>{
  const {service,form,store}=fixture();
  const entry={...body.entry,env:{AMAP_MAPS_API_KEY:'sk-live-0123456789abcdef'}};
  const result=await service.mutate({...body,name:'amap-maps',entry});
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(form.value.servers['amap-maps'].env.AMAP_MAPS_API_KEY,'${credential:MCPHUB_AMAP_MAPS_API_KEY}');
  assert.equal(store.get('MCPHUB_AMAP_MAPS_API_KEY'),'sk-live-0123456789abcdef');
});

test('a name owned by another server gets a suffix instead of being overwritten',async()=>{
  const {service,form,store}=fixture({servers:{other:{...body.entry,headers:{Authorization:'Bearer ${credential:MCPHUB_DEMO_TOKEN}'}}}});
  store.set('MCPHUB_DEMO_TOKEN','theirs');
  const result=await service.mutate({...body,entry:{...body.entry,headers:{Authorization:bearer(TOKEN)}}});
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(form.value.servers.demo.headers.Authorization,'Bearer ${credential:MCPHUB_DEMO_TOKEN_2}');
  assert.equal(store.get('MCPHUB_DEMO_TOKEN'),'theirs');
  assert.equal(store.get('MCPHUB_DEMO_TOKEN_2'),TOKEN);
});

test('a name used only by this server is rotated in place',async()=>{
  const entry={...body.entry,headers:{Authorization:'Bearer ${credential:MCPHUB_DEMO_TOKEN}'}};
  const {service,form,store}=fixture({servers:{demo:entry}});
  store.set('MCPHUB_DEMO_TOKEN','old-value');
  const result=await service.mutate({...body,originalName:'demo',entry:{...body.entry,headers:{Authorization:'Bearer '+TOKEN}}});
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(form.value.servers.demo.headers.Authorization,'Bearer ${credential:MCPHUB_DEMO_TOKEN}');
  assert.equal(store.get('MCPHUB_DEMO_TOKEN'),TOKEN);
});

test('a name shared by several servers is never overwritten',async()=>{
  const shared={...body.entry,headers:{Authorization:'Bearer ${credential:MCPHUB_DEMO_TOKEN}'}};
  const {service,form,store}=fixture({servers:{one:shared,two:{...shared,url:'https://two.example/mcp'}}});
  store.set('MCPHUB_DEMO_TOKEN','shared-value');
  const result=await service.mutate({...body,entry:{...body.entry,headers:{Authorization:'Bearer '+TOKEN}}});
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(form.value.servers.demo.headers.Authorization,'Bearer ${credential:MCPHUB_DEMO_TOKEN_2}');
  assert.equal(store.get('MCPHUB_DEMO_TOKEN'),'shared-value');
});

test('an existing credential reference is kept untouched',async()=>{
  const entry={...body.entry,headers:{Authorization:'Bearer ${credential:USER_CHOSEN_NAME}'}};
  const {service,form,store}=fixture();
  store.set('USER_CHOSEN_NAME','picked');
  const result=await service.mutate({...body,entry});
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(form.value.servers.demo.headers.Authorization,'Bearer ${credential:USER_CHOSEN_NAME}');
  assert.equal(result.credentials,undefined);
});

test('reveal resolves a credential reference without touching the configuration',async()=>{
  const entry={...body.entry,headers:{Authorization:'Bearer ${credential:MCPHUB_DEMO_TOKEN}'}};
  const {service,store}=fixture({servers:{demo:entry}});
  store.set('MCPHUB_DEMO_TOKEN',TOKEN);
  const revealed=await service.reveal({originalName:'demo',field:'headers',key:'Authorization'});
  assert.equal(revealed.value,'Bearer '+TOKEN);
  assert.deepEqual(revealed.names,['MCPHUB_DEMO_TOKEN']);
  store.delete('MCPHUB_DEMO_TOKEN');
  await assert.rejects(()=>service.reveal({originalName:'demo',field:'headers',key:'Authorization'}),/凭证未配置/);
});

test('export inlines credentials only when secrets are requested',async()=>{
  const entry={...body.entry,headers:{Authorization:'Bearer ${credential:MCPHUB_DEMO_TOKEN}'}};
  const {service,store}=fixture({servers:{demo:entry}});
  store.set('MCPHUB_DEMO_TOKEN',TOKEN);
  const safe=await service.exportBackup({});
  // A reference-only export keeps the template (and is unusable elsewhere until resolved).
  assert.equal(safe.backup.demo.headers.Authorization,'Bearer ${credential:MCPHUB_DEMO_TOKEN}');
  const full=await service.exportBackup({includeSecrets:true});
  assert.equal(full.backup.demo.headers.Authorization,'Bearer '+TOKEN);
  assert.deepEqual(full.credentialsMissing,[]);
});

test('a draft save with a missing variable keeps the reference and reports it',async()=>{
  const {service,form}=fixture();
  const result=await service.mutate({...body,mode:'draft',entry:{...body.entry,headers:{Authorization:'Bearer ${env:MCP_HUB_MISSING_TEST}'}}});
  assert.equal(result.saved,true);
  assert.equal(result.draft,true);
  assert.deepEqual(result.credentials.missing,['MCP_HUB_MISSING_TEST']);
  assert.equal(form.value.servers.demo.headers.Authorization,'Bearer ${credential:MCP_HUB_MISSING_TEST}');
});

test('secret args and url query parameters are credentialised',async()=>{
  const {service,form,store}=fixture();
  const entry={...body.entry,url:'https://example.com/mcp?token='+TOKEN,args:['--api-key='+TOKEN]};
  const result=await service.mutate({...body,entry});
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(form.value.servers.demo.args[0],'--api-key=${credential:MCPHUB_DEMO_API_KEY}');
  assert.match(form.value.servers.demo.url,/\?token=\$\{credential:MCPHUB_DEMO_TOKEN\}/);
  assert.equal(store.get('MCPHUB_DEMO_TOKEN'),TOKEN);
});

test('without a mounted credential service a plaintext secret fails instead of being written', async () => {
  const {service,form}=fixture();
  delete service.ctx.credentials;
  await assert.rejects(
    () => service.mutate({ ...body, entry: { ...body.entry, headers: { Authorization: 'Bearer plain-token' } } }),
    error => error?.code === 'CREDENTIAL_UNAVAILABLE',
  );
  assert.equal(form.value.servers.demo, undefined, '没有凭证服务时不能把明文写进配置');
});

test('revealing a stored credential without a mounted service fails clearly', async () => {
  const {service}=fixture({servers:{demo:{...body.entry,headers:{Authorization:'Bearer ${credential:MCPHUB_DEMO_TOKEN}'}}}});
  delete service.ctx.credentials;
  await assert.rejects(
    () => service.reveal({ originalName: 'demo', field: 'headers', key: 'Authorization' }),
    error => error?.code === 'CREDENTIAL_UNAVAILABLE',
  );
});

test('plugin, inherited and cleanup rows keep their official-manager boundaries', async () => {
  const base={inherited:{transport:'streamable-http',url:'https://example.com/inherited',enabled:true}};
  const servers={
    inherited:{...base.inherited},
    own:{transport:'streamable-http',url:'https://example.com/own',enabled:true},
  };
  const {service}=fixture({
    servers, base,
    extraRows:[
      {name:'plugin-row',status:{state:'connected'},configured:true},
      {name:'gone-row',status:{state:'closed'},configured:false},
    ],
  });
  const rows=Object.fromEntries((await service.list()).servers.map(row=>[row.name,row]));
  assert.equal(rows['plugin-row'].managed,'plugin');
  assert.equal(rows['plugin-row'].editable,false);
  assert.equal(rows['plugin-row'].removable,false);
  assert.equal(rows['plugin-row'].source.app,'插件注册');
  assert.equal(rows.inherited.managed,'inherited');
  assert.equal(rows.inherited.editable,true);
  assert.equal(rows.inherited.removable,false);
  assert.equal(rows.own.managed,'config');
  assert.equal(rows.own.removable,true);
  assert.equal(rows['gone-row'].managed,'cleanup');
  assert.equal(rows['gone-row'].removable,false);
  assert.equal(rows['gone-row'].source.app,'已删除，清理中');
  await assert.rejects(() => service.mutate({ action:'remove', revision:1, name:'plugin-row' }), error => error?.code==='NOT_WRITABLE');
  await assert.rejects(() => service.mutate({ action:'remove', revision:1, name:'inherited' }), error => error?.code==='INHERITED_ROW');
  await assert.rejects(() => service.mutate({ action:'restart', revision:1, name:'plugin-row' }), error => error?.code==='NOT_WRITABLE');
});
