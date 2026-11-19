# 后续任务

更新日期：2026-11-19（Asia/Shanghai），**修订 r12**：OAuth 完成并准备 0.2.0 发布（发布产物改放仓库 `release/`，已忽略）。r11 修订内容为：完成 OAuth 协议核心——PRM / AS 发现、动态客户端注册、PKCE S256、本机回调、grant 记录、`${credential:…}` 引用与自动重连、临近过期刷新、删除清理；新增 `test:oauth`（8 步）与 `tests/oauth.test.mjs`（11 项），单测 159 项；编辑页增加认证方式，列表增加「授权」入口。r10 已收尾 P0（Windows 跨平台断言、永久性连接错误快速结算、`test:registry`）。

当前基线：**0.2.0**，DSH 0.2.2-rc.5；单测 159 项、`test:e2e` 38 步、`test:registry` 7 步、`test:oauth` 8 步、`test:ui` 23 步、`test:simulated` 16 步、`test:layout` 4 图、打包清单 28 个文件。本文是后续工作清单，不代表这些问题均已复现为故障。源码现状和验证记录见 [开发进度](DEVELOPMENT_PROGRESS.md)；认证能力与分阶段计划见 [开发计划](DEVELOPMENT_PLAN_2026-11-17.md)；安装步骤见 [README](../README.md#安装)。

## P0：优先完成真实接入验收与边界处理

### 1. 在真实 DSH 桌面 profile 安装验收

当前状态：**完成**（2026-11-19 第二轮）。第一轮（2026-11-17）已按 README 方式 A link 安装到 `desktop`，插件行挂载、设置页注册、列表、测试连接、添加 + 后台验证、工具读取、停用、启用、删除均通过；第二轮维护者人工复核了主题 / 窄窗 / 凭证文案 / 官方 Manager 边界 / 删除清理，自动化补上了重启恢复与连接错误结算。第 4 组「凭证服务未挂载」属开发辅助场景，未要求桌面自助验证。

- [x] 按 [README 安装](../README.md#安装) 完成 link 安装（插件页 → 添加插件）。
- [x] 确认设置页与 Host 路由（`/api/dsh-mcp-hub/*`；桌面页面 origin 是 `dsh-app://app`，没有可复用的 HTTP 地址）加载。
- [x] 样式与窄窗口布局（2026-11-18 自动化 + 2026-11-19 人工确认）：`npm run test:layout` 在真实插件页面上截图浅色 / 深色 / 700px 窄窗口 / 窄窗口编辑窗口，并断言无横向溢出、弹窗不超出视口；桌面注入的 `--dsw-alias-*` 主题变量与窄窗口观感已由维护者在桌面实例确认。
- [x] 重启 DSH 后恢复（2026-11-19 自动化）：`test:e2e` 阶段 3 停掉真实 Host、用同一个临时 profile 重启，断言已连接条目重新 `connected` 且工具重新注册、失败条目的 `failed` 结论与原因文本不变、手动导入的 `file-` 来源和候选仍在。桌面实例的视觉与主题仍按下文人工清单看一眼。
- [x] Streamable HTTP 的测试、保存、验证、工具与删除（由 `test:e2e` 阶段 2 覆盖；桌面实例未单独实测）。
- [x] 凭证引用：存在、模板保留、轮换后重连（由 `test:e2e` 覆盖）。
- [x] 密钥统一写入 DSH 凭证服务：明文、`${env:X}` 引用、参数与 URL 明文都会转成 `MCPHUB_<服务>_<字段>` 引用；重名自动加后缀、只有独占名字允许轮换；导出按选择解析引用；`reveal` 可读回（单测 + 页面层覆盖）。
- [x] 凭证剩余分支的自动化（2026-11-19）：缺失变量/凭证时的提示已有单测；没有挂载 `credentials` 服务时，保存明文密钥与 `reveal` 都返回 `CREDENTIAL_UNAVAILABLE` 且不写配置；插件行/继承行/清理行的 `editable`、`removable`、`source` 与拒绝写入口径由单测锁定。桌面实例上的密钥查看 / 复制 / 编辑与缺失凭证文案已由维护者确认。
- [x] 验证官方 Manager 中已有服务、插件注册服务及继承配置的可操作边界（2026-11-19 维护者人工确认：只读展示、不可编辑 / 不可删除，继承行与插件注册行都符合预期）。

人工项已整理成可勾选清单：[桌面实例验收](DESKTOP_ACCEPTANCE.md)（含记录模板与失败时要附的证据）。

验收标准：记录实际 DSH 版本、运行平台和结果；正式实例工具可用于会话，停用和删除后撤回工具；无重复服务或工具注册。日常 profile 的安装和已有服务变更应由维护者选择执行时机。

### 2. 实际来源应用配置兼容矩阵

- [x] 脱敏样本与来源版本（2026-11-18）：`tests/fixtures/sources/` 八个来源样本，其中 Claude Code（2.1.71）与 Codex CLI（0.125.0）取自本机真实文件，其余按文档整理并在该目录 README 里标注；`tests/sources.test.mjs` 把样本摆进临时 HOME 走真实扫描路径。
- [x] Codex 的 `CODEX_HOME`、`env_http_headers`、`bearer_token_env_var`；OpenCode 的 JSONC、新旧容器、`OPENCODE_CONFIG` 与 `XDG_CONFIG_HOME` 覆盖。
- [x] 重复配置、同名不同配置、相同 URL 不同认证、禁用项和未知字段（`envFile` / `timeout` / `trust` 都进待核对字段，不静默丢弃）。
- [x] 相对命令、相对参数、工作目录、空 PATH：`preflight` 分别给出「找不到可执行命令」「请填写工作目录」「DSH 的 PATH 中找不到可执行命令」。
- [x] 模拟来源功能验收（2026-11-18）：`npm run test:simulated` 用假 HOME 覆盖九个来源与各种密钥写法，走完扫描 → 导入 → 凭证写入 → 真连接 → 重复识别 → 导出 → 来源文件不被改写。
- [x] 真实远程服务链路（2026-11-19 可选验收）：`DSH_E2E_REMOTE=1 npm run test:remote` 连 DeepWiki 的 `https://mcp.deepwiki.com/mcp`，真实 DNS / TLS / 握手 / 工具发现全部通过（验证 516ms、3 个工具）；端点可用 `DSH_E2E_REMOTE_URL` 替换。
- [x] 真实来源文件入口（2026-11-19 可选验收）：`DSH_E2E_REAL_SOURCES=1 npm run test:real-sources` 扫描本机真实配置；本机实测 Codex 2 个服务、Claude Code `.claude.json` 可读。
- [ ] 仍缺：Windsurf / Cursor / Copilot 在**真实机器**上的文件（本机未安装；脚本已就绪，装了对应客户端后跑上面的命令即可补齐）。

验收标准：已支持字段不丢失；无法迁移的字段明确提示；来源文件不被写入；不同身份不会被自动合并。

### 3. 统一保存等待与启动超时

- [x] 检查 `src/host/config.js` 的超时校验上限与官方 Manager 可接受范围（统一为 1–120000 毫秒，与官方默认 30000 一致）。
- [x] 将正式连接等待预算与 `startupTimeoutMs` 协调：基础预算来自插件 `Config.connectWaitMs`，条目声明更大启动超时时自动放宽。
- [x] 验证改为事件驱动 + 兜底轮询；验证结论持久化。
- [x] 覆盖慢握手、慢工具发现与重连退避：`test:e2e` 阶段 1.5 用 2.5 秒握手、2 秒工具发现和握手后退出验证，均要求等成功或进入重试，而不是提前判失败。
- [x] 首次连接给两倍等待预算（尚无成功记录时），并在连接超过 15 秒时提示可能在下载依赖。
- [ ] 真实首次 npx 下载（需要外网与一个较重的包）仍只由预算兜底，未在自动化里实际下载。
- [ ] 清理失败无法在测试里稳定制造（客户端会升级到 SIGKILL 兜底）；目前只保证诊断里展示 `cleanupError`，需要真实案例再验证。
- [x] 永久性连接错误的结算口径（2026-11-19 修复）：bad port、非法 URL、DNS 不存在（`ENOTFOUND` / `EAI_NONAME`）在 `reconnecting` 阶段直接结算为 `failed`，detail 为「连接地址不可用：…」，不再耗到重试上限；协议不匹配仍交给常规重试。由 `tests/service.test.mjs` 两种原因与 `test:e2e` 的 `dead-endpoint` 步（要求 8 秒内结算）锁定。

验收标准：超时设置有一致含义；验证失败有明确阶段和诊断；不报告旧实例连接成功，不遗留未经确认的测试进程。

### 4. 停用保存与失败诊断保留

- [x] 核对缺失环境引用能否作为停用配置保存：编辑已停用条目时走 `mode: 'draft'`，硬约束（名称、字段名、传输方式、超时范围）仍然拒绝，缺变量/凭证的模板可以按停用保存，配置里只留 `${credential:…}`（单测覆盖）。
- [x] 为不能保存的字段提供明确反馈（2026-11-18）：检查项逐条列出，缺变量时行内直接给「直接填写」入口。
- [x] **产品决定（2026-11-18，维护者）：不做新建草稿**。缺变量/凭证时就要求用户填好再保存，保存按钮保持不可用；不引入与 Manager 事实不一致的草稿存储。
- [x] 失败后自动停用时，服务行仍显示上次失败原因；结论持久化到来源记录。
- [x] 核对删除后连接清理期间的行状态及来源重新添加时机（2026-11-18）：官方 `list()` 会保留 `configured:false` 的「清理中」实例（一般几十到几百毫秒，清理失败时留到宿主重启）。此前这段时间里同名重新添加会被判成 `NAME_TAKEN`「已有同名服务器」，界面还会在名称框提前拦住；现在区分成 `NAME_CLEANING`（附带官方清理失败原因与「重启 DSH」提示），编辑器不再把 `cleanup` 行算作已占用名称，保存/批量添加遇到它会短暂重试。

验收标准：明确区分未保存、停用已保存、正式连接失败；重新打开详情仍能找到必要的失败原因；诊断记录不含密钥明文。

### 5. 自动化端到端与可重复验证

- [x] 把 Host 侧验收转成可重复运行的端到端用例：`npm run test:e2e`（临时 `DSH_HOME` + `web` 模板 profile + 真实路由，约 1 分钟，不碰用户 profile）。
- [x] 把页面主流程纳入自动化：`npm run test:ui`（无头 Chrome）覆盖设置页导航、空状态、导入页签、JSON 粘贴逐行测试、多服务一次添加、行内连接状态、删除弹窗、页签切换草稿保留、测试进度与取消、重名跳过。
- [x] 页面流程补分支（2026-11-18）：表单里缺引用时「直接填写」补全并重测通过；重命名凭证引用行只换字段名、引用原样保留；测试失败后改配置直接重测并通过；缺失变量在行内与检查结果里用同一个名字（此前行内会带 `env:` 前缀）。
- [x] 页面流程已覆盖：重名跳过、测试进度/取消、连接失败原因、环境变量缺失提示、保存后关闭、编辑已有服务后重新验证、带明文密钥保存提示、凭证显示/复制/行内编辑先测试后写入。
- [x] 首次连接的「可能在下载依赖」提示（超过 15 秒后替换等待文案）已由单测覆盖（2026-11-18）；页面层不再重复跑一次 16 秒的慢启动。
- [x] 覆盖删除后重新导入、外部配置变更、连续操作以及测试期间关闭 / 卸载（2026-11-19，`test:e2e` 阶段 4/5）：
  - 删除服务后同一条来源的 `candidate.duplicate` 清空，可用同一 candidateId 再次保存并连上；
  - 绕过插件直接改 `cordis.patch.yml`，运行中的 Manager 约 2.5 秒热加载并连上，恢复文件后约 2.2 秒行消失；这类外部条目按宿主行展示为不可编辑、不可删除（与官方 Manager 注册同一边界）；
  - 同一 revision 并发保存三条，恰一条成功、两条 `REVISION_CONFLICT`；
  - 慢握手验证中停掉 Host，重启后不出现 `ok` 假象且条目重新连上；`plugin remove` + 重启后插件路由 404、组合配置无插件层。
- [ ] 已知边界：验证结论只在结算时落盘，进程被强杀时「验证中」这一刻的结论会丢失（不会伪报成功，重启后重新连接）；若产品希望显示「上次验证被中断」，需要把 `verifying` 也持久化。
- [x] 使用受控本地 MCP 与临时目录（`tests/manual/echo-server.mjs`、临时 `DSH_HOME`），不依赖 npx 在线下载或真实账户。
- [x] 接入 CI（见 P0-6）。

验收标准：干净检出后按文档即可复现；失败有可定位输出；不需要开发机现存的 `/tmp` 或 profile 数据。

### 6. 接入 CI

`.github/workflows/ci.yml` 已接入；本地基线先跑通（单测 159 项、`check`、`build`、`test:e2e` / `test:registry` / `test:oauth` / `test:ui` / `test:simulated` / `test:layout`、打包清单 28 个文件全部通过）。`checks` 同时在 `windows-latest` 与 `ubuntu-latest` 上跑，两者都是阻塞项。2026-11-19 修掉 Windows 上必然失败的 XDG 路径断言（`tests/sources.test.mjs` 改用 `[\\/]`）与 `~` 展开后的盘符断言后，Windows job 已在 `aceb0ec` 上真机跑绿，`continue-on-error` 已移除。

- [x] 基础流水线：`npm ci` → `npm test` → `npm run check` → `npm run build` → `npm pack --dry-run --json --ignore-scripts` 交给 `scripts/assert-pack.mjs` 断言包内容（`lib/client.js`、`lib/style.css`、`cordis.patch.yml`、`locale/`、`icon.svg`、`src/host`、`src/shared`、`README.md`、`LICENSE`），并断言复审报告不进包。这一层不需要 DSH，公开 runner 即可。
- [x] 端到端流水线（需要装了 DSH 的机器）：`npm run test:e2e`、`npm run test:registry` 与 `npm run test:ui` 串行跑在一个带 `dsh` 标签的自托管 runner 上，由仓库变量 `DSH_E2E_RUNNER=true` 打开（未打开时整个 job 跳过，不会挂起）。CI 里设 `DSH_E2E_REQUIRED=1`，把「找不到 dsh / Chrome」从 SKIP 变成失败——否则 runner 没装 DSH 时会绿灯通过但什么都没测。
- [x] 判定与产物：脚本的 JSON 报告完整打在作业日志里；`test:ui` 失败时自动把全页截图写到 `tests/e2e/artifacts/ui-failure-*.png`，报告里带 `screenshot` 路径；CI 以 `ui-failure` artifact 上传。
- [x] 缓存：基础作业用 `setup-node` 的 npm 缓存；自托管 runner 不缓存 `node_modules`，每次 `npm ci` 保证干净。`puppeteer-core` 不下载浏览器，Chrome 由 runner 提供（`DSH_E2E_CHROME_PATH`）。

验收标准：一次干净 clone 后推送即可看到绿灯；失败时能直接定位到步骤；端到端在无人值守下可重复（不依赖开发机现存的 `/tmp`、profile 或 Chrome 用户目录）。

## P1：补齐管理体验

| 任务 | 验收重点 |
| --- | --- |
| 项目级扫描与配置归属（部分完成：已扫启动目录，仍未支持切换扫描范围） | 只扫描当前或用户选择的项目；显示来源范围；不遍历整盘；明确最终保存范围 |
| 配置导出、备份与恢复（部分完成：已支持导出与导入恢复，仍未做来源信息分离） | 默认不导出密钥；恢复前预览冲突；来源信息与连接配置分开 |
| 未保存内容保护（已完成） | 两个页签各自标记未保存，关闭编辑窗口前提示一次 |
| 批量添加（已完成） | JSON 页逐行解析/测试，全部通过后一次 revision 写入；同名跳过，失败零写入；成功后提示结果；服务端保留撤销整批能力，页面撤销入口已移除 |
| 冲突内解决（已完成） | 版本冲突可在窗口内同步最新版本后继续保存 |
| 测试取消与更清晰的阶段进度（已完成 2026-11-18） | 测试按钮始终保留并显示「测试中 n/m」，可随时取消；取消后关闭测试连接，不误显示保存成功 |
| 启停后验证结论不刷新（已完成 2026-11-18） | 手动启用会为新的连接代次重开验证，停用会结束仍在跑的验证，批量启停同样处理；刚写回 `enabled` 但官方实例仍停在 `disabled` 时，验证只等启动、不误判为取消 |
| 凭证管理与密钥写入（已完成 2026-11-18） | 明文、环境变量引用、参数/URL 明文统一写入 DSH 凭证服务（`MCPHUB_` 前缀）；重名自动加后缀，只有独占名字允许轮换；`reveal` 解析引用、就地只读显示 10 秒并可复制；编辑密钥在行内输入、先做真实连接测试，通过后才写入草稿，保存时按独占/共享规则轮换或新建；导出可选择内联明文；替换/删除后提示无引用的旧凭证 |
| 表单错误与冲突处理 | 尽量定位到字段；revision 冲突能核对最新值，避免反复提交旧 revision |
| 运行环境帮助 | 命令绝对路径、PATH、目录、变量引用与凭证引用的差异可直接理解 |
| 来源缓存与状态刷新（状态部分已完成：长轮询推送；来源缓存仍待定） | 明确手动文件候选保留范围；窗口重开、外部修改及并发刷新不显示旧状态 |
| 可访问性与布局（布局已自动截图，键盘焦点仍待人工） | 键盘焦点、模态背景交互、长参数、窄窗口、深浅色主题、中文溢出；`npm run test:layout` 已覆盖溢出的断言 |
| 跨平台验证（部分完成 2026-11-19） | Windows 的 `npx`/`uvx` 已按 PATHEXT 解析为 `.cmd`/`.exe`，PATH/PATHEXT 大小写不敏感；XDG 路径与 `~` 展开断言已改为跨平台；Windows job 已真机跑绿并改为阻塞。仍待：目录与安装行为、Linux 覆盖 |
| 多语言（已完成） | 中文 / 英文跟随 DSH 语言设置；业务组件仍以中文为源文案，由 `src/client/i18n.js` 在渲染边界翻译 |

## P2：后续产品能力

### 在线搜索发现（MVP 已完成）

- [x] 确定目录来源及数据协议：只接官方 MCP Registry，Host 代理 `/v0/servers` 搜索和详情。
- [x] 展示发布者、来源、命令 / 地址、运行环境、配置字段和认证要求；npm、PyPI、OCI、streamable-http 可转换，SSE 和其他包类型明确不支持。
- [x] 选择后预填现有编辑页，复用配置编辑、逐行测试、一次 revision 写入和后台验证，不直接绕过检查执行安装。
- [x] 补 Registry 的离线、接口失败、分页、未知字段端到端验收（2026-11-19，本地假 Registry）：`test:registry` 覆盖两页搜索与下架过滤、详情转换与密钥提示、HTTP 500 / 坏 JSON / 超时 / 连接不上四种失败；真实官方目录的连通性与数据漂移仍需人工看一次（CI 不依赖外网）。
- [ ] 评估是否需要私有/企业目录；当前只读公开官方目录。

### OAuth 与凭据管理（协议核心已完成，见 [开发计划](DEVELOPMENT_PLAN_2026-11-17.md#认证能力)）

- [x] 确认目标 DSH 版本的官方授权能力：`authorization.registerFlow` + `credentials` grant 记录 + `credentials/reference-updated` 重连可用；mcp-client 自身仍无 `authProvider`。
- [x] 授权、刷新、过期与重新授权状态（2026-11-20）：`needs-auth` / `authorizing` / `authorized` / `refreshing` / `failed`；重启后从 grant 恢复，到期前 120 秒刷新，失败回到待授权；删除时清理 grant、引用与本机回调。
- [x] access token 落 refs 再进 Header（`${credential:NAME}` 解析不了 `<owner>/<id>` 记录），refresh 留在 grant：保存时强制 `Authorization: Bearer ${credential:MCPHUB_<服务>_ACCESS_TOKEN}`，preflight 允许延迟写入。
- [x] 401/403 归类口径与「需要认证」兜底文案（沿用既有 `AUTH_FAILURE`）；OAuth 行在待授权时不启动空等验证。
- [ ] 真实 Notion 账号验收（`https://mcp.notion.com/mcp`）：确认登录、回调、工具注册、重启免重授权、过期刷新。
- [ ] 无 DCR 的服务（如 GitHub 预注册 App）支持手动填写 client id / secret。
- [ ] 401 到期后自动触发重新授权（当前依赖用户在行上点「授权」）。
- [ ] 对其他应用私有凭据明确提示重新授权；不假定复制配置等于复制登录状态。

### 打包与版本边界

- [x] 官方 `@deepseek-ai/*` 包移出 `dependencies`，改为 peer + dev；补 `engines.dsh` 声明兼容范围。
- [x] 集成测试不再硬编码 `0.2.2-rc.3`（2026-11-19）：缺 `DSH_TEST_MODULES` 时只指向 README；能从 `@deepseek-ai/dsh-app-boot` 读出版本时，按 `engines.dsh >=0.2.2-0 <0.3.0-0` 校验，不符直接报出实际版本。README 安装示例同步到已验证的 `0.2.2-rc.5`。
- [x] 打包后核对 `files` 白名单（2026-11-19）：`npm run test:tarball` 实际 `npm pack` 后装进全新临时 profile，核对打包清单（2026-11-20 为 28 个文件）、`lib/client.js` 与宿主入口在包内、插件层加载、接口可用。
- [ ] `devDependencies` 里的 `@deepseek-ai/dsh-mcp-client` 仍锁 `0.2.2-rc.3`：`rc.5` 的客户端要求整套 `@deepseek-ai/dsh-llm@0.2.2-rc.5` 等 peer，直接升级会 `ERESOLVE`。link 安装时 `probeServer` 因此来自 rc.3 副本；要么和宿主包一起升级并重跑全部 e2e，要么在文档里明确 link 验收实际用的是 rc.3 客户端（tarball 验收用的是宿主副本）。

### 工具权限与调用测试

- [ ] 确认官方服务提供可执行的单工具权限接口后，再设计每工具开关。
- [ ] 如增加手动工具调用，提供参数校验，沿用 DSH 的审批与执行机制。
- [ ] 不通过隐蔽调用业务工具来判断服务是否可用。

## 后续阶段：Tool Search 与上下文管理

此方向仍按已讨论的顺序延后，不与首版 MCP 管理同时扩张。

- [ ] 先证明目标 DSH 版本可控制最终发送给模型的工具 Schema，而不只是修改展示目录。
- [ ] 分别验证 Native 和 PTC 模式，保留完整工具注册表和原生执行 / 审批路径。
- [ ] 验证搜索后加载、卸载、会话隔离及工具列表变化。
- [ ] 技术验证通过后，再规划搜索算法、加载预算和管理页面。

## 下一次开发的建议顺序

截至 2026-11-20（r11）：安装、Host 侧验收、`test:e2e`（38 步，含宿主重启恢复、阶段 4/5 与非法端点快速失败）、`test:registry`（7 步，本地假 Registry）、`test:oauth`（7 步，本地假授权服务器）、`test:ui`（23 步）、`test:simulated`（九种客户端 + 各种密钥写法）、`test:layout`（浅色/深色/窄窗口）、CI（Ubuntu + Windows 均阻塞）、启停后重新验证、密钥统一写入 DSH 凭证服务、行内查看/复制/编辑密钥、删除后清理期同名重加、来源兼容矩阵、Windows 命令探测、无凭证服务与官方 Manager 行边界、删除后重新导入 / 外部配置变更 / 并发保存 / 验证中关闭 / 卸载后 404、桌面人工项都已完成；`test:tarball`、`test:remote`、`test:real-sources` 三个可选验收也已跑通；本地基线全绿（单测 159 项、`check`、`build`、六条端到端脚本、打包清单 28 个文件）。

1. 复现基线：`npm ci && npm test && npm run check && npm run build`，再**串行**跑 `npm run test:e2e`、`npm run test:registry` 与 `npm run test:ui`（e2e / ui 各约 1–2 分钟且都默认占 `127.0.0.1:3080`，并行会 EADDRINUSE）。推送后确认 CI 的 checks 作业（Ubuntu 与 Windows 均为阻塞项）。要跑端到端按 README「持续集成」挂 runner。
2. 补齐 P0-2 的真实来源样本（Windsurf / Cursor / Copilot 装好后跑 `test:real-sources`）与 P0-3 的两处真实边界（首次 npx 下载、清理失败案例）。
3. 桌面实例再确认一次 Windows / Linux 上的安装与目录行为（目前只有 macOS 实机与 Windows 单元测试）。
4. OAuth 收尾（2026-11-20 协议核心已落地）：用 Notion 真实账号跑一遍人工验收；再评估无 DCR 服务的手填 client id 与 401 自动重新授权。

## 提交与发布约定

- 本次发布使用 `0.2.0`；不把之前的本地临时编号写成正式发布历史，不自动创建 tag、推送或发布 npm。
- 版本号以 `package.json` 和 `package-lock.json` 为准；安装示例、进度文档随正式版本同步。
- Git 提交源码、测试、锁文件和文档；忽略 `node_modules/`、`lib/`、`dist/`、本地 tarball、日志和环境文件。
- 交付前运行适用检查，更新开发进度与待办状态；未验收的项目不能标为完成。
- 真正发布时，从干净检出构建并打包；确认 tarball 包含 Host、共享模块、浏览器模块、样式和 bundle patch，再安装验收。
