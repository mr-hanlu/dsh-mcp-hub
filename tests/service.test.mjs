import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HubService } from '../src/host/service.js';
import { createHandler, apply } from '../src/host/index.js';
function fixture({ status = {state:'connected',toolCount:1}, schemas = [{name:'mcp__demo__read',parameters:{type:'object'}}], servers = {}, base = {}, waitMs = 8 } = {}) {
  const form={ns:'mcp-manager',revision:1,value:{servers},base:{servers:base}};
  const writes=[];
  const ctx={settings:{describe:()=>[structuredClone(form)],mutate:async(ns,ops,revision)=>{
    assert.equal(ns,form.ns);assert.equal(revision,form.revision);writes.push(ops);
    for(const op of ops){const name=op.path[1];if(op.op==='unset')delete form.value.servers[name];else if(op.path.length===2)form.value.servers[name]=op.value;else form.value.servers[name][op.path[2]]=op.value;}
    form.revision++;
  }},mcpManager:{list:()=>Object.keys(form.value.servers).map(name=>({name,status})),restart:async()=>{}},tools:{schemas:()=>schemas}};
  return {service:new HubService(ctx,{metaPath:null,waitMs,intervalMs:1}),form,writes};
}
const body={action:'save',name:'demo',entry:{transport:'streamable-http',url:'https://example.com/mcp',headers:{}},revision:1};
test('reports success only after official runtime and registry agree',async()=>{
  const {service,writes}=fixture();const result=await service.mutate(body);
  assert.equal(result.ok,true);assert.equal(result.saved,true);assert.equal(writes.length,1);
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
  assert.equal(result.ok,false);assert.match(result.checks.at(-1).detail,/超时/);
});
test('persisted but failed connection is not success and is disabled',async()=>{
  const {service,form}=fixture({status:{state:'failed',reason:'auth',lastError:'denied'}});
  const result=await service.mutate(body);assert.equal(result.ok,false);assert.equal(result.saved,true);assert.equal(form.value.servers.demo.enabled,false);
});
test('connected without promised registered tools never reports success',async()=>{
  const {service}=fixture({schemas:[]});const result=await service.mutate(body);assert.equal(result.ok,false);assert.match(result.checks.at(-1).detail,/超时/);
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
test('API uses official owner-only Fetch routes for browser and desktop',()=>{
  const routes=[];
  apply({inject:()=>{},effect:fn=>fn(),connection:{fetch:{register:route=>{routes.push(route);return ()=>{};}}}});
  assert.equal(routes.length,8);assert.ok(routes.every(route=>route.path.startsWith('/api/dsh-mcp-hub/')));
  assert.deepEqual(routes.find(route=>route.path.endsWith('/mutate')).methods,['POST']);
});
test('API refuses unavailable services and masks foreign parse exceptions',async()=>{
  const req=new Request('http://localhost/api/dsh-mcp-hub/scan',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  assert.equal((await createHandler(()=>null,'scan')(req)).status,503);
  const response=await createHandler(()=>({scan:()=>{throw new Error('secret foreign message')}}),'scan')(req);
  assert.equal(response.status,400);assert.ok(!JSON.stringify(await response.json()).includes('secret'));
});
