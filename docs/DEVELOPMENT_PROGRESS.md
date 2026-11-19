# 开发进度

更新日期：2026-11-19（Asia/Shanghai）

> 收工状态：单测 159 项、`check`、`build`、`test:e2e`（stdio + 启动/重连边界 + HTTP + 凭证 + 删除后同名重加 + 宿主重启恢复 + 删除后重新导入 / 外部配置变更 / 并发保存 / 验证中关闭 / 卸载 + 非法端点快速失败，38 步）、`test:registry`（本地假 Registry 的分页 / 详情 / 失败边界，7 步）、`test:oauth`（本地假授权服务器的授权 / 刷新 / 重启 / 清理，8 步）、`test:simulated`（假 HOME + 九种客户端写法 + 各种密钥）、`test:ui`（页面主流程，23 步）、`test:layout`（浅色/深色/窄窗口）、`test:tarball`、`test:remote`（DeepWiki）、`test:real-sources`（本机真实 Codex / Claude Code 文件）全部通过；桌面实例已 link 安装并完成两轮验收，人工项已确认。CI 基础流水线与端到端作业已接入，`checks` 的 Windows runner 已真机跑绿并改为阻塞；启停后的验证结论已能刷新；密钥已统一写入 DSH 凭证服务，配置只保留引用；远程服务已支持 OAuth 登录（发现、DCR、PKCE、刷新）；删除后清理期的同名重加不再误报重名；页面剩余分支（表单补全变量、重命名引用行、失败后重测）已补齐；来源兼容矩阵用真实 Claude Code / Codex 样本建立；模拟来源功能验收覆盖了本机没装的客户端；桌面人工项整理成清单。下一步是清单里的桌面验收与其余来源的真实文件，见 [后续任务](NEXT_TASKS.md#下一次开发的建议顺序)。

## 当前版本与状态

- 首个正式版本号统一为 **0.1.0**；OAuth 发布版本为 **0.2.0**；开发期间的本地临时版本号不计入正式发布历史。
- 当前交付为 DSH 插件源码、可构建的浏览器模块、本地预览、测试及安装打包流程。
- 已创建 `v0.1.0` Release 并向插件市场提交收录 PR（awesome-dsh-plugin #16848，等待维护者合并）；尚未发布到 npm（同名包被占位）。Git 提交由本地完成，push 由仓库维护者执行。
- 功能重点为「已添加」「本地导入」「在线搜索」与远程服务的 OAuth 登录；在线搜索只接官方 MCP Registry，选择后预填编辑页，不静默安装。
- 桌面 `desktop` profile 已用 link 方式安装：`~/.dsh/profiles/desktop/package.json` 里 `dsh-mcp-hub` 指向本仓库，bundles 也含它；两轮验收见下文。重启恢复、凭证缺失拒绝与官方 Manager 行边界已转成自动化；桌面注入的主题变量、窄窗口观感与凭证缺失时的界面文案已由维护者人工确认。

## 发布 0.2.0

- `package.json` 升到 **0.2.0**；README / README.en 版本改为 0.2.x，后续任务与计划基线同步。
- 发布产物放在仓库内 `release/`（已加入 `.gitignore`）：`dsh-mcp-hub.tgz`（28 个文件，含 `lib/client.js`）、`pack.json` 与 `notes-0.2.0.md`，校验脚本通过。
- 待办：打 tag `v0.2.0`、创建 GitHub Release 并上传 `dsh-mcp-hub.tgz`；市场条目沿用同一 tarball 地址，用户端通过 Update 升级。

## 本轮（2026-11-19）：OAuth 协议核心

远程 MCP 服务的 OAuth 登录从方案验证推进到可用实现，范围是「发现 → 动态注册 → PKCE → 回调 → 换 token → 写凭证 → 自动重连 → 刷新 → 删除清理」。

- 新增 `src/host/oauth.js`：PRM（RFC 9728）与 AS metadata（RFC 8414 / OIDC）发现、DCR（RFC 7591）、PKCE S256、loopback 回调、授权码与 refresh 交换、grant 归一化。
- `src/host/service.js`：OAuth 行标记与状态（`needs-auth` / `authorizing` / `authorized` / `refreshing` / `failed`）、保存时不空等验证、`oauth-start` / `oauth-status` / `oauth-cancel`、按 60 秒 ticker 刷新到期前 120 秒的令牌、启动时从 grant 恢复、删除时清理记录与引用；新增 3 条路由（共 19 条）。
- `src/host/config.js`：preflight 支持 `deferredCredentials`，允许 OAuth 行保存时把「尚未写入的引用」视为可接受，并给出「OAuth 授权后写入」的检查说明。
- `src/client/App.jsx`：编辑页增加「认证方式」（访问令牌 / OAuth 登录），列表行在待授权时显示「授权」，授权中的提示与「重新打开授权页 / 取消授权」都在该行内，可同时授权多个；切回令牌模式保存会清除 OAuth 标记。
- 测试：`tests/oauth.test.mjs` 11 项（键名、PKCE、发现、DCR、换 token、refresh、grant 记录、回调、系统浏览器启动命令与失败兜底）；`tests/e2e/oauth.e2e.mjs` 8 步，用本地假授权服务器走真实 Host，覆盖保存、授权、连接、重启免重授权、临近过期刷新、删除清理、未知服务 404。
- 修复：grant payload 里的 `clientSecret: undefined` 让凭据记录无法 JSON 序列化；改为提交前做一次 JSON 往返。未知服务的 `oauth-start` 从 403 改为 404。

验证：单测 **159**、`check`、`build`、`test:e2e` 38 步、`test:registry` 7 步、`test:oauth` 8 步、`test:ui` 23 步（`DSH_E2E_PORT=3207` 避开桌面占用的 3080）、`test:simulated`、`test:layout`、打包 28 文件。真实 Notion 账号验收仍留在桌面清单。

## 本轮（2026-11-19 第四段）：P0 收尾

这一轮处理 P0 清单：Windows 单元测试、永久性连接错误、Registry 边界与文档状态。

| 位置 | 处理 |
| --- | --- |
| `tests/sources.test.mjs` | XDG 路径断言从 `/` 改为 `[\\/]`。原断言在 Windows 反斜杠路径上必然失败，是 Windows job 红灯的首要嫌疑；其余路径断言逐条核对后无平台假设。 |
| `src/host/service.js` | 新增 `DEAD_ENDPOINT`（`bad port`、非法 URL、`ENOTFOUND` / `EAI_NONAME`）。这类失败重试不会变好，验证在 `reconnecting` 阶段直接结算为 `failed`，detail「连接地址不可用：…」；协议不匹配仍走常规重试。 |
| `tests/service.test.mjs` | 新增非法端点用例：`bad port` 与 `getaddrinfo ENOTFOUND missing.invalid` 都要求立即失败而不是耗完重试预算。总单测 147 → **148**。 |
| `tests/e2e/web-profile.e2e.mjs` | 新增 `dead-endpoint` 步：保存 `http://127.0.0.1:1/mcp`，断言 8 秒内结算为 `failed` 且 detail 可读；随后清理。`test:e2e` 37 → **38 步**。 |
| `tests/e2e/registry.e2e.mjs`（新增） | 本地 `createServer` 假 Registry，通过临时 profile 的 `cordis.patch.yml` 覆盖 `catalogBaseUrl` / `catalogTimeoutMs` / `catalogCacheMs`。覆盖两页搜索、下架过滤、未知字段、详情转换与密钥提示、HTTP 500、坏 JSON、超时、连接不上，共 7 步。 |
| `package.json` / `.github/workflows/ci.yml` | 新增 `test:registry`；端到端作业在 `test:e2e` 之后串行跑它（同样 `DSH_E2E_REQUIRED=1`）。 |
| `docs/NEXT_TASKS.md` / `docs/DESKTOP_ACCEPTANCE.md` | r10：P0-1 标完成（维护者已人工复核 1–3、5–6 组），P0-3 的连接错误口径关闭，P2 的 Registry 边界关闭；基线改为 148 项 / 38 步 / 7 步。 |

验证：`npm test` 148 项、`npm run check`、`npm run build`、`npm run test:e2e`（38 步）、`npm run test:registry`（7 步）全部通过；Windows job 在 `aceb0ec` 上真机跑绿，`continue-on-error` 已移除。

## 本轮（2026-11-19 第三段）：文档分层与测试说明

这一轮不改功能，只把文档从「实现笔记式 README」整理成「对外介绍 + 使用说明 + 开发文档」三层，并补上测试目录的入口文档。

| 位置 | 处理 |
| --- | --- |
| `README.md` | 重写为对外首页：定位、功能列表、三种安装方式、装好后确认、兼容性与边界、文档索引；详细规则不再堆在首页（238 → 133 行）。 |
| `docs/USAGE.md`（新增） | 承接原 README 的导入与验证、来源路径表、密钥与凭证、在线搜索、编辑规则、配置项、已知边界。 |
| `docs/README.md`（新增） | 文档索引：用户文档 / 开发文档 / 历史记录，标注哪些持续更新、哪些是快照，附维护约定。 |
| `tests/README.md`（新增） | 测试分层表、9 个单测文件各自的覆盖点、集成与 8 个 e2e 脚本的阶段说明、环境变量、建议顺序、常见问题与写测试约定。 |
| `src/client/i18n.js` | 删除撤销入口移除后不再使用的词条与正则（`关闭撤销提示`、`撤销`、`没有可撤销的服务`、`已撤销 N 个…`、`已添加 N 个服务` 正则）；`i18n.test.mjs` 改用仍在使用的动态消息做断言。 |
| `package.json` | 补 `repository` / `homepage` / `bugs`，description 改为面向用户的一句话。 |
| 计数 | 打包清单在加入英文 README（`README.en.md`）后为 **27 个文件**；单测仍 147 项。 |

验证：`npm test` 147 项、`npm run check`、`npm run build`、`scripts/assert-pack.mjs`（27 个文件）通过；README / USAGE / docs 索引 / tests 说明的相对链接全部检查过。

## 本轮（2026-11-19 第二段）：P0-5 四类边界与可选真实链路

这一轮补完「删除后重新导入、外部配置变更、连续操作、测试期间关闭 / 卸载」，并把打包安装、真实公网 MCP、真实客户端文件做成显式开启的验收脚本。真实桌面 GUI 的观感仍只能人工确认。

| 位置 | 处理 |
| --- | --- |
| `src/host/service.js` | `init()` 末尾把磁盘上残留的 `state:'verifying'` 结算为 `failed`，detail「验证被中断：DSH 在验证过程中关闭，请重新验证」并落盘，避免崩溃后永远转圈。注意：正常结算只写 `finishVerification` 的结果，`startVerification` 本身不落盘，所以这条主要是防御；强杀时更常见的是「没有结论」。 |
| `tests/service.test.mjs` | 新增「a verification interrupted by a Host shutdown is settled instead of staying verifying」：临时 metaPath 写入 `verifying` → `init()` → 行结论为 `failed` 且重新落盘。总单测 146 → **147**。 |
| `tests/e2e/web-profile.e2e.mjs` | 新增阶段 4（删除后重新导入、外部 `cordis.patch.yml` 热加载 / 恢复、同一 revision 并发三写）与阶段 5（慢验证中停 Host、`plugin remove` 后 404）；`test:e2e` 31 → **37 步**。两处产品口径在此确认：外部手改落在 Manager 宿主层，按不可编辑 / 不可删除的宿主行展示；强杀后验证结论可能为空，但绝不伪报成功。 |
| `tests/e2e/support/profile.mjs` | `createProfile({ install })` 允许建空 profile（tarball 验收要从包安装）；`bootProfile({ probe })` 允许跳过启动探测（卸载后 `/servers` 已 404）。 |
| `tests/e2e/tarball.e2e.mjs` | `npm run test:tarball`：构建 → `npm pack` → 装进全新 profile → 核对打包清单（本次 27 个文件）、`lib/client.js`、插件层、`/servers` 与 `/status` 可用。修了 npm 11 `pack --json` 返回「包名 → 信息」对象而不是数组的兼容问题。 |
| `tests/e2e/real-remote.e2e.mjs` | `DSH_E2E_REMOTE=1 npm run test:remote`：真实 DeepWiki（`https://mcp.deepwiki.com/mcp`）测试连接、保存、验证、工具发现。实测 516ms、3 个工具。 |
| `tests/e2e/real-sources.e2e.mjs` | `DSH_E2E_REAL_SOURCES=1 npm run test:real-sources`：扫描本机真实客户端配置。插件固定按真实 home 扫描，与 `DSH_HOME` 无关。实测 Codex `.codex/config.toml` 2 个服务、Claude Code `.claude.json` 可读。 |
| `README.md` / `docs/NEXT_TASKS.md` / 本文 | 补阶段 3/4/5 与三个可选脚本说明，基线改为 147 项 / 37 步；NEXT_TASKS 改为 r9，并把「验证结论只在结算时落盘」记为已知边界。 |

验证：`npm test` 147 项、`npm run check`、`npm run build`、`npm run test:e2e`（37 步）、`npm run test:ui`（23 步）、`npm run test:simulated`（16 步）、`npm run test:layout`（4 张截图）、`npm run test:tarball`、`DSH_E2E_REMOTE=1 npm run test:remote`、`DSH_E2E_REAL_SOURCES=1 npm run test:real-sources` 全部通过；`npm pack --dry-run` 为 27 个文件（含新增英文 README）。

## 本轮（2026-11-19）：Windows 命令探测、宿主重启恢复与边界自动化

这一轮把「文档宣称支持、实际会在 Windows 上挡住保存」的差距补上，并把只能在桌面实例上点的几项改成可重复用例。

| 位置 | 处理 |
| --- | --- |
| `src/host/config.js` | 新增 `envValue`（PATH / PATHEXT 大小写不敏感）与 `commandPaths`：Windows 上命令没有扩展名时按 PATHEXT 追加 `.COM/.EXE/.BAT/.CMD`（缺 PATHEXT 时用默认顺序），绝对命令也先试扩展名；`preflight` 增加可注入的 `platform`，不再直接读 `process.platform`。修的是 `npx`、`uvx` 实际是 `.cmd` 却被判「PATH 中找不到可执行命令」的问题。 |
| `tests/config.test.mjs` | 新增 5 项：PATHEXT 解析 `.cmd`、缺 PATHEXT 时默认先 `.COM` 再 `.EXE`、已有扩展名不重复探测、非 Windows 保持精确匹配；原两条依赖 POSIX 路径的用例显式 `platform:'linux'` 并改用 `join` 断言。 |
| `tests/service.test.mjs` | 新增 3 项：没有挂载 `credentials` 服务时保存明文密钥拒绝 `CREDENTIAL_UNAVAILABLE` 且零写入；`reveal` 同样拒绝；插件行 / 继承行 / 清理行 / 自有行的 `managed`、`editable`、`removable`、`source` 与 `NOT_WRITABLE` / `INHERITED_ROW` 口径。 |
| `tests/e2e/web-profile.e2e.mjs` | 新增阶段 3（5 步）：已连接条目 + 认证失败条目 + 手动导入来源 → 停掉真实 Host → 用同一 profile 重启 → 断言条目重新 `connected`、工具重新注册、失败结论与原因文本不变、`sources.json` 里的 `file-` 来源及候选仍在，最后清理。修了同文件一个断言 bug：错误响应字段是 `error` 而不是 `message`，只有走到「清理中」分支才会暴露。另外记录一个产品口径待定项：`127.0.0.1:1` 的 bad port 被判成可重试，验证停在「重试中」而不是快速失败（已写入后续任务）。 |
| `.github/workflows/ci.yml` | `checks` 改为 `ubuntu-latest` + `windows-latest` 矩阵，Windows 先 `continue-on-error`（报告模式，避免历史假设直接染红 main）；job 级 `shell: bash`，打包清单 artifact 按系统命名。 |
| `tests/integration/dsh.test.mjs` | 缺 `DSH_TEST_MODULES` 时不再写死版本；能从 `@deepseek-ai/dsh-app-boot` 读出版本时按 engines 范围校验，不符报出实际版本。 |
| `README.md` / `docs/NEXT_TASKS.md` / 本文 | 基线版本改为 0.2.2-rc.5，单测 139→146、`test:e2e` 26→30、打包清单 23→24 统一；补充 Windows CI 报告模式的说明。 |

验证：`npm test` 146 项、`npm run check`、`npm run build`、`npm run test:e2e`（31 步）、`npm run test:ui`（23 步）、`npm run test:simulated`（16 步）、`npm run test:layout`（4 张截图）全部通过。

## 本轮（2026-11-18）：用假 HOME 跑通的「各客户端 + 各种密钥」功能验收

维护者的机器上只有少量 MCP 服务和部分客户端，真实样本有限。这一轮补的是**功能**：造一台「装了九种客户端、各种密钥写法都有」的假机器，用真实 Host 跑完整链路，而不是只验证解析。

| 位置 | 处理 |
| --- | --- |
| `tests/e2e/support/simulated-home.mjs`（新增） | 按各应用真实路径生成配置：Claude Code（项目级 + 顶层）、Claude Desktop（明文密钥 / 停用项）、Codex（Bearer 环境变量 / `env_http_headers` / `env_vars` / 相对命令）、OpenCode（JSONC + 单花括号引用）、Gemini（`httpUrl` + 单位不明的 `timeout`/`trust`）、VS Code（`envFile` + 缺变量）、Copilot CLI、Windsurf、Cursor（明文密钥）。所有 stdio 条目都指向受控 echo 服务，导入后能真连上。 |
| `tests/e2e/simulated-sources.e2e.mjs`（新增，`npm run test:simulated`） | 把假 HOME 交给真实 Host（`HOME=<假目录>`，`DSH_HOME` 仍是临时 profile），依次验证：九个来源与 15 个候选被扫描到；明文密钥与 `${env:X}` / `${X}` 都解析成真实值写入 DSH 凭证，配置只剩 `${credential:MCPHUB_…}`，列表接口不泄漏明文，`reveal` 能读回；Codex 的 Bearer 与 `env_http_headers` 落成引用、`env_vars` 变成 `MCPHUB_SHARED_TOKEN_2`（已被别的服务占用，按共享规则 fork）而普通变量 `SIM_MODE` 保持明文；跨来源的同一连接被认成重复；缺变量与相对命令被拒且零写入；其余五个来源导入并连上；导出默认不含密钥、勾选后内联；九个来源文件哈希前后一致（没有被写回）；删除后提示已无引用的凭证。 |
| `src/host/service.js`：重复识别 | 真实缺陷：同一个服务在一个应用里写成 `${env:DOCS_TOKEN}`、在另一个应用里已经存成 `${credential:MCPHUB_DOCS_TOKEN}` 时，指纹按模板文本算，判成两个服务，导入列表不会显示「已添加」。现在按**解析后的连接身份**比较（凭证与 `env:` 引用都解析成真实值再哈希，解析不到就保留模板，宁可不合并），明文、模板、已存凭证三种写法都能对上，token 不同仍算两个连接。 |
| `src/client/App.jsx` | 来源分组的标题按钮补 `aria-label={source.name}`、候选的「添加」按钮补 `aria-label={'添加 ' + name}`：既方便读屏，也让页面验收能精确点到某一条候选。 |
| `tests/e2e/ui-page.e2e.mjs` | 页面层也改用假 HOME（23 步）：`本地导入` 页签要显示各应用分组与计数（Claude Desktop「2 项配置」），并能直接从候选导入一条带明文密钥的服务，提示「密钥已写入 DSH 凭证」且行内连上。 |
| `tests/service.test.mjs` | 新增 1 项：同一 token 的三种写法（`${env:…}`、已存凭证、明文）都判为同一连接，换 token 后不再判重复。 |
| `.github/workflows/ci.yml` | 自托管 runner 上增加 `test:simulated`，与另外两条端到端、布局验收串行跑。 |

验证：`npm test` 139 项、`npm run check`、`npm run build`、`npm run test:e2e`（26 步）、`npm run test:simulated`（16 步）、`npm run test:ui`（23 步）、`npm run test:layout`（4 张截图）全部通过。

## 本轮（2026-11-18）：来源兼容矩阵与布局验收

用**本机真实存在**的配置文件反推扫描规则，顺手抓到两个只有真实样本才会暴露的问题，再把「看页面」的那部分布局检查自动化。

| 位置 | 处理 |
| --- | --- |
| `tests/fixtures/sources/`（新增，8 个样本 + README） | Claude Code（2.1.71）与 Codex CLI（0.125.0）的样本取自本机真实文件，结构、字段名与真实一致，路径/名称/取值全部替换；Claude Desktop 本机文件没有 MCP 服务，其余（OpenCode / Gemini / VS Code / Windsurf / Copilot）按文档整理。README 逐条标注了「真实抓取」还是「按文档整理」，不用一种口径冒充另一种。 |
| `src/shared/mcp-config.js`：空服务列表 | 真实 `~/.claude.json` 写的是 `"mcpServers": []`。此前 `extract()` 把空数组当成「未找到有效的 MCP 配置列表」抛错，整个来源会显示成「无法读取或解析配置」。现在空数组/空对象都返回 0 个服务。 |
| `src/shared/mcp-config.js`：Codex `env_vars` | 真实 `~/.codex/config.toml` 用 `env_vars = ["BROWSER_USE_ACCESS_PIPE_PATH", …]` 表示「从宿主环境转发这些变量」。此前它是个未知字段，导入时会要求用户核对且变量丢失；现在迁移成 `NAME: ${env:NAME}` 引用，值仍由环境/凭证服务在连接时提供，显式 `[mcp_servers.x.env]` 的值优先。 |
| `src/shared/mcp-config.js`：env 形状 | 合入 `env_vars` 时先把 `env` 展开成对象，一度让 `env: ['bad']` 这种坏形状变成 `{0:'bad'}` 并被静默接受；已改回「形状不对就交给 `assertEntryShape` 报错」，并由单测守住。 |
| `tests/sources.test.mjs`（新增，10 项） | 样本摆进临时 HOME 走真实扫描：Claude Code 项目级服务与 SSE 不支持提示、Codex 相对命令/`env_vars`/Bearer/`env_http_headers`/`CODEX_HOME`、Claude Desktop 停用项、OpenCode JSONC 与路径覆盖、Gemini 的 `timeout`/`trust` 待核对、VS Code 的 `envFile`、Windsurf/Copilot/Cursor 解析、同名不同配置与相同 URL 不同认证的判定、相对命令/相对参数/空 PATH 的提示。 |
| `tests/e2e/ui-layout.e2e.mjs`（新增）+ `npm run test:layout` + CI | 真实插件页面上截浅色 / 深色 / 700px 窄窗口 / 窄窗口编辑窗口四张图到 `tests/e2e/artifacts/layout-*.png`，并断言页面无横向溢出、编辑窗口不超出视口、深浅色真换了底色。自动化的只有插件自带的回退配色与布局；桌面注入的 `--dsw-alias-*` 主题变量仍要人工看。 |
| `docs/DESKTOP_ACCEPTANCE.md`（新增） | P0-1 剩余人工项拆成可勾选清单：主题与窄窗口、重启恢复、凭证缺失、凭证服务不可用（需开发辅助）、与官方 Manager / 插件注册 / 继承配置的边界、删除清理；附记录模板和失败时要附的证据。 |
| `tests/config.test.mjs` | 新增 2 项：空服务列表不算解析失败；`env_vars` 迁移与坏形状的待核对提示。 |

验证：`npm test` 138 项、`npm run check`、`npm run build`、`npm run test:e2e`（26 步）、`npm run test:ui`（21 步）、`npm run test:layout`（4 张截图）全部通过。

## 本轮（2026-11-18）：页面剩余分支与「不做草稿」的决定

维护者决定不做新建草稿：缺变量或凭证就让用户填好再保存，不引入与官方 Manager 实际接受内容不一致的草稿存储。据此把 P0-5 剩下的页面分支补齐，并顺手修掉一处前后不一致的文案来源。

| 位置 | 处理 |
| --- | --- |
| `src/client/App.jsx`（`Pairs`） | 缺引用的行不再只报一句「找不到引用」：给出「直接填写」入口，点一下把该行换成空值并聚焦输入框，填完直接再测；凭证引用被换成具体值时提示「改成具体值会写入 DSH 凭证」（原文案还写着「按明文保存」，与凭证化后的行为不符） |
| `src/host/config.js`（`variableInfo`） | 缺失变量名统一去掉 `env:` 前缀：此前检查结果报 `MCP_E2E_MISSING`，行内提示却报 `env:MCP_E2E_MISSING`，像是要填一个叫 `env:X` 的变量 |
| `src/client/i18n.js` | 「直接填写」入口与新提示补英文；修正上面那条不符的文案 |
| `tests/e2e/ui-page.e2e.mjs` | 新增 3 步（16 → 21 步）：表单里 `$&#123;env:MCP_E2E_MISSING&#125;` 找不到值时「直接填写」→ 重测通过 → 添加；编辑该服务把环境变量名改掉后，凭证引用仍然只读且原样保留；测试失败后改配置直接重测通过并添加；收尾删掉新增的两行 |
| `tests/service.test.mjs` | 新增 1 项：首次连接超过 15 秒仍未连上时，等待文案换成「首次运行可能需要下载依赖」而不是一直「正在连接…」 |
| `tests/config.test.mjs`、`tests/i18n.test.mjs` | 跟着改断言：缺失变量名不带前缀；两条新提示有英文 |

页面层没有再加一次 16 秒的慢启动步骤：那条提示是 Host 侧 `evaluateVerification` 的文案选择，单测能精确覆盖，端到端再跑一遍只是让 CI 多等 30 秒。

验证：`npm test` 126 项、`npm run check`、`npm run build`、`npm run test:e2e`（26 步）、`npm run test:ui`（21 步）全部通过。

## 本轮（2026-11-18）：删除后清理期的同名重加

用户视角的问题是：删掉一个服务后马上用同一个名字重新添加，界面在名称框就提示「已存在同名服务」，Host 也回 `NAME_TAKEN`「已有同名服务器，请修改名称」。核对官方 `@deepseek-ai/dsh-mcp-manager` 源码后确认这不是重名：

- `list()` 的条目来自 `配置键 ∪ instances`；`unmount()` 只有清理失败（`closeConfirmed === false` 或有 `cleanupError`）时才把实例留在 `instances` 里，否则 dispose 一结束就删除。
- 所以「已删除，清理中」这一行是「配置里已经没有、实例还没退完」的过渡状态：正常删除持续几十到几百毫秒，清理失败时留到宿主重启。

| 位置 | 处理 |
| --- | --- |
| `src/host/service.js` 保存分支 | 重名判断拆成两档：配置里已有或存在 `configured !== false` 的运行中条目 → `NAME_TAKEN`；只剩 `configured === false` 的清理行 → 新的 `NAME_CLEANING`，提示里带上官方清理失败原因和「重启 DSH」的出路（`cleaningMessage()`） |
| `src/host/service.js` 批量导入 | 清理中的同名不再被当成「已存在」静默跳过（那会让人以为已经添加过），改为整批拒绝并给 `NAME_CLEANING`，零写入 |
| `src/shared/errors.js` | `NAME_CLEANING: 409` |
| `src/shared/servers.js`（新增） | `takenNames()` 让编辑器不再把 `cleanup` 行算作已占用名称；`retryWhileCleaning()` 在保存 / 批量添加遇到 `NAME_CLEANING` 时短暂重试（6 次 × 350ms），用户不必为几百毫秒的清理再点一次保存 |
| `src/client/App.jsx` | 编辑器 `existing` 改用 `takenNames()`；表单保存、JSON 编辑保存、批量添加三处写入包上 `retryWhileCleaning()` |
| `tests/service.test.mjs` | 新增 3 项：清理期的同名重加报 `NAME_CLEANING` 且清理行消失后同名可添加、运行中的同名仍报 `NAME_TAKEN`、批量导入遇到清理行整批不写 |
| `tests/servers.test.mjs`（新增） | 4 项：`cleanup` 行不占用名字、`NAME_CLEANING` 会被重试、其他错误不重试、重试用尽后抛出 Host 原文 |
| `tests/e2e/web-profile.e2e.mjs` | 新增 2 步：运行中的同名保存仍判 `NAME_TAKEN`（确认放宽的只有清理行）；删除后立刻同名重新添加，只允许 `NAME_CLEANING`/`REVISION_CONFLICT` 后重试成功，并记录是否真的撞上清理窗口 |

未做：清理失败后「永久残留」的行只能重启 DSH 清除，这条路径没有自动化（官方 `closeTimeoutMs` 在本机实测不生效，无法稳定制造保留行），目前由单测覆盖结论与文案。

验证：`npm test` 125 项、`npm run check`、`npm run build`、`npm run test:e2e`（26 步）、`npm run test:ui`（16 步）全部通过。

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
| 打包内容没有自动断言 | 只有人工检查过 tarball | 新增 `scripts/assert-pack.mjs`，用 `npm pack --dry-run --json --ignore-scripts` 的清单断言必需文件齐全、复审报告不进包（当前 24 个文件） |

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

验证：`npm test`、`npm run check`、`npm run build`、`npm run test:e2e`、`npm run test:ui`（16 步）全部通过。

## 本轮（2026-11-18）：密钥统一写入 DSH 凭证服务

用户反馈「有环境变量 key 的 MCP 配置还要手动改底层文件，不符合简单操作」。现在保存时不再把密钥写进配置：明文、`${env:X}` 引用、启动参数与 URL 里的 token 都会先解析，再写入 DSH 凭证服务，配置里只保留 `${credential:MCPHUB_…}` 引用。

| 位置 | 处理 |
| --- | --- |
| `src/host/vault.js`（新增） | 识别 env / headers / args / URL 里的明文与 `${env:X}` 引用；按 `MCPHUB_<服务>_<字段>` 生成名称（`Authorization`→`TOKEN`、`X-Api-Key`→`API_KEY`）；重名自动加 `_2` 后缀；只有本服务独占的名字允许原地轮换，其他情况一律新建，绝不覆盖别人的值；`commitCredentials` 记录 undo，写入失败按逆序回滚 |
| `src/host/service.js` 保存路径 | `planCredentials` → `preflight` → `commitCredentials` → `write`；写配置失败时回滚已写入的凭证；返回 `credentials`（stored/reused/missing）与 `cleanup`（替换后已无引用的旧名） |
| `src/host/service.js` 批量导入 | 每一行先 plan + preflight，全部通过后合并 writes 一次提交；写失败整批回滚 |
| `reveal` / `exportBackup` | 都改为异步：`reveal` 通过凭证服务解析引用（不再只能读遮蔽值）；导出含密钥时把引用解析为明文，未配置的凭证名记入 `credentialsMissing`；不含密钥时保留引用模板 |
| `src/client/App.jsx` + `i18n.js` | 保存/导入成功后内联提示「已写入 DSH 凭证：…」，不弹窗；导出选项说明区分「保留引用」与「解析为明文」；导出时提示未配置的凭证数量 |
| 配置项 | `referenceStorage` 标记废弃，仅为兼容旧 profile 保留 |
| `tests/service.test.mjs` | fixture 增加凭证服务替身（内存 Map）；新增 11 项：明文 header/env 入库、他服务占用名字加后缀、独占轮换、共享不覆盖、用户自定名保持、reveal 解析与缺失报错、导出含/不含密钥、draft 缺变量、args 与 URL 查询参数凭证化、批量导入同一环境变量各存一份（单测 106 → 117） |

- 查看与更换：凭证引用的「显示」改为就地切只读明文（10 秒倒计时、同一时间只一行、Esc/再点收回），新增「复制」和「编辑密钥」；编辑密钥把该行就地切成输入框，先带新值做一次真实连接测试，通过后才写入草稿（失败保留原值并就地提示原因），保存时复用 `planCredentials`（独占原地轮换、共享自动 fork），不新增 Host 接口。
验证：`npm test` 117 项、`npm run check`、`npm run build`、`npm run test:e2e`、`npm run test:ui` 全部通过。

## 本轮（2026-11-18）：慢启动、慢工具发现与重连退避

这一轮专门验证「真实环境第一次用」的边界：本地 echo fixture 一直秒连，掩盖了下载依赖、网络慢、进程中途退出这几类问题。现在 `tests/manual/echo-server.mjs` 支持用环境变量制造这些场景，`test:e2e` 增加了阶段 1.5。

| 位置 | 处理 |
| --- | --- |
| `tests/manual/echo-server.mjs` | 新增 `MCP_ECHO_TOOLS_DELAY`（只放慢 `tools/list`）、`MCP_ECHO_EXIT_AFTER_INIT`（握手成功后主动退出，模拟断线）、`MCP_ECHO_IGNORE_SIGTERM` / `MCP_ECHO_PID_FILE`（清理排查用） |
| `tests/e2e/web-profile.e2e.mjs` | 新增三步：慢握手 2.5 秒（验证耗时 7.7 秒仍成功）、慢工具发现 2 秒（验证耗时 2.2 秒）、连上后退出（进入 `reconnecting`，`attempt 1/10`，随后停用清理） |
| `src/host/service.js` | 首次连接（尚无成功验证记录）给两倍等待预算，避免首次 `npx` 下载依赖时被 45 秒默认值误杀；连接超过 15 秒仍停在「正在连接」时，提示「首次运行可能需要下载依赖或等待网络」 |
| `src/client/App.jsx` | 清理未完成的行在状态行直接显示「清理未完成：<原因>；重启 DSH 后会清除」，不再只有「已删除，清理中」的徽标 |

验证：`npm test` 118 项（新增 1 项首次连接预算）、`npm run check`、`npm run build`、`npm run test:e2e`（23 步）、`npm run test:ui`（16 步）全部通过。

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
| 撤销本批 | 服务端保留 `undo-import`（只删除该批仍未被修改的服务，改名/改配置的条目跳过）；页面原先的 20 秒撤销入口因实际不可用，已按反馈移除，改为普通结果提示 |

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
4. `${NAME}`、`${env:NAME}`、`{env:NAME}` 在保存时先解析值、再写入 DSH 凭证服务，配置里改写成 `${credential:MCPHUB_<服务>_<字段>}`；已有 `${credential:NAME}` 保持原名。引用本身不等于已配置密钥。
5. 配置里不写密钥明文：真实的取值只发生在测试连接/`reveal`/导出时；`referenceStorage` 已废弃，配置为 `value` 也不再写明文。
6. 导入、持久化、连接、工具注册是不同阶段。正式实例已连接且注册工具数一致才报告启用保存成功；停用保存不表示已验证可用。
7. 不通过调用业务工具来测试权限，不对写入或删除类工具执行探测。
8. 插件注册服务只读，继承配置只能停用；静态 mcp-client 和 Agent preset 不属于官方 Manager 的完整管理范围。
9. 不做新建草稿（2026-11-18 维护者决定）：缺变量或凭证时就要求用户先填好再保存，不引入与 Manager 实际接受内容不一致的草稿存储；已停用条目的编辑仍沿用 `mode: 'draft'`。

## 已验证范围与边界

| 验证方式 | 结果与覆盖范围 |
| --- | --- |
| `npm test` | 159 项通过：格式解析、高德配置回归、env 缺失与凭据判定、脱敏、重复判断、版本冲突、旧连接误判、工具注册等待、真实非 MCP 程序拒绝、密钥写入凭证服务与名称生成/冲突/独占轮换、reveal 与导出解析、硬约束与错误 code、项目级导入、坏条目容错、验证结果持久化、启停后重新验证、推送通道、复诊、备份占位符、删除后清理期的同名重加与重试（`NAME_CLEANING`）、首次连接的「可能在下载依赖」提示、缺失变量名不带 `env:` 前缀、Windows 命令 PATHEXT 探测、无凭证服务时的拒绝与 Manager 行边界、验证中断态结算、非法端点快速失败、OAuth 键名/PKCE/发现/DCR/换 token/刷新/回调、来源兼容矩阵（真实 Claude Code / Codex 样本、空服务列表、`env_vars` 转发、相对命令与空 PATH）、跨来源重复识别等 |
| `npm run check` | Host JavaScript 语法检查通过 |
| `npm run build` | 插件浏览器模块及独立预览构建通过 |
| `npm run test:e2e` | 通过：临时 `DSH_HOME` + `web` 模板 profile，真实 `/api/dsh-mcp-hub/*` 路由跑完 stdio 全链路（列表、扫描、测试、添加、验证、工具、启停、重启、删除）、启动/重连边界（2.5 秒慢握手、2 秒慢工具发现、握手后退出进入重连退避）与 Streamable HTTP 全链路（静态 Bearer、凭证模板、凭证轮换重连、错误 token 判为需要认证、非法端口在 8 秒内判为连接地址不可用）；阶段 3 宿主重启恢复，阶段 4 删除后重新导入 / 外部配置热加载 / 并发三写，阶段 5 验证中停 Host 与卸载后 404；删除后等官方清理行消失、删除后立刻同名重加（运行中的同名仍判 `NAME_TAKEN`）；不写用户 profile |
| `npm run test:ui` | 通过（23 步）：无头 Chrome 在临时 profile 上点完设置页 —— 导航到 MCP Hub、空状态、导入页签、JSON 粘贴逐行测试、一次添加两个并显示已连接、重名跳过、测试进度与取消、连接失败原因、缺失环境变量、编辑已有服务、保存后关闭、删除弹窗与删后空状态、页签切换草稿保留、表单里缺引用时「直接填写」补全并重测通过、重命名凭证引用行保持引用、测试失败后改配置重测通过、假 HOME 的来源分组与从候选导入带密钥的服务；失败留截图 |
| `npm run test:simulated` | 通过：假 HOME 里九个客户端的配置（明文 / `${env:X}` / `${X}` / `{env:X}` / Bearer 环境变量 / env 请求头 / env_vars / 停用项 / 未知字段 / 缺变量 / 相对命令）走真实 Host 扫描并逐个导入：密钥写入 DSH 凭证、配置只留引用、真连接注册工具、跨来源重复识别、导出与来源文件不被改写 |
| `npm run test:registry` | 通过（7 步）：本地假 Registry 覆盖分页与 `nextCursor`、下架过滤、未知字段、详情转换与密钥提示、HTTP 500、坏 JSON、超时、连接不上；不依赖外网 |
| `npm run test:layout` | 通过：真实插件页面在临时 profile 里截浅色 / 深色 / 700px 窄窗口 / 窄窗口编辑窗口，断言无横向溢出、编辑窗口不超出视口、深浅色底色不同（覆盖插件回退配色；DSH 主题变量仍需桌面人工看） |
| `node scripts/assert-pack.mjs` | 通过：`npm pack --dry-run --json --ignore-scripts` 的清单含 28 个文件，Host / 共享模块 / 浏览器模块 / 样式 / patch / locale / icon / 文档 / LICENSE 齐全，复审报告未进包 |
| CI | 已接入 `.github/workflows/ci.yml`：基础作业公开 runner 可跑；端到端作业需自托管 runner（`DSH_E2E_RUNNER=true` + `dsh` 标签），CI 内 `DSH_E2E_REQUIRED=1` 禁止 SKIP |
| `npm run test:integration` | 1 项真实集成测试通过：官方 DSH 0.2.2 系（当次 rc.3；现在按实际版本校验）临时 profile 中，测试不持久化、保存持久化、连接、工具注册、显式读取、重复判断、停用、停用编辑和删除 |
| 桌面实机验收 | 两轮均通过：安装、挂载、列表、测试、添加与验证、工具、启停、删除；重启缺陷已修；2026-11-19 维护者确认主题 / 窄窗、凭证文案、官方 Manager 边界与删除清理 |
| 浏览器验收 | 预览中验证 JSON 自动识别、env 引用显示与缺失提示、删除弹窗、删除后重新导入、保存关闭、Toast 消失和深浅色布局 |
| 预览 HTTP 接口 | 真实调用接口，确认可执行文件存在但不实现 MCP 时返回失败 |
| 安装包 | 已检查浏览器模块能加载，Host 与共享模块进入 tarball，并断言清单从 24 个文件起不再缩水；构建产物和 tarball 不进入 Git |

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

装进 DSH 的步骤（桌面应用走插件页、CLI profile 走 `dsh plugin`、tarball 安装）见 [README 安装](../README.md#安装)；验证顺序见 [测试说明](../tests/README.md#建议的验证顺序)。

真实集成测试的临时依赖准备方式见 [测试说明](../tests/README.md#建议的验证顺序) 第 2 条，通过 `DSH_TEST_MODULES` 指向该依赖目录。不要依赖开发机已有的 `/tmp` 目录；新机器应重新准备依赖。

后续按 [后续任务](NEXT_TASKS.md) 的 P0 项开始，先补齐真实桌面安装验收，再扩展功能。

## 本轮（2026-11-18）：密钥行内编辑，测试通过才写入

用户反馈编辑密钥弹窗是多余一步，且旋转凭证前应先确认新值可用：轮换到坏值会把原本能连的凭证弄坏。

- 去掉「编辑密钥」弹窗，点行尾铅笔图标后该行值输入框就地变为密码输入（名称、配置方式同时只读），行尾只剩「测试并保存」与「取消编辑」。
- 「测试并保存」用新值组装候选条目调用 Host 的 `/test`（真实启动连接并握手），`result.ok` 才把新值写入草稿并锁定该行，帮助行提示「新密钥已通过测试，保存后写入 DSH 凭证」；测试失败保留原引用、在行内显示服务端返回的失败原因，不触碰凭证服务。
- 行尾图标调整：铅笔（编辑密钥）替代钥匙；凭证引用行是「显示/复制/编辑/移除」，明文密钥行是「显示/编辑/移除」。
- `test:ui` 的 `credential-reveal` 改为覆盖行内输入 → 测试并保存 → 通过提示；不再断言弹窗。
- i18n 增补：测试并保存、取消编辑、输入新密钥、测试通过后才会写入、新密钥已通过测试等，移除弹窗旧词条。

验证：`npm test` 117 项、`npm run check`、`npm run build`、`npm run test:e2e`、`npm run test:ui`（16 步）全部通过。
