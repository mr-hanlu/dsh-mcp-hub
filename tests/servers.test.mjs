import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retryWhileCleaning, takenNames } from '../src/shared/servers.js';

const cleaning = () => Object.assign(new Error('该名称正在清理上一个连接'), { code: 'NAME_CLEANING' });

test('a cleanup row does not reserve its name', () => {
  assert.deepEqual(takenNames([{ name: 'a' }, { name: 'gone', managed: 'cleanup' }, { name: 'b', managed: 'config' }]), ['a', 'b']);
  assert.deepEqual(takenNames([{ name: 'gone', managed: 'cleanup' }]), []);
  assert.deepEqual(takenNames(undefined), []);
});

test('a name still cleaning up is retried instead of reported', async () => {
  const sleeps = [];
  let attempts = 0;
  const result = await retryWhileCleaning(async attempt => {
    attempts = attempt;
    if (attempt < 3) throw cleaning();
    return { saved: true };
  }, { sleep: async ms => { sleeps.push(ms); } });
  assert.deepEqual(result, { saved: true });
  assert.equal(attempts, 3);
  assert.deepEqual(sleeps, [350, 350]);
});

test('other failures are not retried', async () => {
  let calls = 0;
  await assert.rejects(
    retryWhileCleaning(async () => { calls += 1; throw Object.assign(new Error('已有同名服务器'), { code: 'NAME_TAKEN' }); }, { sleep: async () => {} }),
    error => error.code === 'NAME_TAKEN',
  );
  assert.equal(calls, 1);
});

test('an unfinished cleanup eventually fails with the Host message', async () => {
  let calls = 0;
  await assert.rejects(
    retryWhileCleaning(async () => { calls += 1; throw cleaning(); }, { attempts: 3, sleep: async () => {} }),
    error => error.code === 'NAME_CLEANING' && /清理/.test(error.message),
  );
  assert.equal(calls, 3);
});