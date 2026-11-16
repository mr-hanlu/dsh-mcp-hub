import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { extract, fingerprint, MASK, parseDocument, preflight, redact, resolveReferences, restoreMasked, scanSources, variableInfo } from '../src/host/config.js';

test('parses Codex TOML including bearer environment reference', () => {
  const [row] = extract(parseDocument('[mcp_servers.github]\nurl="https://example.com/mcp"\nbearer_token_env_var="TOKEN"\n', 'config.toml'));
  assert.equal(row.entry.headers.Authorization, 'Bearer ${env:TOKEN}');
  assert.equal(row.entry.transport, 'streamable-http');
});
test('parses OpenCode JSONC command arrays, old and nested containers', () => {
  for (const data of ['{"mcp":{"demo":{"type":"local","command":["node","server.js"],"environment":{"KEY":"abc"}}}}', '{"mcp":{"servers":{"demo":{"type":"local","command":["node","server.js"],"environment":{"KEY":"abc"}}}}}']) {
    const [row] = extract(parseDocument('// comment\n' + data, 'opencode.jsonc'));
    assert.equal(row.entry.command, 'node'); assert.deepEqual(row.entry.args, ['server.js']); assert.equal(row.entry.env.KEY, 'abc');
  }
});
test('unknown policy and auth fields require explicit review instead of silently disappearing', () => {
  const [row] = extract({ mcpServers: { demo: { url: 'https://example.com/mcp', disabledTools: ['delete'], oauth: true } } });
  assert.match(row.issues.join(' '), /disabledTools/); assert.match(row.issues.join(' '), /oauth/);
});
test('one malformed source entry does not break the rest of the scan', () => {
  const rows = extract({mcpServers:{broken:{command:'node',args:'bad'},working:{command:'node',args:[]}}});
  assert.equal(rows[0].issues.length,1);assert.equal(rows[1].entry.command,'node');
});
test('the enabled key inside authentication context participates in deduplication', () => {
  assert.notEqual(fingerprint({env:{enabled:'yes'}}),fingerprint({env:{enabled:'no'}}));
});
test('scanning reads only known files and reports malformed files without leaking content', async () => {
  const home = await mkdtemp(join(tmpdir(), 'mcp-hub-scan-'));
  await mkdir(join(home, '.codex'));
  await writeFile(join(home,'.codex/config.toml'), '[mcp_servers.a]\ncommand="node"\nargs=["server.js"]');
  await writeFile(join(home,'.claude.json'), '{secret-broken-json');
  const sources = await scanSources({ home, env: {} });
  assert.equal(sources[0].candidates.length, 1); assert.equal(sources[1].files[0].state, 'error');
  assert.equal(sources[3].files[0].state, 'missing');
  assert.ok(!JSON.stringify(sources).includes('secret-broken-json'));
});
test('redacts all environment, header and argument values, including credentials in URL', () => {
  const entry = { transport: 'streamable-http', url:'https://user:pass@example.com/mcp?apiKey=mysecret#token', headers:{Authorization:'secret'}, env:{arbitrary:'sensitive'}, args:['--token=hidden'] };
  const masked = redact(entry);
  for (const value of ['mysecret','sensitive','--token=hidden','pass@']) assert.ok(!JSON.stringify(masked).includes(value));
  assert.equal(masked.env.arbitrary,MASK); assert.deepEqual(restoreMasked(masked, entry), entry);
});
test('fingerprints distinguish authentication contexts and ignore enabled/order', () => {
  assert.equal(fingerprint({url:'x',headers:{b:'2',a:'1'},enabled:true}),fingerprint({enabled:false,headers:{a:'1',b:'2'},url:'x'}));
  assert.notEqual(fingerprint({url:'x',headers:{Authorization:'one'}}),fingerprint({url:'x',headers:{Authorization:'two'}}));
});
test('ordinary args, empty args and whitespace remain readable; only credential args are hidden', () => {
  const entry={args:['-y','@playwright/mcp@latest','','a b','--token','abc123','--api-key=private','--port','3000']};
  const view=redact(entry);
  assert.deepEqual(view.args.slice(0,4),entry.args.slice(0,4));
  assert.deepEqual(view.args.slice(4),['--token',MASK,'--api-key='+MASK,'--port','3000']);
  assert.deepEqual(restoreMasked(view,entry),entry);
});
test('editing around masked values cannot silently discard the change', () => {
  const entry={args:['--token=private']};
  assert.throws(()=>restoreMasked({args:['--other='+MASK]},entry),/隐藏字段已修改/);
});
test('references remain visible and variable diagnostics identify the missing key without values', () => {
  const entry={env:{TOKEN:'${env:MY_TOKEN}',AUTH:'${credential:AUTH}',SECRET:'private'}};
  assert.equal(redact(entry).env.TOKEN,'${env:MY_TOKEN}');
  const info=variableInfo(entry,{});
  assert.equal(info[0].state,'missing');assert.deepEqual(info[0].missing,['env:MY_TOKEN']);
  assert.equal(info[1].state,'credential');assert.ok(!JSON.stringify(info).includes('private'));
  assert.equal(redact({headers:{Authorization:'Bearer ${credential:AUTH}'}}).headers.Authorization,'Bearer ${credential:AUTH}');
});
test('blank non-secret environment values are legal but invalid names and empty tokens are diagnosed',async()=>{
  const good=await preflight('demo',{transport:'streamable-http',url:'https://example.com',env:{OPTIONAL:''}});
  assert.equal(good.checks.find(check=>check.label==='环境变量与请求头').ok,true);
  const bad=await preflight('demo',{transport:'stdio',command:process.execPath,args:[],env:{'BAD KEY':'x',API_KEY:''}});
  assert.equal(bad.ok,false);assert.match(bad.checks.find(check=>check.label==='环境变量与请求头').detail,/BAD KEY/);
});
test('resolves ambient references consistently, defers official credentials, rejects missing values', () => {
  const result=resolveReferences({env:{A:'${TOKEN}',B:'{env:TOKEN}',C:'${env:TOKEN}',D:'${credential:KEY}',E:'${MISSING}'}},{TOKEN:'value'});
  assert.equal(result.entry.env.A,'value');assert.equal(result.entry.env.B,'value');assert.equal(result.entry.env.C,'value');assert.equal(result.entry.env.D,'${credential:KEY}');assert.deepEqual(result.unresolved,['MISSING']);
});
test('preflight uses the actual DSH environment without executing a command', async () => {
  const calls=[];
  const input={transport:'stdio',command:'node',args:['server.js'],env:{TOKEN:'${MISSING}'},cwd:'/work'};
  const options={env:{PATH:'/runtime/bin'},checkAccess:async path=>calls.push(path),checkStat:async path=>({isDirectory:()=>path==='/work',isFile:()=>path==='/runtime/bin/node'})};
  const result=await preflight('test',input,options);
  assert.equal(result.ok,false);assert.ok(result.checks.some(row=>row.label==='变量引用'&&!row.ok));assert.equal(result.entry.command,'/runtime/bin/node');assert.deepEqual(calls,['/runtime/bin/node']);
  assert.equal(input.command,'node');
});
test('preflight rejects unsupported SSE and absent executable', async () => {
  assert.equal((await preflight('demo',{transport:'sse',url:'https://example.com'})).ok,false);
  const result=await preflight('demo',{transport:'stdio',command:'missing',args:[]},{env:{PATH:'/none'},checkAccess:async()=>{throw new Error()},checkStat:async()=>({isDirectory:()=>true})});
  assert.equal(result.ok,false);
});
