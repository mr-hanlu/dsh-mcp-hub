# 开发进度

更新日期：2026-11-18（Asia/Shanghai）

> 收工状态：单测 106 项、`check`、`build`、`test:e2e`（stdio + HTTP + 凭证）、`test:ui`（页面主流程）全部通过；桌面实例已 link 安装并完成第一轮验收。CI 基础流水线与端到端作业已接入；启停后的验证结论已能刷新。下一步是补桌面人工项，见 [后续任务](NEXT_TASKS.md#下一次开发的建议顺序)。

## 当前版本与状态

- 首个正式版本号统一为 **0.1.0**；开发期间的本地临时版本号不计入正式发布历史。
- 当前交付为 DSH 插件源码、可构建的浏览器模块、本地预览、测试及安装打包流程。
- 尚未发布到 npm、插件市场或创建正式发布标签；本次只进行本地 Git 提交，push 由仓库维护者执行。
- 功能重点为「已添加」「本地导入」和「在线搜索」；在线搜索只接官方 MCP Registry，选择后预填编辑页，不静默安装。
- 桌面 `desktop` profile 已用 link 方式安装：`~/.dsh/profiles/desktop/package.json` 里 `dsh-mcp-hub` 指向本仓库，bundles 也含它；第一轮验收见下文。尚未系统验收的是主题与窄窗口、重启 DSH 后的恢复、凭证缺失与凭证服务不可用这些人工项。

## 本轮（换机后）修订：安装文档、依赖边界与认证结论

| 项 | 处理 |
| --- | --- |
| README 安装步骤在桌面应用上跑不通 | 原文档写 `dsh plugin --profile desktop add`，实际桌面 profile 由 Electron 独占，CLI 直接报 `profile "desktop" is managed exclusively by the Electron application`。改为三条路径：插件页「添加插件」输入本仓库绝对路径（推荐）、自建 CLI profile + `--dump-config`、`npm pack` 后装 tarball |
| 官方包写进 `dependencies` 且钉死版本 | `@deepseek-ai/dsh-mcp-client@0.2.2-rc.3`、`@deepseek-ai/schemastery` 改为 `peerDependencies`（可选）+ `devDependencies`，只留 `jsonc-parser`、`smol-toml` 在 `dependencies`。否则插件会自带第二份 MCP 客户端，探针行为与宿主分叉，将来加 OAuth 时最先踩到 |
| 没有 DSH 版本声明 | `package.json` 补 `engines.dsh: ">=0.2.2-0 <0.3.0-0"`，由 DSH 在安装和启动时校验；此前只靠 `@deepseek-ai/dsh` 的 peer 范围兜底 |
| 文档称"DSH 没有 OAuth 授权 seam" | 按 0.2.2-rc.3 源码核对后修正：`dsh-base` 已挂载 `authorization`/`credentials`，grant 记录支持 `access/refresh/expires`，客户端在 `credentials/reference-updated` 后重建连接。缺口是 MCP 规范发现与 401 重新授权，不是整条路 |
| 文档写"桌面 IPC Fetch 通道" | 不准确：桌面与 Web 都经同一条本地 HTTP 监听访问 `/api/dsh-mcp-hub/*`，没有单独的 IPC 分发路径 |

验证：改依赖后 `npm test` 99 项通过，`npm run check`、`npm run build` 通过。

## 本轮（2026-11-18）：修复两层端到端红灯、接入 CI

复现基线时 `npm test`（101 项）、`npm run check`、`npm run build` 都绿，但两条端到端都不健康，CI 也是空白。

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `test:e2e` 报「删除后仍在列表里 1 !== 0」 | 重启后立即删除，`/mutate` 返回 200，但官方 Manager 会先留一行 `managed: 'cleanup'`（状态 `connecting`）约 200ms 再移除；测试拿到 200 就立刻断言列表长度 | `removeRow` 在删除成功后轮询 `/servers`，最多 15s 等该行真正消失，超时才失败。产品行为本身是对的，不用改 Host |
| `test:ui` 起不来：`Cannot find package 'puppeteer-core'` | lockfile 里有 devDependency，当前 `node_modules` 没装（开发机 npm 全局缓存有 root-owned 文件，`npm ci` 直接报错） | 用独立缓存重装：`npm ci --cache /tmp/npm-cache-mcphub`；之后两条端到端都跑通 |
| CI 里「runner 没装 DSH」会假绿 | 两条端到端找不到 `dsh` / Chrome 时打印 SKIP 并以 0 退出 | `tests/e2e/support/profile.mjs` 新增 `skip(reason)`：`DSH_E2E_REQUIRED=1` 时改成失败，CI 用它把 SKIP 变成红 |
| 打包内容没有自动断言 | 只有人工检查过 tarball | 新增 `scripts/assert-pack.mjs`，用 `npm pack --dry-run --json --ignore-scripts` 的清单断言必需文件齐全、复审报告不进包（当前 21 个文件） |

CI：`.github/workflows/ci.yml` 分两个作业。`checks` 在 `ubuntu-latest` 上跑 `npm ci` → `npm test` → `npm run check` → `npm run build` → 打包清单校验并上传清单；`e2e` 走带 `dsh` 标签的自托管 runner，由仓库变量 `DSH_E2E_RUNNER=true` 打开，未打开时整个作业跳过，两条端到端串行（都默认占 `127.0.0.1:3080`，并行会 EADDRINUSE）。

验证：`npm test` 101 项、`npm run check`、`npm run build`、`npm run test:e2e`（含凭证轮换 308ms、401 19ms 结算）、`npm run test:ui`、`node scripts/assert-pack.mjs` 全部通过。

## 本轮（2026-11-18）：启停后重新验证

2026-11-17 验收时发现：手动「启用」只写 `enabled`，不启动新的验证，诊断页的「最近一次验证」还挂着停用前（或上一次保存时）的旧结论；`verificationView()` 优先读内存记录、其次读持久化记录，所以界面状态与事实不符。

| 位置 | 处理 |
| --- | --- |
| `src/host/service.js` 的 `toggle` 分支 | 停用：写完后结束仍在跑的验证（`cancelVerification`）；启用：写入后以新的连接代次重开验证（`startVerification`），返回值带 `verifying: true` |
| `bulk` 的 `enable` / `disable` 分支 | 同一条 revision 写完后再逐个处理：停用取消验证，启用逐个重开验证；批量启用返回 `verifying: true` |
| `evaluateVerification` 的 `disabled` 分支 | 刚写回 `enabled: true` 时官方实例可能仍短暂停在 `disabled`。现在只有配置确实还是停用才判「已取消」，否则保持等待并显示「正在等待服务启动…」，避免验证被自己的写操作误杀 |
| `startVerification` 的取消文案 | 「已被新的保存请求取代」改为「已被新的操作取代」，因为现在也会被启停操作取代 |
| `tests/service.test.mjs` | 新增 5 项：手动启用会重新验证、启用后旧失败结论被替换、停用会结束进行中的验证、瞬时 `disabled` 不误判取消、批量启用会验证被重新打开的条目（单测 101 → 106） |

验证：`npm test` 106 项、`npm run check`、`npm run build`、`npm run test:e2e`、`npm run test:ui` 全部通过。

## 本轮（2026-11-18）：英文文案修正与页面验收分支

英文界面残留三处中文：目录详情「· 更新于」（文本节点被拼成 ` · 更新于 `，精确匹配不到）、保存冲突的「同步最新版本」、测试计数「测试中 n/m」；另有「（n 处与来源不同）」在英文下也漏译。已改为可翻译的文本节点、补词条，并补 i18n 单测。

页面层同时补了两条分支：连接测试进行中原本把「测试全部」按钮整个撤掉，进度文案是死代码；现在按钮保留并显示「测试中 n/m」，旁边是「取消测试」。`test:ui` 增加测试进度/取消、重名跳过、连接失败原因、缺失环境变量、保存后关闭、编辑已有服务六步，失败写全页截图；`tests/manual/echo-server.mjs` 支持 `MCP_ECHO_DELAY` 放慢握手，保证取消有可点的窗口。

验证：`npm test`、`npm run check`、`npm run build`、`npm run test:e2e`、`npm run test:ui`（14 步）全部通过。

## 第一轮桌面验收（2026-11-17）

安装方式：README 方式 A（插件页 → 添加插件 → 仓库绝对路径，link 安装）。版本 DSH 0.2.2-rc.3，macOS（Apple Silicon），profile `desktop`。

| 检查 | 结果 |
| --- | --- |
| 插件行挂载 | `include:dsh-mcp-hub` 状态 `schema`，`packageDir` 指向仓库链接 |
| 客户端页面 | `settings.section` 中 `dsh-mcp-hub` 已注册且 active（order 36） |
| 列表读取 | 200，空列表，`revision 0`，`profile desktop`，`referenceStorage template` |
| 测试连接 | 200 `ok`，10 项检查全过，含「测试连接已关闭」 |
| 添加 + 后台验证 | 保存返回 `verifying`，493 ms 后结算为「DSH 已连接，已注册 1 个工具」 |
| 工具读取 | `tools` 返回 1 个（`echo`） |
| 停用 | 行状态变 `disabled`，工具数 0 |
| 启用 | 回到 `connected` |
| 重启 | 首次以 409 被拒，见下方缺陷 |
| 删除 | 200，列表回到 0 条，无残留「清理中」行 |

发现的缺陷 1（已修）：**重启被 revision 校验挡住**。`restart` 不写配置、是幂等动作，但仍复用保存路径的 revision 校验，所以在「启用 → 重启」这种连续操作里会返回 `REVISION_CONFLICT`。现在 `restart` 在 revision 校验之前处理，只要求条目存在；新增单测「single restart is idempotent and needs no matching revision」，`npm test` 变为 100 项。

发现的缺陷 2（已修）：**401 只会等到超时**。写 HTTP 端到端时发现，token 错误的服务在验证里显示「等待正式连接或工具注册超时」，实际原因是 401 —— 因为客户端没有 needs-auth 状态，401 只出现在 `lastError` 里，而实例会一直重连到验证预算（45 秒）耗尽。现在 `service.js` 用 `AUTH_FAILURE` 文本口径（401/403/unauthorized/invalid_token/authenticat）在 `failed` 与 `reconnecting` 两种状态下提前结算为「需要认证：…」，实测 2 ms 出结论；识别不到时保留原文，不猜原因。

顺手补的自动化（2026-11-18 补齐页面层与 HTTP/凭证）：

- `npm run test:e2e`（`tests/e2e/web-profile.e2e.mjs`）：临时 `DSH_HOME` 里从 `web` 模板建 profile、link 本插件、启动真实 Host，用真实路由跑「列表 → 扫描 → 测试 → 添加 → 验证 → 工具 → 停用 → 启用 → 重启 → 删除」。
- `npm run test:ui`（`tests/e2e/ui-page.e2e.mjs`）：同一套临时 profile 上跑无头 Chrome，真的点一遍页面 —— 设置 → MCP Hub、空状态、`本地导入` 页签、JSON 粘贴逐行测试、一次添加两个、行内「已连接」、重名跳过只添加新服务、测试进行中显示进度并可取消、测试失败显示原因且不能添加、缺失环境变量指出缺哪一项、保存后编辑器关闭、编辑已有服务后重新连接、删除确认弹窗、删完回空状态，以及 JSON / 表单页签切换后草稿仍在；失败时自动写 `tests/e2e/artifacts/ui-failure-*.png`。

`test:e2e` 之后又补了 Streamable HTTP 与凭证（2026-11-18，`tests/manual/echo-http-server.mjs` 作为受控服务）：

| 场景 | 结果 |
| --- | --- |
| 静态 Bearer 头 | 测试 → 保存 → 验证「已连接，已注册 1 个工具」 |
| `${credential:E2E_MCP_TOKEN}` | 测试通过；配置里保留模板，不写明文 |
| 凭证轮换 | 改 `$DSH_HOME/.credentials.yaml` 后 309 ms 内重连（`connectedAt` 变化） |
| 错误 token | 判定为「需要认证：… (HTTP 401)」，**2 ms** 结算 |

轮换能立即生效，靠的是 MCP 客户端的 `credentials/reference-updated` 重连；这条以前只是文档推断，现在有测试守着。

两条都跑通，均不碰用户 profile。共用 `tests/e2e/lib/profile.mjs`（找 dsh、建临时 profile、启动、取会话 cookie）。

尚未覆盖（仍需人工）：主题与深浅色、窄窗口布局、重启 DSH 后的来源记录恢复、真实 DSH 凭证引用（存在 / 缺失 / 更新后重连 / 凭证服务不可用）、与官方 Manager 已有服务 / 插件注册服务 / 继承配置的边界、真实远程 HTTP 服务与 Bearer token 链路。

## 已实现功能

| 模块 | 当前实现 |
| --- | --- |
| DSH 接入 | 在设置中注册 MCP Hub；用官方 `connection.fetch.register` 注册 `/api/dsh-mcp-hub/*` 精确路由；桌面与 Web 都经同一条本地 HTTP 监听访问，没有单独的 IPC 通道 |
| 服务管理 | 列表、状态筛选、搜索、添加、编辑、启停、重启、模态确认删除；行内只保留编辑/重启/删除/启停 |
| 服务详情 | 工具名称、描述、参数 Schema、配置和连接诊断；诊断含重试次数、下次重试、连接清理、官方停止原因与「现在复诊」 |
| 本机导入 | 连接 Host 后自动扫描 Claude Code / Claude Desktop、Codex、Gemini CLI、VS Code / Copilot、Copilot CLI、Windsurf、Cursor、OpenCode 的已知配置位置，覆盖桌面端、CLI/Server 和三大平台 |
| 来源展示 | 按应用折叠；无配置文件或无 MCP 时隐藏来源，读取异常单独提示 |
| 配置文件导入 | JSON、JSONC、TOML；与编辑器共用服务解析规则；手动导入的来源可移除，自动扫描来源只读 |
| JSON 编辑 | 支持直接对象、命名映射和常见客户端容器；推断连接方式、自动带出名称、args、env；一次可解析、逐行测试并批量添加多个服务；表单仍单条 |
| 重复与冲突 | 按连接配置及认证上下文识别重复，提示同名冲突；增删改后重新计算导入状态，不清空候选 ID |
| 条目归属 | 区分用户配置、继承配置、插件注册，以及官方保留的「已删除，清理中」行 |
| 批量与导出 | 异常项一键重连（单次 revision 提交）；导出时可选是否包含密钥。连接状态与诊断在页面内查看，不再单独导出 |
| 在线搜索 | Host 代理官方 MCP Registry 的搜索/详情；npm、PyPI、OCI、streamable-http 转换为可编辑配置；SSE/无法转换的包显示不支持；选择后同时预填表单与 JSON 草稿，复用测试与保存 |
| 写入预览 | 测试或保存后显示将写入的配置，与来源配置做字段级差异对比 |
| 项目级发现 | 扫描启动目录下的 `.mcp.json`、`.cursor/mcp.json`、`.vscode/mcp.json`、`.gemini/settings.json`、`opencode.json(c)`，来源列表标注路径 |
| 配置备份 | 导出时弹窗选择是否包含密钥；默认不含，适合分享；包含时明文写入 env/headers/URL 凭据，适合迁移到自己的设备。恢复复用「本地导入」流程并显示冲突 |
| 环境配置 | stdio 的命令、参数、工作目录、环境变量；HTTP 的地址和请求头；环境变量只直接填写（兼容手写引用）；请求头支持直接值、环境引用和 DSH 凭证引用 |
| 敏感值 | 凭证按字段名识别并隐藏，普通变量与 args 可见；编辑窗口可显式读取原值；隐藏值未改动时恢复原值，修改占位符时拒绝静默覆盖 |
| 连接测试 | 复用官方 `probeServer`，真实执行握手、工具发现和清理，不持久化配置，不注册会话工具 |
| 保存验证 | 使用官方 Settings revision 写入；写入后立即返回，连接与工具注册在后台验证（订阅 `mcp-manager/status`），结果写入服务行并可取消；批量验证共用一个 ticker 和一次状态/工具快照 |
| 编辑体验 | 保持停用状态（无启用开关）；窗口内切换传输方式保留各自内容；保留空参数和参数中的空格 |
| 反馈 | 成功使用约 3.5 秒 Toast，悬停和聚焦时暂停；错误保留供处理；保存后无额外“完成”步骤 |
| 视觉 | 引用 DSH 官方主题变量，支持深浅色；刷新图标路径及按钮居中已检查 |
| 打包与身份 | `locale/zh.json`、`locale/en.json` 提供 `meta.title/description`，导出 `./icon` 与 `./locale/*.json`；`prepack` 自动构建 |
| 实时状态 | 页面长轮询 `POST /wait`，Host 在 `mcp-manager/status`、写入、验证结算时立即唤醒；列表与状态分离 |
| 复诊 | 对已有条目（含已停用）调用官方 `mcpManager.probe`，不触碰运行中的实例 |
| 配置与错误契约 | `export const Config` 暴露等待预算、探测超时、轮询间隔、内容上限和引用保存方式；失败返回结构化 `code`，未知异常只记日志 |

## 本轮（批量添加与编辑体验）交付

| 项 | 处理 |
| --- | --- |
| 一次粘贴多个服务 | 解析改为逐行容错：坏行留在列表里带错误，不再让整份文档失败；每行保留 `raw`/`path` 供行内改名与删除 |
| 添加前测试 | JSON 页可逐行或并发 3 路测试；全部待添加行通过才启用「添加 N 个」；已存在同名行默认跳过，可改名后重测 |
| 一次写入 | 新增 `/mutate action:'import'`，逐条预检后一次 revision 写入；任一待添加行失败则零写入，重复名/超限由服务端拒绝 |
| 添加后能力发现 | 握手成功但 `tools/list` 失败仍允许添加；正式连接验证失败自动停用，并在行内显示失败原因 |
| JSON / 表单独立 | 两个页签各自保留草稿，切换不互相 `JSON.stringify` 覆盖；添加默认 JSON，编辑/导入默认表单，关闭前提示未保存内容 |
| 导入来源删除 | 只允许删除用户手动选择文件产生的 `file-` 来源；自动扫描来源返回只读错误；手动来源及其候选随 profile 持久化，重启后恢复 |
| 验证性能 | 每条验证不再各建一个 interval；共享 ticker 每 tick 只读一次 Manager 状态和工具 schema，批量验证复用快照 |
| 界面语言 | 跟随 DSH 的 `locale` 服务：`zh` 显示中文，其他语言回退英文；翻译只作用于已知界面文案，服务名和工具名保持原样 |
| 撤销本批 | 添加成功后保留 20 秒撤销入口；只删除该批仍未被修改的服务，改名/改配置的条目会跳过 |

验证：`npm test` 通过；`npm run check`、`npm run build` 通过。桌面验收结果见「第一轮桌面验收」。

## 本轮（第二轮复审后）修复

来源：`docs/CODE_REVIEW_2026-11-16_v2.md`。均为缺陷与效率修复，范围仍限定在"用户侧 MCP 管理"。

| 项 | 处理 |
| --- | --- |
| 验证定时器异常会以 exit 1 结束 Host | `checkVerification` 全程 try/catch，抛错时按失败结算并记日志 |
| 只查 `process.env` 会挡住能连上的配置 | 用 `ctx.credentials.describe` 判定引用，缺失才报错，并显示凭据来源 |
| 保存时自动写入 Host 进程目录 | 未声明 `cwd` 时不再写入，只用于命令解析 |
| Claude Code 项目级 MCP 读不到 | 解析 `projects.<目录>.mcpServers`，候选名加后缀并标注项目目录 |
| 备份残留 `••••••••` | `buildBackup` 统一处理 env / headers / args / url，省略项写占位符 |
| 单个坏条目让整页 500 | 列表逐行容错为"配置异常"，导入列表按候选逐条容错 |
| 非法 URL 被抹成空串、query 全被打码 | 保留原串，只遮蔽 userinfo 与敏感 query |
| 自动停用后看不到失败原因 | 行内常显"上次验证未通过"，验证结论持久化到来源记录 |
| manager `cleanup` 失败显示英文枚举 | 统一翻译为「清理未完成，需要重启 DSH」 |
| 4 秒整页轮询 + 每服务深拷贝全部工具 schema | 推送通道 + 状态视图 + `schemas()` 每次请求只读一次 + 工具参数按需加载 |
| `inject` 把可选能力当硬依赖 | 仅 3 个必需服务硬注入，`profileContext` / `configEditor` 惰性获取 |
| 传输字段被静默丢弃、`timeout` 单位不明 | 按传输分支判断并报 issue；`timeout` 交回用户核对 |
| 冲突后只能取消 | 编辑窗口内「同步最新版本」继续保存 |
| 关闭窗口丢修改 | 取消直接关闭（按项目方要求去掉二次确认） |

独立复核（第二人、只读）在实现完成后又发现 3 个本轮引入/放大的问题，已一并修复：

| 问题 | 处理 |
| --- | --- |
| `/status` 推送视图缺少条目形状守卫，会把坏行覆盖成"连接中 · 可编辑" | 抽出 `validEntry`，`list()` 与 `status()` 共用；有测试断言两者一致 |
| 遮蔽改成按词表后出现假阴性（`PGPASSWORD`、自定义头里的 `Bearer …`、`password=…` 参数） | 追加长词子串匹配与内联 `Bearer/Basic/Token` 识别；`PATH`、`NODE_ENV`、`X-Trace-Id` 仍可读 |
| 备份占位符写成 `${…}`，恢复时会被当成未解析变量且界面无定位 | 改为普通中文占位符；URL 只删除被遮蔽的参数，保留地址其余部分 |
| 项目级名称拼接可能超过 32 位，保存时才失败 | 按 `[A-Za-z0-9_-]{1,32}` 截断并保证唯一；容器改为跟随原文件的 `mcpServers`/`mcp_servers`/`servers` |
| 自动停用可能与用户刚做的启用互相覆盖 | 放进同一条写队列，且只在"仍是最新一次验证"时执行 |
| 复诊被取消会记成失败并落盘 | 取消不写验证记录 |
| 非法 JSON 请求体返回 500 | 返回 `REQUEST_INVALID` 400 |
| meta 写失败遗留临时文件 | `finally` 清理；多次写入串行化 |

尚未处理（见复审报告 C 节）：更多导入来源、反向导出、项目作用域。

## 已确定的产品约束

1. 导入采用一次性复制，后续由 DSH 独立管理，不修改或同步来源应用配置，也不复用其运行进程。
2. 自动扫描只读取已知文件、检查运行条件，不执行 MCP 启动命令；点击测试或启用保存后才连接服务。
3. 服务名是本地别名；可用性取决于命令或 URL 是否实现 MCP，而不是名称是否存在于在线目录。
4. `${NAME}`、`${env:NAME}`、`{env:NAME}` 在保存时改写成 `${credential:NAME}`，由 DSH 凭证服务在连接时解析；引用本身不等于已配置密钥。
5. 配置里不写密钥明文：引用是否存在仍会检查，实际取值只发生在测试连接的内存中；`referenceStorage=value` 是显式的回退方案。
6. 导入、持久化、连接、工具注册是不同阶段。正式实例已连接且注册工具数一致才报告启用保存成功；停用保存不表示已验证可用。
7. 不通过调用业务工具来测试权限，不对写入或删除类工具执行探测。
8. 插件注册服务只读，继承配置只能停用；静态 mcp-client 和 Agent preset 不属于官方 Manager 的完整管理范围。

## 已验证范围与边界

| 验证方式 | 结果与覆盖范围 |
| --- | --- |
| `npm test` | 106 项通过：格式解析、高德配置回归、env 缺失与凭据判定、脱敏、重复判断、版本冲突、旧连接误判、工具注册等待、真实非 MCP 程序拒绝、引用改写为凭证模板、硬约束与错误 code、项目级导入、坏条目容错、验证结果持久化、启停后重新验证、推送通道、复诊、备份占位符等 |
| `npm run check` | Host JavaScript 语法检查通过 |
| `npm run build` | 插件浏览器模块及独立预览构建通过 |
| `npm run test:e2e` | 通过：临时 `DSH_HOME` + `web` 模板 profile，真实 `/api/dsh-mcp-hub/*` 路由跑完 stdio 全链路（列表、扫描、测试、添加、验证、工具、启停、重启、删除）与 Streamable HTTP 全链路（静态 Bearer、凭证模板、凭证轮换重连、错误 token 判为需要认证）；删除后等官方清理行消失；不写用户 profile |
| `npm run test:ui` | 通过：无头 Chrome 在临时 profile 上点完设置页 —— 导航到 MCP Hub、空状态、导入页签、JSON 粘贴逐行测试、一次添加两个并显示已连接、重名跳过、测试进度与取消、连接失败原因、缺失环境变量、编辑已有服务、保存后关闭、删除弹窗与删后空状态、页签切换草稿保留；失败留截图 |
| `node scripts/assert-pack.mjs` | 通过：`npm pack --dry-run --json --ignore-scripts` 的清单含 21 个文件，Host / 共享模块 / 浏览器模块 / 样式 / patch / locale / icon / 文档 / LICENSE 齐全，复审报告未进包 |
| CI | 已接入 `.github/workflows/ci.yml`：基础作业公开 runner 可跑；端到端作业需自托管 runner（`DSH_E2E_RUNNER=true` + `dsh` 标签），CI 内 `DSH_E2E_REQUIRED=1` 禁止 SKIP |
| `npm run test:integration` | 1 项真实集成测试通过：官方 DSH 0.2.2-rc.3 临时 profile 中，测试不持久化、保存持久化、连接、工具注册、显式读取、重复判断、停用、停用编辑和删除 |
| 桌面实机验收 | 见「第一轮桌面验收」：安装、挂载、列表、测试、添加与验证、工具、启停、删除均通过；重启缺陷已修 |
| 浏览器验收 | 预览中验证 JSON 自动识别、env 引用显示与缺失提示、删除弹窗、删除后重新导入、保存关闭、Toast 消失和深浅色布局 |
| 预览 HTTP 接口 | 真实调用接口，确认可执行文件存在但不实现 MCP 时返回失败 |
| 安装包 | 已检查浏览器模块能加载，Host 与共享模块进入 tarball，并断言清单从 21 个文件起不再缩水；构建产物和 tarball 不进入 Git |

验证使用受控 MCP 和临时文件，不代表所有来源应用的全部版本、全部平台或真实远程服务均已验收。高德示例验证了解析与缺失变量提示，未使用真实高德密钥完成业务调用。

### 独立预览与真实插件的区别

- 预览初始服务列表和自动扫描列表为示例数据；修改仅影响当前页面会话。
- 预览的手动文件导入会解析实际选择的文件。
- 预览的连接测试以及添加启用服务前的验证会实际启动 / 连接 MCP，结束后关闭；不写入现有 DSH。
- 真实插件读取 Host 上的配置，通过官方 Settings 和 Manager 保存、连接、注册工具。
- 预览无法代替实际 DSH 凭证服务验证，也不能替代设置页的安装验收。官方文档不建议用自建预览页替代"装进真实 profile 再看"的验证顺序。

## 源码入口

| 文件 | 职责 |
| --- | --- |
| `src/client/App.jsx` | 页面、双草稿编辑器、JSON 批量测试/添加、删除弹窗、参数和变量编辑、通知 |
| `src/client/style.css` | 主题变量映射、布局、响应式样式 |
| `src/client/plugin.jsx` | DSH 设置页与样式注册 |
| `src/client/preview.jsx` | 示例数据源、文件解析、连接本地真实测试接口 |
| `src/host/index.js` | 官方 Fetch 路由和插件生命周期 |
| `src/host/service.js` | Settings / Manager 协调、来源缓存、revision、正式连接确认 |
| `src/host/config.js` | 扫描、环境解析、运行条件检查、连接指纹 |
| `src/host/probe.js` | 官方 MCP 单次真实连接测试 |
| `src/shared/mcp-config.js` | 浏览器和 Host 共用的格式解析、归一化 |
| `src/shared/display.js` | 脱敏、隐藏值恢复与引用识别 |
| `tests/integration/dsh.test.mjs` | 真实 DSH 临时 profile 验证 |

## 复现与交接

```sh
npm ci
npm test
npm run check
npm run build
npm run dev
```

装进 DSH 的步骤（桌面应用走插件页、CLI profile 走 `dsh plugin`、tarball 安装）见 [README 安装](../README.md#安装)；验证顺序见 [README 验证方式](../README.md#验证方式)。

真实集成测试的临时依赖准备方式见 [README 验证方式](../README.md#验证方式) 第 2 条，通过 `DSH_TEST_MODULES` 指向该依赖目录。不要依赖开发机已有的 `/tmp` 目录；新机器应重新准备依赖。

后续按 [后续任务](NEXT_TASKS.md) 的 P0 项开始，先补齐真实桌面安装验收，再扩展功能。
