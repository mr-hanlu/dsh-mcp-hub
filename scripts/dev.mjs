import './build.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { testConnection } from '../src/host/probe.js';
const files = { '/': ['dist/index.html', 'text/html'], '/preview.js': ['dist/preview.js', 'text/javascript'], '/style.css': ['dist/style.css', 'text/css'] };
createServer(async (req, res) => {
  if (req.url === '/preview/test' && req.method === 'POST') {
    const host = req.headers.host;
    const peer = req.socket.remoteAddress;
    const origin = req.headers.origin;
    const trusted = ['127.0.0.1:4173','localhost:4173'].includes(host) && ['127.0.0.1','::ffff:127.0.0.1','::1'].includes(peer) && req.headers['sec-fetch-site'] !== 'cross-site';
    if (!trusted || origin && !['http://' + host].includes(origin)) { res.writeHead(403); return res.end(); }
    try {
      if (!(req.headers['content-type'] ?? '').startsWith('application/json')) throw new Error('需要 JSON 请求');
      let text = '';
      for await (const chunk of req) { text += chunk; if (Buffer.byteLength(text) > 256 * 1024) throw new Error('配置过大'); }
      const body = JSON.parse(text);
      const abort = new AbortController();
      res.on('close', () => abort.abort());
      const result = await testConnection({ get: () => undefined }, body.name, body.entry, { home: homedir(), env: process.env, signal: abort.signal });
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(JSON.stringify(result));
    } catch { res.writeHead(400, { 'content-type': 'application/json' }); return res.end(JSON.stringify({error:'无法测试，请检查配置内容'})); }
  }
  const target = files[new URL(req.url, 'http://localhost').pathname];
  if (!target) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': target[1] + '; charset=utf-8', 'cache-control': 'no-store' });
  res.end(await readFile(target[0]));
}).listen(4173, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:4173 (sample inventory; connection tests run real MCP processes)'));
