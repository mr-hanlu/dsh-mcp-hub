#!/usr/bin/env node
/**
 * 校验 `npm pack --dry-run --json` 的打包清单。
 *
 * 为什么要这一步：`files` 白名单写错时，`npm pack` 仍然会“成功”，只是包变小了；
 * 装进 DSH 之后才在插件页报错。这里把「包里必须有什么、不许有什么」变成一条
 * 会失败的检查，CI 才能挡住。
 *
 * 用法：node scripts/assert-pack.mjs pack.json
 */
import { readFileSync } from 'node:fs';

const target = process.argv[2];
if (!target) {
  console.error('用法：node scripts/assert-pack.mjs <pack.json>');
  process.exit(2);
}

const raw = JSON.parse(readFileSync(target, 'utf8'));
// npm 11 及以前返回数组，npm 12 返回以包名为键的对象，两种都接受。
const entries = Array.isArray(raw) ? raw : Object.values(raw);
const files = new Set(entries.flatMap(entry => (entry.files ?? []).map(file => file.path)));

const required = [
  'lib/client.js',
  'lib/style.css',
  'cordis.patch.yml',
  'icon.svg',
  'locale/zh.json',
  'locale/en.json',
  'src/host/index.js',
  'src/host/service.js',
  'src/host/config.js',
  'src/host/probe.js',
  'src/host/catalog.js',
  'src/shared/mcp-config.js',
  'src/shared/display.js',
  'src/shared/backup.js',
  'src/shared/errors.js',
  'README.md',
  'LICENSE',
];
// `files` 里用 `!docs/CODE_REVIEW*` 排除复审报告；它只对仓库有参考价值，不该进包。
const forbidden = ['docs/CODE_REVIEW_2026-11-16.md', 'docs/CODE_REVIEW_2026-11-16_v2.md'];

const missing = required.filter(name => !files.has(name));
const leaked = forbidden.filter(name => files.has(name));
const problems = [];
if (!files.size) problems.push('清单为空——npm pack 的输出格式可能变了，需要更新本脚本');
if (missing.length) problems.push('缺少：' + missing.join('、'));
if (leaked.length) problems.push('不应发布：' + leaked.join('、'));

if (problems.length) {
  console.error('打包内容校验失败：\n- ' + problems.join('\n- '));
  console.error('实际清单：\n' + [...files].sort().join('\n'));
  process.exit(1);
}

console.log('打包内容校验通过：' + files.size + ' 个文件，必需项齐全，复审报告未进包。');