# 代码审核（第二轮，2026-11-16）

审核对象：`dsh-mcp-hub` 0.1.0 工作区（`58f079f` + 未提交改动），运行环境 **DSH 0.2.2-rc.3 / Desktop（app.asar）**。

方法：通读全部源码（约 1.4k 行）与 55 项测试；对 Host 侧每条 API 断言回到已安装包源码逐条核对（`dsh-settings`、`dsh-mcp-manager`、`dsh-mcp-client`、`dsh-tools`、`dsh-client-connection`、`dsh-credentials-local`、`dsh-api-remotes`、`cordis`）；对可疑行为写最小脚本复现。未修改任何源码。

本次实际执行：`npm test` 55/55 通过（488 ms）、`npm run check` 通过、`npm run build` 通过、`npm pack --dry-run` 文件清单正确（`docs/CODE_REVIEW*` 已被排除）。

## 总体结论

上一轮 review 的 P0/P1 已基本落地：`Config`、locale/icon/`./locale/*.json` 导出、`prepack`、结构化错误 `code`、`draft` 硬校验、写入与验证分离、`redact` 键名启发式、改名、批量操作、`configured:false` 清理态。**可以进入真实 profile 验收**，但验收前建议先修 A1–A3。

剩下的问题不是"原型级缺陷"，而是三类：

- **A. 真实缺陷**：有明确复现路径或官方源码依据（10 条）。
- **B. 与官方能力脱节**：能用但代价高/不一致（8 条）。
- **C. 功能建议**：在"只做用户侧 MCP 管理"的范围下，把配置与管理体验做扎实（见 C 节的范围决定）。

---

## A. 建议修复的缺陷

### A1（P0）后台验证的定时器里没有异常边界，会以 exit 1 结束整个 Host/桌面应用

- 位置：`src/host/service.js:280`（原生 `setInterval`）、`:284`（同步调用 `checkVerification`）、`:287-298`。
- `checkVerification` 每 250ms 调用 `this.descriptor()`（内部 `settings.describe()` + `configEditor.entries()`）、`this.ctx.mcpManager.list()`、`this.tools(name)`（→ `tools.schemas()`）。其中 `descriptor()` 会**主动** `fail('SERVICE_UNAVAILABLE', …)`（`service.js:50`），`tools.schemas()` 也会在工具投影失败时抛错。
- 后果被官方机制放大：DSH 在 `dsh-app-boot/lib/index.js` 装了 fail-loud 处理器（`onException` → `fatal uncaught exception` → 先 2s release 做 `fiber.dispose()`，再 `process.exit(1)`），装机点是 `dsh/lib/profile-boot-*.js`，Desktop 主进程正是走 `runProfile`。**已用官方 handler 复现**：定时器里抛错 → `fatal uncaught exception … exit code 1`，整个桌面应用退出。
- 一个关键的不对称：同一函数经 `mcp-manager/status` 事件触发时是**安全**的——manager 用 `ctx.parallel` + `allSettled` 收尾，异常只被记日志。所以问题不在"会抛"，而在"不能被定时器裸调"。
- 窗口确实被缩小过：mcp-manager 被摘掉时，内层 `ctx.inject` 的 fiber 会拆除并 `close()` 清定时器；但 `describe()`/`schemas()` 其余抛错路径（profile 重载瞬间、坏 YAML、工具投影失败）没有任何保护。
- 较轻的一档后果：`startVerification` 里那次同步 `checkVerification` 若抛错，会让 `mutate` 在**配置已经写入之后**抛 500，前端显示失败但配置已生效。
- 建议：`checkVerification` 整体包 `try/catch` → `finishVerification(record,'failed','状态读取失败：…')`，`ctx.logger.warn` 记原始错误；`startVerification` 的首次检查走同一路径；`ctx.interval`（`cordis-plugin-timer`）也只是裸 `setInterval`，仍须自己 try/catch，它的价值仅是随 fiber 自动清理。

### A2（P1）只查 `process.env`，把"其实能连上"的配置挡在保存之外

- 位置：`src/host/config.js:108`（`ambient[key] === undefined || ambient[key] === ''` → `unresolved`）、`src/host/service.js:202`（非 draft 时 `!checked.ok` 直接拒绝写入）。
- 事实（`dsh-credentials-local` README）：`${credential:REF}` 的解析顺序是 **存储文件 → 启动环境 → 项目 `.env` → `$DSH_HOME/.env`**。插件只用 `process.env` 判断，于是：
  - 用户在 DSH 设置里存过 `GITHUB_TOKEN`，但 shell 里没有 → 导入 Codex 的 `Bearer ${env:GITHUB_TOKEN}` 被判"缺少变量：GITHUB_TOKEN"，**保存被拒**；
  - 变量写在项目 `.env` 里同理。
- 现状只有一条不明显的绕过路径：手动把该项改成"DSH 凭证引用"（`${credential:…}`），该分支被标为 `credential` 而非 `missing`。
- 建议：`this.ctx.credentials.describe(credentialRef(name))` → `{configured, source, writable, masked}`，用它判定；`credentials` 服务不可用时才回退到 `process.env`，并把它降级成 warning（`hard:false` 且不参与 `checked.ok` 的阻塞判断）。顺带就能显示"来自存储 / 来自环境 / 未配置"。

### A3（P1）保存时把 `cwd` 固化成一个绝对路径（用户没填也会写）

- 位置：`src/host/config.js:141-143`：`let cwd = entry.cwd || process.cwd(); … entry.cwd = resolve(cwd)`。
- 实测：`preflight('demo', {transport:'stdio', command: process.execPath})` 返回 `cwd: "/Users/houtianyu/Desktop/my/dsh-mcp-hub"`，即 **Host 进程的 cwd**。
- 后果：① 每条 stdio 配置都被写入一个用户从未同意的绝对目录；② 桌面 App 的进程 cwd 可能是 `/` 或 app 目录，与用户终端含义完全不同，`args` 里的相对路径会静默改变语义；③ 配置不可移植（换机、换 profile 就失效）；④ "将写入的配置" diff 永远多一行 `cwd`。
- 建议：不写 `cwd`（官方 `McpManagedServerEntry.cwd` 的 schema 默认就是 `''`，由 spawn 决定），仅在**用户显式给了一个相对 cwd** 时才解析成绝对路径；`process.cwd()` 只用于"存在性检查"的临时值，不要回写进 entry。

### A4（P2）Claude Code 的项目级 MCP 完全导入不到

- 位置：`src/shared/mcp-config.js:60-67`（`extract` 只认 `mcp_servers / mcpServers / servers / mcp{,.servers}` 或"值本身像配置"的对象）。
- 实测：`{numStartups:12, projects:{'/p':{mcpServers:{'proj-only':{...}}}}, mcpServers:{'user-scope':{...}}}` 只解析出 `user-scope`；**删掉顶层 `mcpServers` 后返回空数组**。
- 事实：`~/.claude.json` 通过 `claude mcp add -s project` 添加的服务就存在 `projects.<path>.mcpServers` 下，这是 Claude Code 最常见的用法之一。
- 建议：来源为 `.claude.json` 时，除顶层 `mcpServers` 外遍历 `projects[*].mcpServers`，候选名加作用域后缀（如 `proj-only@/Users/x/proj`），并在 UI 标注"项目级"。

### A5（P2）导出的配置备份里残留 `••••••••` 占位符

- 位置：`src/client/App.jsx:462-483`（`exportConfig` 只删除 `env`/`headers` 中值为 `MASK` 的项）。
- `redact` 也会遮蔽 `args`（`--token abc`）与 `url` 的 userinfo/query/hash（`src/shared/display.js:22-41`），这些占位符**原样进入备份**；用"本地导入"恢复后会变成字面量 `••••••••` 写进 DSH 配置。
- 建议：导出时统一处理三处——`args` 中含 `MASK` 的项、`url` 中含 `MASK` 的部分（整条 `url` 置空或替换成 `${credential:…}`），并把"已省略项"列全（现在只统计 env/headers）。

### A6（P2）一个形状不合法的既有条目会让整个页面不可用

- 实测：把 `servers.legacy` 设为 `{transport:'stdio', command:'node', args:'--bad'}`：
  - `GET /servers` → `redact()` 里 `args.map` 抛 **TypeError** → `500 INTERNAL`；
  - `POST /scan` → `preflight` 抛 `CONFIG_INVALID` → `422`，整个"本地导入"不可用。
- 这种条目正常写不进去（官方 `validateEntries` 在 composition load / 每次 settings 写入 / 注册处都会拒绝），所以概率低；但降级版 DSH、手工改 patch、或未来 schema 变更都可能出现。
- 建议：`list()` 的每行、`presentSources()` 的每个既有条目各自 `try/catch`，失败行降级为"配置异常（只读）"而不是整体 500；`redact` 对非数组 `args` 做保护。

### A7（P2）`redact` 对 URL 的处理过粗

- 位置：`src/shared/display.js:28-37`。
- 两个问题：① `new URL()` 失败时 `result.url = ''`（实测 `{url:'not a url'}` → `''`），诊断页看不到原始地址，用户无从判断错在哪；② `for (const key of url.searchParams.keys()) set(key, MASK)` 把 `?version=1&transport=sse` 这类非敏感参数也打成星号。
- 建议：解析失败时保留原串（只做"疑似凭据"的整串匹配）；query 用与 `isSecretKey` 一致的启发式，其余明文。

### A8（P2）自动停用后，行内看不到失败原因

- `src/host/service.js:304`：验证失败 → `disableIfUnchanged()` 把 `enabled` 置 false；
- `src/client/App.jsx:64`：`verification.state === 'failed' && status.state !== 'connected' && status.state !== 'disabled'` —— **一旦被自动停用，`state` 就是 `disabled`，行内提示消失**。
- 叠加：验证记录只在内存（`this.verifications`），Host 重启后全部丢失，用户只剩"一条停用的服务，不知道为什么"。
- 建议：行内显示"已停用 · 上次验证失败：<detail>"（把 `disabled` 从排除条件里拿掉，改为按 `verification.finishedAt` 是否晚于上次启用判断），并把最近一次验证结果持久化到 `sources.json` 或 settings 的插件自有命名空间。

### A9（P3）manager 的 `cleanup` 失败会把英文枚举当错误文本显示

- `service.js:10` 的 `diagnostic()` 对 `{state:'failed', reason:'cleanup', result}` 返回 `'cleanup'`，被 `list()` 当作 `lastError` 下发；诊断页正文于是显示 "cleanup"，而同页"停止原因"已翻译成中文。
- 建议：`cleanup` 时用 `result.cleanupError` / `closeConfirmed` 组合出中文描述，不要把枚举回灌给用户。

### A10（P3）零散

- `src/shared/errors.js:11,14,18`：`NAME_INVALID`、`VERIFY_INTERRUPTED`、`VERIFY_TIMEOUT` 三个 code 从未使用（不影响功能，但会让人以为有对应路径）。
- `src/host/service.js:86`：`status.cleanupError` 是**不存在的顶层字段**（真实位置是 `status.result.cleanupError`），这个 `??` 分支永远不命中，属死代码。
- `src/host/service.js:54-55`：用 `mcp__<server>__` 前缀切片反推原始 tool 名；官方在名称有损规范化或超过 64 字符时会追加 `_<12位hash>`（`dsh-mcp-client` 工具命名），此时展示名不是真实 tool 名。`fullName` 仍正确，建议展示时优先用 `fullName` 或标注"已规范化"。
- `src/shared/mcp-config.js:47`：`raw.timeout` 直接当毫秒写入 `startupTimeoutMs`，而各来源应用的 `timeout` 语义/单位未核实（若某来源是秒，会放大 1000 倍）。建议按来源区分或标为"未迁移字段"。
- `normalize` 的 `allowed` 是传输无关的白名单：stdio 条目里出现 `headers`/`url`，或 http 条目里出现 `env`/`cwd` 时会被**静默丢弃**（因为键在 `allowed` 里，不产生 issue）。建议白名单按传输分支，并对被丢弃字段报 issue。
- 扫描来源里 `{{name}}`、`${input:...}`（VS Code `mcp.json` 的 `inputs` 机制）会被当作未解析变量阻断保存，提示文案不指向"这是编辑器输入变量"。

---

## B. 与官方能力/约定脱节

### B1（性能 + 体验）4 秒轮询，而官方有推送

- `App.jsx:379` 每 4 秒 `GET /servers`；`service.list()` 每次重算 `settings.describe()` + `mcpManager.list()` + 逐服务 `tools.schemas()`。
- 官方能力：`mcp-manager/status(name, status)`（`dsh-mcp-manager/src/types.ts`，插件已订阅）、`mcpManager.watch(signal)` 推送完整列表；**并且客户端已经可以直接用**——`dsh-api-remotes/src/client/index.ts:19,47-49,202` 把 `mcpManagerRemote` 挂进 `ctx.remote.mcpManager`（`watch/restart/probe`）。
- 更贵的是验证期的 250ms：`settings.describe()` 在内部会走 `configEditor.configuration()` → `loadProfileDirectory`（**同步读盘 + YAML 解析**）。默认 45s 预算 = 上百次全量 profile 重载，只为读一个状态字段。`settings/document-updated` 与 `mcp-manager/status` 都已经存在，这里应改成事件驱动 + 缓存。
- 建议（两条路，推荐先做 ②）：
  1. Host 订阅 `mcp-manager/status` 维护缓存，`/servers` 返回缓存并按 `revision`/ETag 短路；验证只看事件，轮询降为 2–5s 兜底；
  2. 客户端直接 `ctx.remote.mcpManager.watch(signal)` 取实时状态，插件 `/servers` 只负责**配置条目 + 来源 + 工具摘要**这类低频数据。这样状态延迟从 4s 变即时，请求量降一个数量级，多开页面不再线性叠加。

### B2（性能）`/servers` 每次都返回全部工具的参数 Schema

- `service.js:53-56`：`tools(name)` 每次调用 `ctx.tools.schemas()`；`list()` 在 `servers.map` 里对**每个**服务调用一次。
- 事实（`dsh-tools/src/index.ts`）：`schemas()` 文档写明 "one **deep-cloned** schema per visible tool"，返回的是**全部可见工具**（含内置工具），插件再做前缀过滤。
- 于是每次 `/servers` 的成本 ≈ `服务数 × 全部工具` 次深拷贝；一个 8 服务 / 200 工具的会话，每 4 秒就有上千次 schema 深拷贝 + 数百 KB~数 MB 的 JSON 传输。
- 建议：`schemas()` 只调一次并按 `mcp__<name>__` 前缀分组；列表只下发 `{name, description, schemaBytes}`，完整 `parameters` 改为展开某一行时按需拉取（`/servers/<name>/tools`）。

### B3 官方 `probe(name)` 能诊断**已停用**的条目，插件没用

- `mcpManager.probe(name, options)` 解析模板、连接、读取身份与工具名后关闭，不注册工具，**已停用条目也可探测**。
- 这给"复诊所有服务"/"停用的服务到底还能不能用"提供了一条零成本路径；插件目前只用 `probeServer` 测**未保存**的草稿，配置了但没启用的条目无法单独验证。

### B4 `describe()` 拿的是明文

- `service.js:45` `this.ctx.settings.describe()` 无参数 → `value/base/user` 全明文（`dsh-settings` 默认不脱敏，所有线上入口都强制 `{redactSecrets:true}`）。
- 插件对外已经 `redact` 过，但明文会经过日志、错误对象、诊断导出等多条路径。建议：① 永不 `logger.*(form.value)`；② 错误路径统一走 `safeError`；③ 若将来 manager schema 支持 secret 字段，改用 `describe({redactSecrets:true})` 派生对外视图。

### B5 UI 文案没有走 Client locale 服务

- `dsh-doc/references/ui-plugin.md` 明确："Route visible UI text through the Client locale service"；本项目 `locale/*.json` 只有 `meta`，`App.jsx` 里约 60 条中文硬编码，英文环境下设置页仍是中文。
- 这是发布到插件市场前的体验硬伤（不是功能 bug）。建议与"i18n"一并做，用 `ctx.locale` 取文案。

### B6 `inject` 把"可选能力"写成了硬依赖

- `index.js:63`：`ctx.inject(['settings','mcpManager','tools','profileContext','configEditor'], …)`。
- 事实：cordis 的 `inject` 数组**每一项都是必需**（`_refresh()` 要求全部有 impl），且**没有 `{required, optional}` 语法**——对象形式只是"服务名 → intercept 配置"。所以 `profileContext` / `configEditor` 任一缺失，子 fiber 永不启动，8 个接口永久 503。
- `profileContext` 只在 "由 dsh profile 启动" 时存在（`dsh-app-boot/src/profile-context.ts`）；`configEditor` 属于可选编辑器能力。
- 另外 `inject = ['connection']` 也是硬依赖：`connection` 缺失时 `apply` 根本不跑 ⇒ 8 条路由不存在 ⇒ 前端拿到 404，而不是插件已经准备好的那句 503 文案。
- 建议：内层只 `ctx.inject(['settings','mcpManager','tools'], …)`，其余用 `child.get('profileContext')` / `child.get('configEditor')` 惰性取（`get(name, strict)` 正是"不 inject 也能查"的入口）；`metaPath` 回退到 `join(homedir(), '.dsh', 'mcp-hub', 'default', 'sources.json')`，`cwd` 回退到 `process.cwd()`，并在 UI 标注"无法确定 profile"。顺带：`child.effect(() => child.on(...))` 是多余的一层，`ctx.on` 本身已经 effect-scoped 且返回 disposer。

### B7 依赖树与打包

- `dependencies` 里带了一份 `@deepseek-ai/dsh-mcp-client@0.2.2-rc.3` 的**独立拷贝**：本机版本一致所以当前无害，但 `peerDependencies` 只约束 `@deepseek-ai/dsh`，Host 升级后插件可能拿旧版 `probeServer` 讲新协议。建议运行时校验版本并在不一致时给出可读提示（或改为 `peerDependencies` + 文档要求）。
- 客户端 bundle 里打进了 `smol-toml`（`mcp-config.js:1`），但浏览器侧只用 JSON 解析（TOML 走 Host `/parse`）。拆一个 `parseJsonDocument` 可以省一份体积。

### B8 验证判定的两个边界

- `service.js:296` 用 `this.tools(name).length === status.toolCount` 判定成功：`schemas()` 无 scope 时取的是**全局视图**，与 `toolCount`（实例注册的工具数）一致，这点是对的；但工具名若被有损规范化（官方会追加 12 位 hash），前缀 `mcp__<name>__` 仍完整，也不影响。结论：逻辑成立，**但仍建议在 detail 里带上实际数量**（"已注册 12 个工具，与 Manager 报告一致"），否则失败时用户不知道差了几个。

---

## C. 范围约定与功能建议

### 范围决定（2026-11-16，项目方确认）

本插件**只做"人来管理 MCP"**，不做 Agent 侧的 MCP 工具：

- **不注册 Agent 工具**。MCP 在底层默认全量加载工具；再叠一层 agent 工具等于重复占用与重复加载，收益为负。删除、写入这类动作本身也属于官方要求 user-only 的授权类操作。
- **不做工具上下文成本可视化**。DSH 已有专门的上下文/成本能力且做得很好；本插件专职"MCP 的配置与管理"，不重复造这套分析。
- 由此得到两条设计约束：
  1. 插件不出现任何 `ctx.tools.register(...)`；`/servers` 的字段可以**完全按 UI 需要裁剪**，不必维持面向模型的稳定语义（这反而让 B2 的瘦身更好做）。
  2. "工具"页保持**检查用途**（工具名、描述、参数 Schema），不引入预算、排序、占用估算等分析维度；列表里的"N 个工具"只作为连接健康度的信号。

以下建议均已按此范围重新排序；被排除的项见本节末尾。

### C1 实时状态 + 轻量列表（对应 B1/B2，管理体验的地基）

状态即时、请求降一个数量级；顺带可以做出"3 秒后重试（第 2/10 次）"这种现在做不到的即时体验。

### C2 导入矩阵

1. **来源扩展**：Gemini CLI（`~/.gemini/settings.json`）、Windsurf（`~/.codeium/windsurf/mcp_config.json`）、Cline/Roo（VS Code `globalStorage`）、Zed（`context_servers`）、VS Code 用户设置里的 `mcp.servers`。
2. **项目级**：`.claude.json` 的 `projects[*]`（A4）；项目扫描目录不要固定 `profileContext.cwd`，给"最近项目 / 手动选择目录"。
3. **批量**：一个来源"全部导入"，冲突项集中处理（跳过/改名/覆盖）。
4. **来源变更检测**：记录导入时的文件 mtime + 条目指纹，来源变了就在列表里提示"可重新导入/有差异"，而不是只做一次性复制。
5. **可配置额外来源**：`Config.extraSourcePaths`（企业内网路径）。

### C3 凭据中心

- 用 `ctx.credentials.describe(credentialRef(name))` 显示每个引用的真实状态：已配置（来自存储/启动环境/.env）、可写、脱敏预览；
- 缺失项给"去设置 / 在此保存"（用户点击触发，不做成工具体验）；
- 这一步同时修掉 A2。

### C4 诊断与历史

- **复诊**：一键对全部（含已停用）条目 `mcpManager.probe`，出一张结果表；
- 展示官方已有但没用上的字段：`durationMs`（握手/列工具耗时）、`stage`（`connect` / `list` 阶段失败）、`attempt/maxAttempts/nextRetryAtMs`；
- 验证结果持久化（A8）；"复制诊断摘要"到剪贴板，方便贴 issue。

### C5 编辑体验（"方便配置"的主要体感来源）

- **冲突内解决**：`REVISION_CONFLICT` 时提示"刷新列表"但编辑器无法刷新，只能取消并丢失编辑。建议弹内提供"加载最新版本并保留我的修改"（字段级 merge）或"重试一次"。
- **未保存保护**：关闭/切页时 dirty check（`NEXT_TASKS` P1 已列，仍未做）。
- **ErrorBoundary**：slot 内组件抛错会整块空白（官方会打印 `slot entry crashed`）。
- **稳定 key**：`Pairs`/`Arguments` 用数组下标做 key（`App.jsx:128,146`），删行后焦点与受控值会错位，建议每项生成 `id`。
- **Toast 图标按 tone 走**（现在成功/中性都用 `check`）。
- 表单里的长 JSON 预览（`将写入的配置`）与差异对比保留并加强：这是本插件相对官方设置页最直接的差异化。

### C6 备份与迁移

把 DSH 的 MCP 配置导出成 Claude Code / Codex / Cursor 格式（`${credential:…}` 转成 `${env:…}`，或占位），用于分享与迁移；现有"备份"能力顺带修掉 A5（导出内容不能含 `••••••••` 占位符），恢复前给出冲突预览。

### C7 多语言与可访问性

见 B5；另外补 `aria-live` 上的状态播报、`role="status"` 粒度、窄窗下变量行（已有 720px 断点）与长参数的键盘可达性。

### C8 项目作用域（先别承诺）

"同一服务在 A 项目启用、B 项目不启用"需要官方 Manager 支持作用域（当前 namespace 是全局的）。短期内诚实的做法是：在 UI 明确"这里的启用是全局的"，并把项目级扫描只当作导入来源。

### 明确不做（本轮已排除）

| 项 | 原因 |
| --- | --- |
| Agent 工具（`mcp_servers_list` 等） | MCP 底层默认全量加载，再叠 agent 工具属重复加载；删除/写密钥也应是 user-only |
| 工具上下文成本可视化（token 估算、按成本排序） | DSH 已有专门的上下文工具且做得很好，本插件不重复 |
| 在线目录搜索发现 | 等官方数据源；且当前入口只是"即将推出"占位 |
| 单工具权限开关 | 官方 `McpManagedServerEntry` 无按工具过滤字段（已核对 config-catalog），需等官方 seam |

---

## D. 测试建议（补在当前 55 项之后）

1. `checkVerification` 在 `descriptor()` 抛错时不冒泡（A1）——用抛错的 `settings.describe` 构造。
2. 坏条目容错：`list()` 返回"配置异常"行而不是 500（A6）。
3. `.claude.json` 项目级解析（A4）。
4. `preflight` 不写 `cwd`（A3）。
5. 凭据状态判定：`credentials.describe` 返回 configured 时不产生 `unresolved`（A2）。
6. 备份导出后**不含** `MASK`（A5）——`JSON.stringify(backup).includes(MASK) === false`。
7. `redact` 的 URL 分支：非法 URL、`?version=1`、userinfo、编码后的密钥。
8. 自动停用后行内仍能看到失败详情（A8，可用纯函数断言 `StatusNote` 的分支）。
9. 并发写：两个 `mutate` 同时到达，第二个排队且不读到半途 revision。
10. `npm pack --dry-run` 的清单断言（CI）：`lib/client.js`、`locale/*.json`、`icon.svg`、`src/shared`、`cordis.patch.yml` 必须在，`docs/CODE_REVIEW*` 与 `dist/` 必须不在。

CI 建议：`test` + `check` + `build` + `pack --dry-run` + `npm ci`（附 `--cache /tmp/...` 说明，本机 `~/.npm` 属主为 root 会 EPERM）。

---

## E. 已逐条核对、确认正确的调用面（不必再查）

| 断言 | 依据 |
| --- | --- |
| `settings.describe()` 返回 `{ns, autoGenerate, schema, value, revision, base?, user?, applies, secrets?}` 数组；按 `entry.options.id` 找 ns 成立 | `dsh-settings/src/index.ts` `SettingsDescriptor` |
| revision 冲突消息含 `changed since it was read`，本插件正则能命中 | `SettingsConflictError` 构造 |
| `mcpManager.list()` → `{name, configured, status}`；status 联合含 `closed/waiting-credentials/connecting/connected/reconnecting/failed`，`attempt` 只在 connecting/reconnecting，`maxAttempts/nextRetryAtMs` 只在 reconnecting，`failed.reason` 为 `gave-up/reconnect-disabled/unclosed-generation`，manager 另加 `disabled/load/cleanup` | `dsh-mcp-manager/src/types.ts`、`dsh-mcp-client/src/types.ts` |
| `mcp-manager/status(name, status)` 存在，监听器抛错只被记录、不影响其它监听器 | 同上 `Events` 声明 |
| 官方写入校验：名称正则、缺 command/url、跨传输字段、模板语法、reconnect 规则 | `dsh-mcp-manager/src/index.ts` `validateEntries` |
| `tools.schemas(scope?, toolSet?)` 返回 `{name, description, parameters}`，**深拷贝全部可见工具** | `dsh-tools/src/index.ts` |
| `probeServer(ctx, config, {timeoutMs, maxPages, maxToolNames, signal})`；对非法 options/坏模板/缺 credentials 提供方**抛异常**；返回 `ok/serverInfo/toolNames/truncated/durationMs/stage/closeConfirmed/cleanupError` | `dsh-mcp-client/src/probe.ts` |
| `${credential:…}` 在 command/args/env/cwd/url/headers 生效；缺失值 → `waiting-credentials`；诊断中已解析值替换为 `[redacted]`；stdio 子进程环境先按 `/KEY|PASSWORD|SECRET|TOKEN/i` 与 `DSH_*` 清洗 | `dsh-mcp-client/README.zh.md` |
| `connection.fetch.register({path:'/api/...', methods, requestBody:'buffered', fetch})` 合法；仅 owner Peer 可达；buffered 受全局 JSON 上限约束 | `dsh-client-connection/src/rpc.ts` |
| 客户端可直接用 `ctx.remote.mcpManager`（`watch/restart/probe`） | `dsh-api-remotes/src/client/index.ts` |
| `ctx.logger` 存在；`profileContext` 仅 profile 启动时存在 | `cordis/src/context.ts`、`dsh-app-boot/src/profile-context.ts` |
| 插件自带一份 `@deepseek-ai/schemastery` **不影响** `Config` 校验 | loader 用 `plugin.Config["~standard"].validate(config)` 校验插件自己那份 schema；跨副本识别只靠 `Symbol.for('schemastery')`，没有 `instanceof`；实测默认值/枚举/最小值均生效 |

---

## F. 一句话结论

**代码质量明显高于同类首版插件**（写入≠成功的语义、隐藏值往返、后台验证、测试覆盖失败路径都做对了），Host 侧对官方 API 的调用面**没有新增硬性误用**。

发布前建议只修三件：**A1 定时器异常边界**（会被 DSH 的 fail-loud 处理器升级成整个应用退出）、**A2 凭据判定改走 `ctx.credentials`**（否则能连上的配置存不进去）、**A3 别把 `cwd` 写死成 Host 进程目录**。之后按 C 节的顺序推进——C1（事件驱动状态 + 瘦身列表）打地基，C2–C5 把"导入—配置—诊断—迁移"这条用户闭环做完整。范围上不碰 Agent 工具与上下文成本分析，这个插件就专心地做"DSH 里最好用的 MCP 管理面板"。