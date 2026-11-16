import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
// Host and shared modules both run in Node; the browser bundle is checked by the build.
for (const directory of ['src/host', 'src/shared']) {
  for (const file of await readdir(directory)) {
    if (!file.endsWith('.js')) continue;
    const result = spawnSync(process.execPath, ['--check', directory + '/' + file], { stdio: 'inherit' });
    if (result.status) process.exit(result.status);
  }
}
console.log('Host and shared syntax checks passed.');
