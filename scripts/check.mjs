import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
for (const file of await readdir('src/host')) {
  if (!file.endsWith('.js')) continue;
  const result = spawnSync(process.execPath, ['--check', 'src/host/' + file], { stdio: 'inherit' });
  if (result.status) process.exit(result.status);
}
console.log('Host syntax checks passed.');
