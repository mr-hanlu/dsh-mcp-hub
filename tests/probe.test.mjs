import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testConnection } from '../src/host/probe.js';

test('missing variables prevent any process or network connection',async()=>{
  let called=false;
  const result=await testConnection({get:()=>undefined},'demo',{transport:'streamable-http',url:'https://example.com/mcp',headers:{Authorization:'${MISSING}'}},{env:{},probe:async()=>{called=true;}});
  assert.equal(result.ok,false);assert.equal(called,false);
});
test('a successful handshake without confirmed cleanup does not pass',async()=>{
  const result=await testConnection({},'demo',{transport:'streamable-http',url:'https://example.com/mcp'},{probe:async()=>({ok:true,toolNames:[],closeConfirmed:false})});
  assert.equal(result.ok,false);assert.equal(result.checks.at(-1).ok,false);
});
test('the official probe rejects an existing executable that is not an MCP server',async()=>{
  const result=await testConnection({get:()=>undefined},'not-mcp',{transport:'stdio',command:process.execPath,args:['-e','process.exit(0)'],env:{}},{timeoutMs:2000});
  assert.equal(result.ok,false);assert.equal(result.checks.find(check=>check.label==='MCP 握手与工具发现').ok,false);
});

test('probe reports the entry that would be written',async()=>{
  const result=await testConnection({},'demo',{transport:'streamable-http',url:'https://e.com/mcp',headers:{Authorization:'Bearer ${env:TOKEN}'}},{env:{TOKEN:'x'},probe:async()=>({ok:true,toolNames:[],closeConfirmed:true})});
  assert.equal(result.entry.headers.Authorization,'Bearer ${credential:TOKEN}');
});
