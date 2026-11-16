# 代码审核（2026-11-16）

审核对象：`dsh-mcp-hub` 0.1.0（commit `58f079f`），运行环境 DSH **0.2.2-rc.3**（Desktop profile）。
本文档只做审核与建议，未修改任何源码。依据：仓库源码与测试、本机已安装的 DSH 包文档与源码（逐条核对到行）。

## 总体结论

明显高于「首版原型」：分层清晰（host / shared / client）、官方 API 调用面基本全对（14 处假设逐条核对，**没有一处必然报错的误用**）、敏感值有遮蔽↔还原的完整往返、测试覆盖了真正的失败语义（"配置写进去 ≠ 连接成功"）。可以进入真实 profile 验收。

问题集中在三类：

1. **打包与插件身份不完整**：缺 `locale` / `meta` / `./icon` 导出与 `Config`，在插件管理器里会退化成「包名 + 默认图标」，可调参数全部硬编码。
2. **绕开了几处官方机制**：导入时求值环境变量导致密钥明文落盘；4 秒轮询代替 `mcp-manager/status` 事件；长等待压住串行写队列；`describe()` 拿了未脱敏的值。
3. **错误契约脆弱**：靠中文前缀白名单决定是否透出错误文案，i18n 一上就失效，且把真实的 revision 冲突吞成通用话术。

## 一、P0：建议发布前处理

### 1. 导入时把环境变量引用解析成明文写进 DSH 配置（安全）

- 位置：`src/host/config.js:70-85`（`resolveReferences`）→ `src/host/service.js:164-172`（`checked.entry` 直接写入）。
- 现象：`${env:GITHUB_TOKEN}`、`${TOKEN}`、`{env:TOKEN}` 在保存时被替换成真实值，`settings.mutate` 写进去的就是明文；`args`、`command`、`cwd`、`headers` 同样。
- 与官方约定不一致：mcp-client 的模板只识别 `${credential:REF}`（`dsh-mcp-client/src/templates.ts:14`），官方明确写「原始插件配置保留模板字符串」「密钥值应保存在凭据提供方中」（`dsh-mcp-manager/README.zh.md:82`）。而本地凭据提供方的解析顺序是 存储文件 → 启动环境 → 项目 `.env` → `$DSH_HOME/.env`（`dsh-credentials-local/README.zh.md:76-80`）——`${credential:NAME}` 本来就能从启动环境取到值。
- 影响：密钥落到 profile 配置文件（可被同步、备份、截图、issue 带出）；轮换必须重新编辑；**导入来源信息丢失**——保存后该值被 `redact` 遮蔽，用户再也看不出它原本来自哪个环境变量。
- 建议：导入/保存时把 `${NAME}` / `${env:NAME}` / `{env:NAME}` **改写**成 `${credential:NAME}` 再写入，而不是求值；UI 说明"引用会保留在配置里，由 DSH 凭证服务在连接时解析"。若担心与 `.env` 回退语义有差异，给「保留引用（推荐）/ 写入当前值」两个选项，默认保留。

### 2. 插件身份不完整：缺 locale / meta / `./icon` 导出

- 位置：`package.json:8-22`、`:48-58`。
- 现象：没有 `locale/en.json`、`locale/zh.json`；`exports` 没有 `"./locale/*.json"` 与 `"./icon"`；`files` 没有 `locale`。`icon.svg` 在包里但没有导出路径，DSH 读不到。
- 影响（`references/host-plugin.md:31-52`）：插件管理器里标题回退成 `dsh-mcp-hub`、描述回退成 `package.json.description`、图标用默认插画、detail 页只能用 README。不影响加载，但这是发布物的第一印象。
- 建议：补 `locale/zh.json`、`locale/en.json`（`meta.title` / `meta.description` / 可选 `meta.detail`），补两个 `exports`，`files` 加 `locale`。

### 3. Host 侧没有 `Config`，可调参数全部硬编码

- 位置：`src/host/index.js:34`（`apply(ctx)` 无 config）、`service.js:16-18`（`waitMs=45000`、`intervalMs=250`）、`config.js:7`（2 MB）、`index.js:17`（1 MB）、`App.jsx:358`（200 KB）。
- 官方约定：「可调值放进插件 `Config`，用户在 `cordis.patch.yml` 里改，用户的 patch 层能跨升级保留」（`references/practices.md:22`、`host-plugin.md:62-65`）。
- 影响：首次 `npx` 下载/慢网络下 45 秒偏紧，用户无法放宽；轮询间隔、大小上限同理。
- 建议：加 `export const Config`（schemastery），至少暴露 `connectWaitMs`、`pollIntervalMs`、`probeTimeoutMs`、`maxConfigBytes`、`extraSourcePaths`。

### 4. 前端 4 秒轮询，而官方提供了状态事件与 `watch`

- 位置：`App.jsx:323`（`setInterval(..., 4000)`）、`service.js:48-70`（每次 `list()` 都 `settings.describe()` + `mcpManager.list()` + 每个服务 `tools.schemas()`）。
- 官方能力：`mcp-manager/status` 事件在每次状态变化时发布（`dsh-mcp-manager/src/types.ts:46`）；`mcpManager.list()` 返回 `configured` 与清理结果；还有 `watch(signal)` 流（`dsh-mcp-manager/src/index.ts:313`）。
- 影响：状态最多延迟 4 秒；每次轮询做一次全量 describe/schema 扫描；多开页面成本线性增长。
- 建议：Host 订阅 `mcp-manager/status` 维护缓存，`/servers` 只回缓存（describe 仅在 revision 变化时重算）；或改成长轮询/SSE。前端保留低频兜底。顺带就能拿到 `attempt` / `maxAttempts` / `nextRetryAtMs`，做出「3 秒后重试（第 2/10 次）」。

### 5. 写入后在串行队列里阻塞等待最长 45 秒

- 位置：`service.js:149-153`（`serialize`）、`:154-210`（`mutate` 内含 `waitConnected`）、`:211-226`。
- 现象：整段（含最多 45 秒的 `waitConnected` 轮询）都在 `serialize` 里，期间任何其他写操作（删除、启停、另一个保存）都要排队。
- 影响：用户点第二个操作会"卡住"且无提示；HTTP 层超时后前端报错但配置其实已写入，状态不一致。
- 建议：拆开「写入」与「验证」——写入后立即返回 `{ saved: true, verifying: true }`，验证放到队列外（独立 AbortController、允许并发），前端按状态流更新。这样也天然满足"测试取消"。

## 二、P1：重要问题

### 6. 错误契约靠中文前缀白名单（实际已在吞掉官方 revision 冲突）

- 位置：`index.js:29`。
- 现象：`/^(配置|未找到|已有|此服务|第一版|服务已|扫描结果|隐藏值|请|缺少|不支持|需要|无效)/` 命中才透出原文，否则一律「操作失败，请检查配置和 DSH 状态后重试」；同一行把所有错误统一成 HTTP 400，且没有 `ctx.logger` 记录原始错误。
- 已经会踩到的具体路径：`settings.mutate` 的 revision 冲突抛 `SettingsConflictError`，消息是英文（`settings namespace "mcp-manager" changed since it was read ...`，`dsh-settings/src/index.ts:394`），不匹配白名单 → 用户只看到通用话术，不知道"刷新重试"。插件自己在 `service.js:157` 的预检只能挡住一部分竞态。
- 建议：改成结构化 `{ error, code }`（`REVISION_CONFLICT` / `NAME_TAKEN` / `VALIDATION_FAILED` / …），前端按 code 映射文案；未知错误 `ctx.logger.error(error)` 并返回 requestId；区分 409 / 422 / 500。

### 7. `draft` 模式跳过全部 preflight（与第 6 项叠加放大）

- 位置：`service.js:167`：`if (!checked.ok && body.mode !== 'draft') return ...`。
- 现象：保存为停用时，名称格式、传输方式、env key 合法性等检查全部不生效，直接写。官方 Manager 在写入处会校验并拒绝坏条目（`dsh-mcp-manager/README.zh.md:80`），所以不会写坏配置，但用户拿到的是官方报错 → 被第 6 项吞掉 → 只看到「操作失败」。
- 建议：`draft` 只放行"连接类"检查（命令不存在、变量缺失、网络不通），硬约束（名称正则、传输枚举、字段形状、env key 格式）始终校验。

### 8. `list()` 没有使用官方的 `configured` 与清理状态

- 位置：`service.js:56-68`（用 `Object.hasOwn(entries, name)` 推断 `owned`、用 `form.base.servers` 推断继承）。
- 影响：官方会保留"已删除但仍在清理/清理失败"的行并标 `configured: false`（`README.zh.md:108`、`src/types.ts:24-31`）。这些行现在显示成「插件注册 / 只读」，用户会以为是自己装的插件服务，真实含义却是"需要重启 DSH"。
- 建议：用 `row.configured` 区分三态：配置条目 / 插件注册 / 残留清理；`failed.reason === 'cleanup'` 时提示「清理未完成，需重启 DSH」。

### 9. `settings.describe()` 拿了未脱敏的值

- 位置：`service.js:36`（`this.ctx.settings.describe()` 无参数）。
- 事实：`describe()` 默认不脱敏，只有 `{ redactSecrets: true }` 才替换 `value/base/user`（`dsh-settings/src/index.ts:328-331`）；官方所有线上入口都强制脱敏（`dsh-api-settings-controller/src/index.ts:103`）。
- 影响：Host 内存与诊断链路里持有 `env`/`headers`/URL 明文，完全依赖自己的 `redact()` 兜底；漏一个字段就是静默泄露，不会报错。
- 建议：不要求全量脱敏（重复检测与 reveal 需要真值），但至少：① 对外返回前统一过一次 `redact`（已做）；② 日志里永不打印 `form.value`；③ 若将来配置层级添加 `role('secret')` 字段，改用 `describe({ redactSecrets: true })` 派生对外视图。

### 10. `redact` 把全部 env / headers 一律遮蔽

- 位置：`src/shared/display.js:4-23`；测试 `tests/config.test.mjs:41-44` 把这条当契约固化。
- 影响：`PATH`、`NODE_ENV`、`DEBUG`、`LOG_LEVEL` 这类完全非敏感的值也变成 `••••••••`。后果是配置页不可读、导入核对必须逐项点「显示」、diff 无从看起；用户很自然会"全点显示"，反而削弱遮蔽意义。
- 建议：改成「按键名启发式 + 显式兜底」——匹配 `token|secret|password|key|auth|credential` 才遮蔽，其余显示明文（`Authorization` 始终遮蔽）；或"默认全遮 + 一键显示非敏感值"。

### 11. `validate` 路由是死代码

- 位置：`index.js:22`、`service.js:135-141`、`preview.jsx:51`；客户端只用 `/test` 与 `/mutate`。
- 建议：接上「仅检查（不启动进程）」按钮——对 `npx` 类服务很实用；或删掉，避免两套校验语义漂移。

### 12. README 与注释对"桌面通道"的描述不准确

- 位置：`README.md:96`（"浏览器与桌面 IPC 使用同一条官方 Fetch 通道"）、`index.js:45` 注释（"support browser HTTP and desktop IPC"）。
- 事实：exact Fetch 路由只由 `/api` 的 HTTP 载体分发（`dsh-client-connection/src/index.ts:141-165`，桥接器是 `node:http`）；**不存在独立的 desktop IPC 分发通道**。桌面能用是因为 GUI 页面本身就是 `http://127.0.0.1:<port>`。
- 影响：读代码的人会以为有两条通道；将来若接 IPC/worker 载体，这套路由会静默 404。
- 建议：文档与注释改成"桌面与 Web 都走同一条 `/api` HTTP 通道"，把 IPC 相关表述删掉。

### 13. 前端 `__DSH_TRANSPORT__` 分支是死代码

- 位置：`App.jsx:21`：`globalThis.__DSH_TRANSPORT__?.fetch`。
- 事实：在整棵安装树（含全部 `@deepseek-ai` 包与 lib 产物）检索该标识符**零命中**，永远走 `globalThis.fetch` 回退。回退本身是官方写法（第一方 `dsh-client-ui-deliverables/src/presented.ts:12-19` 也用文档相对 URL `fetch('api/...')`），所以能用。
- 建议：删掉该分支；但保留"无前导斜杠"的相对路径写法（与第一方一致），并在真实设置页确认 URL 不在子路径下。

### 14. 客户端全中文硬编码，无 locale 服务

- 位置：`App.jsx`（约 60 条中文散落）、`plugin.jsx:13`。
- 官方约定：「可见 UI 文案走 Client locale 服务」（`references/ui-plugin.md:13`）。
- 建议：与第 2 项的 `locale/*.json` 合并做，文案集中管理。

### 15. 诊断遮蔽对短值过度替换

- 位置：`service.js:71-79`、`probe.js:4-10`。
- 现象：把每个"密钥值"用 `split/join` 从报错文本里删掉；若某个 env 值是 `a`、`1`、`/`，会把整段报错替换成 `[隐藏]`。
- 建议：只对长度 ≥ 4/6 的值替换。另外 mcp-client 自己已把解析值替换成 `[redacted]`（`mcp-client/README.zh.md:82`），这层可以做薄。

### 16. 依赖自带 `@deepseek-ai/dsh-mcp-client` 副本

- 位置：`package.json:31`。
- 事实：本机安装版同为 `0.2.2-rc.3` → 当前一致。但插件解析到自己 `node_modules` 里的**第二份拷贝**，其模块级状态（`activeServerNames`、`cellsByFiber`）与 Host 内那份互不相通。`peerDependencies` 只约束 `@deepseek-ai/dsh`，拦不住 mcp-client 的版本漂移。当前 `probeServer` 不触碰这些状态所以无害。
- 建议：文档化取舍；或加运行时版本校验，不一致时提示；安装体积（20+ 个 `@deepseek-ai/*` 包）也值得在 README 说明。

### 17. 发布链路缺 `prepack` 构建

- 位置：`package.json:23-29`。`exports["./client"] → ./lib/client.js`，但 `npm pack` 前必须手动 build；忘一次就发出没有前端模块的包。
- 建议：加 `"prepack": "node scripts/build.mjs"`，并断言 `lib` 存在。

### 18. `.idea/` 未被忽略

`git status` 显示 `.idea/` 未跟踪 → 加入 `.gitignore`。

## 三、P2：打磨项

| # | 位置 | 问题 | 建议 |
| --- | --- | --- | --- |
| 19 | `service.js:46` | `tool.parameters ?? tool.inputSchema ?? {}` —— `ToolSchema` 只有 `parameters`（`dsh-tools/src/schema.ts:641`），`inputSchema` 是无效兜底 | 删掉 |
| 20 | `index.js:36` | `profileContext` 放进必需 inject；它只在 dsh 启动的 profile 中存在（`dsh-base` 用 `disabled: !!js "!ctx.get('profileContext')"`）。缺席时回调永不执行，所有接口永久 503 | 已返回可读的 503 文案，可接受；建议日志里补一条"profileContext 缺失" |
| 21 | `plugin.jsx:13` | `ctx.slots.inject` 内部已用 `ctx.effect` 绑定 fiber（`dsh-client-ui-renderer/src/client/registry.ts:209-211`），外面再套一层冗余但无害 | 可简化 |
| 22 | `App.jsx:32` | 未知 `state` 只显示「状态未知」，不带原始值 | 显示 `未知（${state}）` |
| 23 | `App.jsx:385` | 所有通知都用 `check` 图标，`muted`/错误语义不匹配 | 按 tone 选图标 |
| 24 | `App.jsx:323` | 轮询无暂停、无「最后更新」时间 | 编辑器打开时暂停，页脚显示更新时间 |
| 25 | `service.js:19-20, 97-104` | `candidates` / `sourceGroups` 只增不减 | 设上限或按来源 LRU |
| 26 | `config.js:7` / `index.js:17` / `App.jsx:358` | 三处上限不一致（2 MB / 1 MB / 200 KB） | 由 `Config` 统一驱动 |
| 27 | `style.css:137` | 弹窗 `position:fixed` + `z-index:1000` | 真实设置页验证是否被容器 `transform`/`overflow` 裁剪、是否压在 DSH 弹层之下 |
| 28 | `App.jsx:87,104` | `Pairs`/`Arguments` 用数组下标做 key，删行后焦点与受控状态会错位 | 用稳定 id |
| 29 | `App.jsx` 整体 | 无错误边界；slot 内抛错会整块空白（官方会输出 `slot entry crashed`） | 加 `ErrorBoundary` 兜底展示 |
| 30 | `package.json` | 缺 `repository` / `keywords` / `engines` | 发布前补齐 |

## 四、与官方约定不一致的汇总

| 主题 | 现状 | 官方约定 / 依据 |
| --- | --- | --- |
| 密钥存储 | 导入时求值成明文写入 | 保留 `${credential:}` 模板（`mcp-manager/README.zh.md:82`、`mcp-client/src/templates.ts:14`） |
| 可调参数 | 全部硬编码 | 放进 `Config`（`practices.md:22`、`host-plugin.md:62-65`） |
| 插件元数据 | 无 locale / `./icon` 导出 | locale + `meta.title/description/detail` + icon（`host-plugin.md:31-52`） |
| UI 文案 | 中文硬编码 | 走 Client locale 服务（`ui-plugin.md:13`） |
| 状态同步 | 4 秒轮询 | `mcp-manager/status` 事件 / `watch`（`mcp-manager/src/types.ts:46`、`src/index.ts:313`） |
| 条目归属 | 自行推断 `owned`/`base` | `list()` 的 `configured`（`src/types.ts:24-31`） |
| 对外视图 | `describe()` 明文 | 线上入口用 `{ redactSecrets: true }`（`dsh-settings/src/index.ts:328`） |

### 已逐条核对、结论为「成立」的调用面

（针对 0.2.2-rc.3，可放心依赖）

- `export const name` / `inject` / `apply(ctx)`：`cordis-plugin-loader/src/index.ts:208-216`、`cordis/src/registry.ts:8-10,324-330`；额外命名导出（`createHandler`）不违规，`dsh-mcp-client` 自己就这么写。
- `ctx.inject([...], cb)` + `child.effect(() => () => {...})`：`cordis/src/registry.ts:176`、`cordis/src/fiber.ts:83-93`。
- `connection.fetch.register({path, methods, requestBody, fetch})`：`dsh-client-connection/src/rpc.ts:147-175`；`methods` 是 `readonly ('GET'|'HEAD'|'POST')[]`（`index.js:49` 的写法求值结果就是 `['GET']`，**正确**）；`requestBody: 'buffered'` 合法；路径须在 `/api` 下且各段匹配 `^[A-Za-z0-9_$.-]+$`；返回 disposer。handler 收到标准 `Request`，**`request.signal` 在客户端断开时触发**（`http-bridge.ts:44-96`），`service.js:23` 的用法成立。
- `settings.describe()` 返回**数组**，元素含 `ns/schema/value/revision/base?/user?`（`dsh-settings/src/index.ts:20-31,327-331`）。
- `settings.mutate(ns, [{op:'set'|'unset', path, value}], revision)`：`index.ts:82-83,368`；revision 为整数；`unset` 遇继承值会回填基座值，与"继承只能停用"的判定自洽；`servers` 是 `.volatile()`，路径合法。
- `mcpManager.list()/restart()/probe()/watch()`：`dsh-mcp-manager/src/index.ts:269,347,379,313`；视图 `{name, configured, status}`，`lastError`/`reason` 都在 `status` 内（插件读法正确）。
- `status.state` 全集：`closed | waiting-credentials | connecting | connected | reconnecting | failed` + manager 的 `disabled`；客户端 `STATUS` 映射全覆盖。
- `tools.schemas(scope?, toolSet?)`：`dsh-tools/src/index.ts:316`，元素 `{name, description, parameters}`。
- `configEditor.entries()`：`dsh-config-editor/src/index.ts:39-44`，`row.options.name/id` 存在；settings 的 `ns` 就是 `entry.options.id`，本插件定位命名空间的方式可行。
- `profileContext.home / name`：`dsh-app-boot/src/profile-context.ts:15-30`（无插件专用数据目录 API，自行写 `$DSH_HOME/mcp-hub/...` 属非官方但可接受）。
- `probeServer(ctx, config, {timeoutMs, signal, maxPages, maxToolNames})` 与返回字段：`dsh-mcp-client/src/probe.ts:61`、`types.ts:64-87`；对非法 options / 模板语法错误 / 缺凭据提供方是**抛异常**，`probe.js:30` 的 try/catch 是必需的。
- `cordis.patch.yml` 的 `- insert: [{id, name, config?}]` 方言：`composition-reference.md:9-13`，与模板一致。
- `dsh.client = {platform, inject}` + `exports["./client"]` + `window.__ModuleLoader__.load({id, factory(require)})`：`docs/subsystems/client-modules.md`、`templates/decoration/client.js:1-2`；`id` 等于包名，`inject` 与第一方设置页注册者一致。
- `settings.section` slot：`dsh-client-ui-settings/src/client/contract/slots.ts:46-57`；`label` 可为 `string | (() => string)`（`slot-catalog.ts:3808-3827`），`id`/`order` 合法；`ctx.slots.inject(name, () => ctx.slots.register(opts, Comp))` 即官方写法。

## 五、测试与验证建议

现状（本次实际执行）：`npm test` **38/38 通过**（488 ms）、`npm run check` 通过、`npm run build` 通过（产出 `lib/client.js`、`dist/*`）。覆盖点确实落在真实的失败语义上，这部分做得好。

建议补：

1. `createHandler` 错误映射：给每条 `throw` 加断言，确保改文案时不会静默降级为「操作失败」（对应第 6 项）。
2. 并发写：两个 `mutate` 并发时第二个必须排队且不读到半途状态（对应第 5 项）。
3. `configured: false` 的残留清理行渲染（对应第 8 项）。
4. `redact` 假阴性：1 字符密钥、URL 编码后的密钥、`Authorization: Bearer` 前缀。
5. `draft` 模式的硬约束（对应第 7 项）。
6. `SettingsConflictError` 的真实路径（可以直接在测试里让 mutate 抛该错误，验证前端文案）。
7. E2E：用 `agent-browser`/Playwright 驱动真实设置页，覆盖「导入 → 测试 → 保存 → 关闭 → 列表状态」（NEXT_TASKS P0-5 已列）。
8. CI：单元测试 + `check` + `build` + `npm pack --dry-run` 文件清单断言（现在的 `files` 很容易漏）。

另：本机 `npm ci` 目前会因 `~/.npm` 缓存目录属主为 root 而失败（`EPERM ... /Users/houtianyu/.npm/_cacache`）。需 `sudo chown -R $(id -u):$(id -g) ~/.npm`，或用 `npm ci --cache /tmp/npm-cache`。README 的复现步骤建议补一句，否则新人第一步就卡住。

## 六、功能优化建议

### 0.2：把现有闭环补完整（低成本、高感知）

1. **密钥模板化**（第 1 项）：默认不落明文，附带"将写入的配置"预览。
2. **状态信息用满**：`attempt / maxAttempts / nextRetryAtMs / closeConfirmed / cleanupError / stage / durationMs` 都在官方返回值里，现在一个都没展示。做出「第 3/10 次重试，4 秒后」「连接阶段失败」vs「工具列表阶段失败」「清理未完成，需重启 DSH」，比"连接失败"有用得多。
3. **支持重命名**：现在明确拒绝（`service.js:161`）。导入撞名时用户无法把已有服务改成自己的命名。实现上就是 unset + set，保留 revision 校验与失败回滚。
4. **测试可取消 + 阶段进度**：信号已经传到 `probeServer`（`service.js:146`、`probe.js:25`），只差取消按钮和「握手 / 工具发现 / 清理」三阶段进度。
5. **批量操作**：「重连全部失败项」「停用全部」「一键复查」。
6. **当前环境可见**：`list()` 已返回 `hostname / home / platform`，UI 完全没用。加 profile 名、DSH 版本、Manager 版本，反馈问题时一眼说清环境。
7. **可导出的脱敏诊断**：一次操作生成一份 JSON（检查项、阶段、错误、版本），用户直接贴到 issue。

### 0.3：把 Hub 做成"装配入口"

8. **Agent 工具化（最建议）**：官方要求「一个操作，两个调用方」——Host 服务方法 + UI 入口 + Agent tool（`references/user-actions.md`）。你现在已有干净的服务层，暴露 `mcp_list / mcp_add / mcp_enable / mcp_remove` 几乎零额外成本，直接让模型自己装配 MCP。删除、读取密钥这类"授权类"动作保持仅用户可做。这是同类插件里最能拉开差距的功能。
9. **导入前 diff 视图**：现在只列"未迁移字段"；把「来源配置 → 将写入配置」并排显示，比一句「有 2 项需要核对」更容易让人下决心。
10. **项目级扫描**：`.mcp.json`、`.cursor/mcp.json`、`.vscode/mcp.json` 都在项目目录里。扫当前 workspace，并明确"作用域 = 全局 / 项目"，解决"导入了但不知道放哪"的困惑。
11. **导出 / 备份 / 恢复**：默认不含密钥（导出 `${credential:}` 模板）；恢复前预览冲突。
12. **工具上下文成本提示**：每个服务显示工具数与 schema 体积估算，让用户知道"启用它会占多少上下文"。和后续 Tool Search 天然衔接，也是 MCP 用户最真实的痛点。

### 0.4 及以后（与现有 roadmap 一致）

13. 在线目录搜索（等官方数据源）、完整 OAuth（等官方 `needs-auth` 与授权 seam）、单工具权限（官方说明是"条目自然扩展，待真实消费方"）。继续按 `NEXT_TASKS.md` 的 P2 顺序推进即可。

## 七、小结

- **值得保留的设计**：拒绝"写入即成功"、测试连接真正执行并确认清理、隐蔽值的往返语义、错误里的密钥遮蔽、按来源分组的导入视图。
- **发布前至少处理**：1（密钥明文）、2（locale/icon 元数据）、6（错误码化）、7（draft 硬校验）、17（prepack）。
- **最划算的三个功能**：Agent 工具化、状态信息用满、支持重命名。