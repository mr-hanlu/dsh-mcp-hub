import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
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
test('an empty server list means no services, not an unreadable file', () => {
  // 实测 `~/.claude.json` 写成 `"mcpServers": []`；当成解析失败会让整个来源显示为读取错误。
  assert.deepEqual(extract(parseDocument('{"mcpServers": []}', 'x.json')), []);
  assert.deepEqual(extract(parseDocument('{"mcpServers": {}}', 'x.json')), []);
});
test('Codex env_vars becomes references, and a malformed value stays visible for review', () => {
  const [row] = extract(parseDocument('[mcp_servers.a]\ncommand="node"\nenv_vars=["HOST_ONLY"]\n', 'config.toml'));
  assert.equal(row.entry.env.HOST_ONLY, '${env:HOST_ONLY}');
  assert.deepEqual(row.issues, []);
  const [broken] = extract(parseDocument('[mcp_servers.a]\ncommand="node"\nenv_vars="HOST_ONLY"\n', 'config.toml'));
  assert.match(broken.issues.join(' '), /env_vars/);
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
test('project-scope sources are read from the given directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mcp-hub-project-'));
  await writeFile(join(root,'.mcp.json'), JSON.stringify({ mcpServers: { demo: { command: 'node', args: ['server.js'] } } }));
  try {
    const sources = await scanSources({ home: join(root,'nohome'), env: {}, cwd: root });
    const project = sources.find(source => source.id === 'project');
    assert.equal(project.candidates.length, 1);
    assert.equal(project.candidates[0].source, '当前项目');
    assert.ok(project.files[0].path.endsWith('.mcp.json'));
    const withoutCwd = await scanSources({ home: join(root,'nohome'), env: {} });
    assert.equal(withoutCwd.some(source => source.id === 'project'), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('hides credential-looking keys while ordinary configuration stays readable', () => {
  const entry = { transport: 'streamable-http', url:'https://user:pass@example.com/mcp?apiKey=mysecret#token', headers:{Authorization:'secret','X-Trace-Id':'trace-123'}, env:{GITHUB_TOKEN:'ghp_secret',PATH:'/opt/bin:/usr/bin',NODE_ENV:'production',DATABASE_URL:'postgres://u:p@db.local/app'}, args:['--token=hidden','--port','3000'] };
  const masked = redact(entry);
  for (const value of ['mysecret','secret','ghp_secret','hidden','pass@','p@db.local']) assert.ok(!JSON.stringify(masked).includes(value), value);
  assert.equal(masked.env.GITHUB_TOKEN,MASK);
  assert.equal(masked.env.DATABASE_URL,MASK);
  assert.equal(masked.env.PATH,'/opt/bin:/usr/bin');
  assert.equal(masked.env.NODE_ENV,'production');
  assert.equal(masked.headers['X-Trace-Id'],'trace-123');
  assert.deepEqual(restoreMasked(masked, entry), entry);
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
  // 报名字而不是 `env:MY_TOKEN`：和「变量引用」检查里的缺失名单保持同一个写法。
  assert.equal(info[0].state,'missing');assert.deepEqual(info[0].missing,['MY_TOKEN']);
  assert.equal(info[1].state,'credential');assert.ok(!JSON.stringify(info).includes('private'));
  assert.equal(redact({headers:{Authorization:'Bearer ${credential:AUTH}'}}).headers.Authorization,'Bearer ${credential:AUTH}');
});
test('blank non-secret environment values are legal but invalid names and empty tokens are diagnosed',async()=>{
  const good=await preflight('demo',{transport:'streamable-http',url:'https://example.com',env:{OPTIONAL:''}});
  assert.equal(good.checks.find(check=>check.label==='变量与请求头名称').ok,true);
  assert.equal(good.checks.find(check=>check.label==='密钥填写').ok,true);
  const bad=await preflight('demo',{transport:'stdio',command:process.execPath,args:[],env:{'BAD KEY':'x',API_KEY:''}});
  assert.equal(bad.ok,false);
  assert.match(bad.checks.find(check=>check.label==='变量与请求头名称').detail,/BAD KEY/);
  assert.match(bad.checks.find(check=>check.label==='密钥填写').detail,/API_KEY/);
});
test('environment references are rewritten into credential templates instead of plaintext',async()=>{
  const entry={transport:'stdio',command:'npx',args:['-y','srv'],env:{TOKEN:'${env:GITHUB_TOKEN}',OTHER:'{env:PLAIN}',ALIAS:'${OTHER_VAR}',KEEP:'${credential:EXISTING}'}};
  const checked=await preflight('demo',entry,{env:{PATH:'/bin',GITHUB_TOKEN:'secret-value',PLAIN:'p',OTHER_VAR:'o'}});
  assert.equal(checked.entry.env.TOKEN,'${credential:GITHUB_TOKEN}');
  assert.equal(checked.entry.env.OTHER,'${credential:PLAIN}');
  assert.equal(checked.entry.env.ALIAS,'${credential:OTHER_VAR}');
  assert.equal(checked.entry.env.KEEP,'${credential:EXISTING}');
  assert.equal(JSON.stringify(checked.entry).includes('secret-value'),false);
  const missing=await preflight('demo',{transport:'streamable-http',url:'https://e.com/mcp',headers:{Authorization:'Bearer ${env:MISSING}'}},{env:{}});
  assert.equal(missing.entry.headers.Authorization,'Bearer ${credential:MISSING}');
  assert.equal(missing.checks.find(check=>check.label==='变量引用').ok,false);
});
test('referenceStorage=value keeps the previous write-the-current-value behaviour',async()=>{
  const checked=await preflight('demo',{transport:'streamable-http',url:'https://e.com/mcp',headers:{Authorization:'Bearer ${env:TOKEN}'}},{env:{TOKEN:'abc'},referenceStorage:'value'});
  assert.equal(checked.entry.headers.Authorization,'Bearer abc');
});
test('hard checks mark the constraints a disabled save must still satisfy',async()=>{
  const bad=await preflight('bad name',{transport:'sse',url:'https://example.com'},{env:{}});
  const hard=bad.checks.filter(check=>check.hard&&!check.ok).map(check=>check.label);
  assert.deepEqual(hard,['配置名称','传输方式']);
});
test('resolves ambient references consistently, defers official credentials, rejects missing values', () => {
  const result=resolveReferences({env:{A:'${TOKEN}',B:'{env:TOKEN}',C:'${env:TOKEN}',D:'${credential:KEY}',E:'${MISSING}'}},{TOKEN:'value'});
  assert.equal(result.entry.env.A,'value');assert.equal(result.entry.env.B,'value');assert.equal(result.entry.env.C,'value');assert.equal(result.entry.env.D,'${credential:KEY}');assert.deepEqual(result.unresolved,['MISSING']);
});
test('preflight uses the actual DSH environment without executing a command', async () => {
  const calls=[];
  const input={transport:'stdio',command:'node',args:['server.js'],env:{TOKEN:'${MISSING}'},cwd:'/work'};
  // 显式 linux：Windows 宿主要先把 node 扩展成 node.exe 再探测，期望值也会变。
  const found=join('/runtime/bin','node');
  const options={platform:'linux',env:{PATH:'/runtime/bin'},checkAccess:async path=>calls.push(path),checkStat:async path=>({isDirectory:()=>path==='/work',isFile:()=>path===found})};
  const result=await preflight('test',input,options);
  assert.equal(result.ok,false);assert.ok(result.checks.some(row=>row.label==='变量引用'&&!row.ok));assert.equal(result.entry.command,found);assert.deepEqual(calls,[found]);
  assert.equal(input.command,'node');
});
test('preflight rejects unsupported SSE and absent executable', async () => {
  assert.equal((await preflight('demo',{transport:'sse',url:'https://example.com'})).ok,false);
  const result=await preflight('demo',{transport:'stdio',command:'missing',args:[]},{env:{PATH:'/none'},checkAccess:async()=>{throw new Error()},checkStat:async()=>({isDirectory:()=>true})});
  assert.equal(result.ok,false);
});

test('windows resolves npx through PATHEXT and the real environment', async () => {
  // Windows 上 npx 是 npx.cmd；只按 join(PATH, 'npx') 探测会把合法配置判成找不到命令。
  const calls=[];
  const found=join('/tools','npx.cmd');
  const result=await preflight('demo',{transport:'stdio',command:'npx',args:['-y','srv']},{
    platform:'win32',env:{Path:'/tools',Pathext:'.cmd'},
    checkAccess:async path=>{calls.push(path);if(path!==found)throw new Error('ENOENT')},
    checkStat:async path=>({isDirectory:()=>false,isFile:()=>path===found}),
  });
  assert.equal(result.ok,true,JSON.stringify(result.checks));
  assert.equal(result.entry.command,found);
  assert.deepEqual(calls,[found]);
});

test('windows falls back to the default PATHEXT when the environment has none', async () => {
  const calls=[];
  const found=join('/tools','npx.EXE');
  const result=await preflight('demo',{transport:'stdio',command:'npx',args:[]},{
    platform:'win32',env:{PATH:'/tools'},
    checkAccess:async path=>{calls.push(path);if(path!==found)throw new Error('ENOENT')},
    checkStat:async path=>({isDirectory:()=>false,isFile:()=>path===found}),
  });
  assert.equal(result.entry.command,found);
  assert.equal(calls.length,2,'默认扩展名顺序应先 .COM 再 .EXE');
});

test('a command that already has an extension is not probed twice', async () => {
  const found=join('/tools','server.cmd');
  const result=await preflight('demo',{transport:'stdio',command:'server.cmd',args:[]},{
    platform:'win32',env:{PATH:'/tools',PATHEXT:'.CMD;.EXE'},
    checkAccess:async path=>{if(path!==found)throw new Error('ENOENT')},
    checkStat:async path=>({isDirectory:()=>false,isFile:()=>path===found}),
  });
  assert.equal(result.entry.command,found);
});

test('non-windows hosts keep exact command matching', async () => {
  const found=join('/tools','npx');
  const calls=[];
  const result=await preflight('demo',{transport:'stdio',command:'npx',args:[]},{
    platform:'linux',env:{PATH:'/tools'},
    checkAccess:async path=>{calls.push(path);if(path!==found)throw new Error('ENOENT')},
    checkStat:async path=>({isDirectory:()=>false,isFile:()=>path===found}),
  });
  assert.equal(result.entry.command,found);
  assert.deepEqual(calls,[found]);
});

test('preflight never invents a working directory', async () => {
  const result = await preflight('demo', { transport: 'stdio', command: process.execPath, args: [] });
  assert.equal(Object.hasOwn(result.entry, 'cwd'), false);
  assert.equal(result.checks.find(check => check.label === '工作目录').ok, true);
  const declared = await preflight('demo', { transport: 'stdio', command: process.execPath, args: [], cwd: '~/work' }, { home: '/home/u', checkStat: async () => ({ isDirectory: () => true }) });
  assert.equal(declared.entry.cwd, resolve(join('/home/u', 'work')));
});

test('transport-specific fields are reported instead of silently dropped', () => {
  const [row] = extract({ mcpServers: { demo: { command: 'node', args: [], headers: { Authorization: 'x' }, timeout: 30 } } });
  assert.match(row.issues.join(' '), /headers/);
  assert.match(row.issues.join(' '), /timeout/);
});

test('an unparseable url stays readable and ordinary query parameters stay visible', () => {
  assert.equal(redact({ url: 'not a url' }).url, 'not a url');
  const kept = redact({ url: 'https://example.com/mcp?version=1&apiKey=secret' });
  assert.match(kept.url, /version=1/);
  assert.ok(!kept.url.includes('secret'));
});

test('a reference satisfied by the credential store is not reported missing', async () => {
  const checked = await preflight('demo', { transport: 'streamable-http', url: 'https://e.com/mcp', headers: { Authorization: 'Bearer ${env:STORE_TOKEN}' } }, { env: {}, describeCredential: async name => name === 'STORE_TOKEN' ? { configured: true, source: 'store' } : { configured: false } });
  assert.equal(checked.checks.find(check => check.label === '变量引用').ok, true);
  assert.equal(checked.variables[0].state, 'configured');
  assert.equal(checked.variables[0].source, 'store');
  const unknown = await preflight('demo', { transport: 'streamable-http', url: 'https://e.com/mcp', headers: { Authorization: 'Bearer ${env:NOWHERE}' } }, { env: {}, describeCredential: async () => ({ configured: false }) });
  assert.equal(unknown.checks.find(check => check.label === '变量引用').ok, false);
});

test('Claude project-scoped servers are imported with a scoped name', async () => {
  const home = await mkdtemp(join(tmpdir(), 'mcp-hub-claude-'));
  try {
    await writeFile(join(home, '.claude.json'), JSON.stringify({
      projects: { '/Users/u/app': { mcpServers: { demo: { command: 'node', args: ['a.js'] } } } },
      mcpServers: { demo: { command: 'node', args: ['b.js'] } },
    }));
    const claude = (await scanSources({ home, env: {} })).find(source => source.id === 'claude');
    assert.deepEqual(claude.candidates.map(row => row.name).sort(), ['demo', 'demo-app']);
    assert.equal(claude.candidates.find(row => row.name === 'demo-app').detail, '/Users/u/app');
    assert.deepEqual(claude.candidates.find(row => row.name === 'demo-app').entry.args, ['a.js']);
  } finally { await rm(home, { recursive: true, force: true }); }
});

test('scans Claude Desktop, Gemini, VS Code, Windsurf and Copilot CLI on macOS', async () => {
  const home = await mkdtemp(join(tmpdir(), 'mcp-hub-multi-'));
  const write = async (path, data) => {
    await mkdir(join(home, path.split('/').slice(0, -1).join('/')), { recursive: true });
    await writeFile(join(home, path), typeof data === 'string' ? data : JSON.stringify(data));
  };
  try {
    await write('Library/Application Support/Claude/claude_desktop_config.json', { mcpServers: { claudeDesktop: { command: 'node', args: [] } } });
    await write('.gemini/settings.json', { mcpServers: { geminiRemote: { httpUrl: 'https://gemini.example/mcp' } } });
    await write('Library/Application Support/Code/User/mcp.json', { servers: { vscodeLocal: { type: 'stdio', command: 'node', args: [] } } });
    await write('.codeium/windsurf/mcp_config.json', { mcpServers: { windsurfRemote: { serverUrl: 'https://windsurf.example/mcp' } } });
    await write('.copilot/mcp-config.json', { mcpServers: { copilotCli: { command: 'node', args: [] } } });
    const sources = await scanSources({ home, env: {}, platform: 'darwin' });
    const byId = Object.fromEntries(sources.map(source => [source.id, source]));
    assert.deepEqual(byId['claude-desktop'].candidates.map(row => row.name), ['claudeDesktop']);
    assert.deepEqual(byId.gemini.candidates.map(row => row.name), ['geminiRemote']);
    assert.equal(byId.gemini.candidates[0].entry.transport, 'streamable-http');
    assert.equal(byId.gemini.candidates[0].entry.url, 'https://gemini.example/mcp');
    assert.deepEqual(byId.vscode.candidates.map(row => row.name), ['vscodeLocal']);
    assert.deepEqual(byId.windsurf.candidates.map(row => row.name), ['windsurfRemote']);
    assert.equal(byId.windsurf.candidates[0].entry.url, 'https://windsurf.example/mcp');
    assert.deepEqual(byId['copilot-cli'].candidates.map(row => row.name), ['copilotCli']);
  } finally { await rm(home, { recursive: true, force: true }); }
});

test('project scan includes Gemini and OpenCode workspace configs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mcp-hub-project-extra-'));
  try {
    await mkdir(join(root, '.gemini'), { recursive: true });
    await writeFile(join(root, '.gemini/settings.json'), JSON.stringify({ mcpServers: { geminiProject: { command: 'node', args: [] } } }));
    await writeFile(join(root, 'opencode.json'), JSON.stringify({ mcp: { opencodeProject: { type: 'local', command: ['node', 'server.js'] } } }));
    const sources = await scanSources({ home: join(root, 'nohome'), env: {}, cwd: root, platform: 'darwin' });
    const project = sources.find(source => source.id === 'project');
    assert.deepEqual(project.candidates.map(row => row.name).sort(), ['geminiProject', 'opencodeProject']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Gemini httpUrl and Windsurf serverUrl aliases normalize as HTTP', () => {
  const [gemini] = extract({ mcpServers: { remote: { httpUrl: 'https://gemini.example/mcp', headers: { Authorization: 'Bearer ${env:TOKEN}' } } } });
  assert.equal(gemini.entry.transport, 'streamable-http');
  assert.equal(gemini.entry.url, 'https://gemini.example/mcp');
  assert.equal(gemini.entry.headers.Authorization, 'Bearer ${env:TOKEN}');
  const [windsurf] = extract({ mcpServers: { remote: { serverUrl: 'https://windsurf.example/mcp' } } });
  assert.equal(windsurf.entry.transport, 'streamable-http');
  assert.equal(windsurf.entry.url, 'https://windsurf.example/mcp');
});
