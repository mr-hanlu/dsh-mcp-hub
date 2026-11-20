import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

await mkdir('lib', { recursive: true });
// Build outputs are compared byte-for-byte in CI. Git on Windows may check the
// sources out with CRLF, so normalize here instead of depending on autocrlf.
const normalize = text => text.replace(/\r\n/g, '\n');
const css = normalize(await readFile('src/client/style.css', 'utf8'));
await build({ entryPoints: ['src/client/plugin.jsx'], bundle: true, platform: 'browser', format: 'cjs', external: ['react'], write: false, jsx: 'transform', loader: { '.css': 'text' } }).then(async result => {
  // DSH supplies React through its frozen module table, including jsx-runtime.
  const code = normalize(result.outputFiles[0].text);
  await writeFile('lib/client.js', `window.__ModuleLoader__.load({id:'dsh-mcp-hub',factory(require){var module={exports:{}};var exports=module.exports;\n${code}\nreturn module.exports;}});`);
});
await build({ entryPoints: ['src/client/preview.jsx'], bundle: true, platform: 'browser', format: 'esm', outfile: 'dist/preview.js', jsx: 'transform' });
await writeFile('lib/style.css', css);
await writeFile('dist/style.css', css);
await writeFile('dist/index.html', '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DSH MCP Hub · 界面预览</title><link rel="icon" href="data:,"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/preview.js"></script></body></html>');
console.log('Built DSH plugin and local preview.');
