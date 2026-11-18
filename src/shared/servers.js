// 服务列表相关的界面共用判断：浏览器与 Host 都能引入，因此只用标准语法。

/**
 * 编辑器里「已被占用」的名称。
 *
 * 删除服务后，官方 Manager 会短暂（清理失败时则是长期）保留一行 `managed: 'cleanup'`
 * 的实例；它的名字在配置里已经空出来，可以重新添加，所以不能算重名。
 */
export function takenNames(servers) {
  return (servers ?? []).filter(row => row && row.name && row.managed !== 'cleanup').map(row => row.name);
}

const defaultSleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 写入同名配置时，若旧实例还在清理（Host 返回 `NAME_CLEANING`），短暂重试而不是
 * 立刻报错：正常删除后清理只需几百毫秒，用户不该为此再点一次保存。
 * 其他错误照常抛出；重试用尽后把最后一次的错误抛给调用方。
 */
export async function retryWhileCleaning(run, { attempts = 6, delayMs = 350, sleep = defaultSleep } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try { return await run(attempt); }
    catch (error) {
      if (error?.code !== 'NAME_CLEANING' || attempt >= attempts) throw error;
      await sleep(delayMs);
    }
  }
}