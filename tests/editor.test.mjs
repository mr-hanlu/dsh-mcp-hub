import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEditorDocument } from '../src/shared/mcp-config.js';
import { preflight } from '../src/host/config.js';

const amap = {'amap-maps':{command:'npx',args:['-y','@amap/amap-maps-mcp-server'],env:{AMAP_MAPS_API_KEY:'${AMAP_MAPS_API_KEY}'}}};
test('the supplied amap named map parses name, transport, args and environment reference', async () => {
  const [row] = parseEditorDocument(JSON.stringify(amap));
  assert.equal(row.name,'amap-maps');assert.equal(row.entry.transport,'stdio');
  assert.deepEqual(row.entry.args,amap['amap-maps'].args);
  assert.deepEqual(row.entry.env,amap['amap-maps'].env);
  const checked = await preflight(row.name,row.entry,{env:{PATH:''}});
  assert.equal(checked.ok,false);assert.equal(checked.variables[0].state,'missing');
  assert.deepEqual(checked.variables[0].missing,['AMAP_MAPS_API_KEY']);
});
test('editor and file import accept mcpServers, Codex and OpenCode containers',()=>{
  for(const document of [{mcpServers:amap},{mcp_servers:amap},{servers:amap},{mcp:{servers:{'amap-maps':{type:'local',command:['npx','-y','@amap/amap-maps-mcp-server'],environment:amap['amap-maps'].env}}}}]) {
    const [row]=parseEditorDocument(JSON.stringify(document));
    assert.equal(row.name,'amap-maps');assert.equal(row.entry.transport,'stdio');assert.deepEqual(row.entry.env,amap['amap-maps'].env);
  }
});
test('direct configurations infer transport and keep native runtime settings',()=>{
  const [row]=parseEditorDocument(JSON.stringify({command:'node',args:['server.mjs'],startupTimeoutMs:60000,reconnect:{enabled:false}}),'demo');
  assert.equal(row.name,'demo');assert.equal(row.entry.transport,'stdio');assert.equal(row.entry.startupTimeoutMs,60000);assert.deepEqual(row.entry.reconnect,{enabled:false});
});
test('multiple servers are returned rather than silently reduced to the first',()=>{
  assert.equal(parseEditorDocument(JSON.stringify({...amap,other:{url:'https://example.com/mcp'}})).length,2);
});
test('unrecognized documents are rejected, while one bad service row does not discard the others',()=>{
  for(const document of [{},null,[],{env:{TOKEN:'x'}}]) assert.throws(()=>parseEditorDocument(JSON.stringify(document)));
  const rows=parseEditorDocument(JSON.stringify({bad:{command:'node',env:['bad']},good:{command:'node',args:['server.mjs']}}));
  assert.equal(rows.length,2);
  const bad=rows.find(row=>row.name==='bad'),good=rows.find(row=>row.name==='good');
  assert.equal(bad.invalid,true);assert.ok(bad.issues[0].includes('无法解析'));
  assert.equal(good.invalid,undefined);assert.equal(good.entry.transport,'stdio');
  assert.deepEqual(bad.path,['bad']);
});
