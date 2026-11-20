# 测试说明

这个目录里的测试按「离真实用户有多远」分层：越靠后越接近真实 DSH，也越依赖本机环境。日常改代码跑单测即可；发版前再按 [验证顺序](#建议的验证顺序) 往下走。

## 一览

| 层级 | 命令 | 需要 | 默认行为 |
| --- | --- | --- | --- |
| 单元测试 | `npm test` | Node `^22.19.0 \|\| >=24` | 总是运行，不联网、不起进程 |
| 语法 / 共享层检查 | `npm run check` | Node | 总是运行 |
| 真实集成测试 | `npm run test:integration` | `DSH_TEST_MODULES` 指向官方包目录 | 缺环境时失败并提示准备命令 |
| 接口端到端 | `npm run test:e2e` | 本机 `dsh` launcher | 找不到 `dsh` 时 SKIP |
| Registry 边界 | `npm run test:registry` | `dsh` | 找不到时 SKIP |
| OAuth 授权 | `npm run test:oauth` | `dsh` | 找不到时 SKIP |
| 页面端到端 | `npm run test:ui` | `dsh` + Chrome + `puppeteer-core` | 找不到时 SKIP |
| 布局截图 | `npm run test:layout` | 同页面端到端 | 找不到时 SKIP |
| 模拟来源 | `npm run test:simulated` | `dsh` | 找不到时 SKIP |
| tarball 安装 | `npm run test:tarball` | `dsh` + npm | 找不到时 SKIP |
| 真实公网 MCP | `DSH_E2E_REMOTE=1 npm run test:remote` | 网络 + `dsh` | **默认跳过** |
| 真实客户端文件 | `DSH_E2E_REAL_SOURCES=1 npm run test:real-sources` | 本机装过对应客户端 | **默认跳过** |

设 `DSH_E2E_REQUIRED=1` 后，所有 SKIP 变成失败——CI 用这个开关避免“机器没装 DSH”被当成通过。

## 单元测试

`npm test` 直接跑 `tests/*.test.mjs`，用 Node 内置 `node:test` + `assert/strict`，不依赖测试框架。共 **161 项**。

| 文件 | 覆盖内容 |
| --- | --- |
| `backup.test.mjs` | 导出备份不把 `••••••` 占位符写回配置；args / env / headers / URL 里的凭据分别省略；省略项有清单 |
| `catalog.test.mjs` | Registry 名称转合法别名；npm / PyPI / OCI 安装方式；分页与 nextCursor；非 active 过滤；错误映射；搜索与详情缓存 |
| `config.test.mjs` | Codex TOML、OpenCode JSONC、空服务列表；未知字段与不兼容传输字段要显式核对；坏条目容错；扫描只读已知文件；脱敏与引用改写；`preflight` 的环境检查、不执行命令、不臆造 cwd；Windows 的 PATH / PATHEXT（`.cmd` / `.exe`、缺省顺序、大小写、已有扩展名不重复探测） |
| `editor.test.mjs` | 编辑器的 `mcpServers` / `mcp_servers` / `servers` / OpenCode 容器解析；高德配置回归；缺变量时 preflight 报出变量名 |
| `oauth.test.mjs` | OAuth 键名与引用、PKCE S256、PRM/AS 发现、DCR、授权码与 refresh 交换、grant 记录与刷新阈值、本机回调 |
| `i18n.test.mjs` | 中英词条、动态消息正则、占位符替换 |
| `probe.test.mjs` | 缺变量时完全不启动进程；握手成功但清理未确认不算通过；可执行文件不是 MCP 时失败；`tools/list` 失败仍算“已连接、可添加” |
| `servers.test.mjs` | 清理中的行不占用名称；`NAME_CLEANING` 自动重试；`takenNames` 边界 |
| `service.test.mjs` | Host 服务主体（80 项）：后台验证与结算、首次连接双倍预算、失败自动停用、认证失败文案、取消验证、启停代次、批量导入一次 revision、重复名 / 冲突 / 零写入、撤销整批（接口能力）、密钥写入与 reveal、导出、清理行、官方 Manager 行边界、无凭证服务时的拒绝、验证中断态结算、非法端点快速失败、OAuth 401 转待授权且不自动停用、来源记录持久化 |
| `sources.test.mjs` | 各客户端真实形状：Claude 项目级、Codex `CODEX_HOME` / `env_vars` / Bearer、OpenCode 环境变量覆盖、Gemini `httpUrl`、VS Code `type` / `envFile`、跨来源去重（连接身份而非名字） |

## 真实集成测试

在临时 profile 里启动受控 MCP 子进程，验证官方 Settings 持久化、连接、工具注册、重复检测和停用。官方包不随插件发布，需要装到独立目录：

```sh
npm install --prefix /tmp/dsh-mcp-hub-smoke --ignore-scripts \
  @deepseek-ai/cordis @deepseek-ai/dsh-mcp-manager@0.2.2-rc.5 \
  @deepseek-ai/dsh-app-boot@0.2.2-rc.5 @deepseek-ai/dsh-config-editor@0.2.2-rc.5 \
  @deepseek-ai/dsh-settings@0.2.2-rc.5

DSH_TEST_MODULES=/tmp/dsh-mcp-hub-smoke npm run test:integration
```

脚本会从 `@deepseek-ai/dsh-app-boot/package.json` 读版本，并校验落在 `engines.dsh` 范围内（当前 `>=0.2.2-0 <0.3.0-0`）；版本不符会直接报出实际版本，不再硬编码。

## 端到端测试

所有 e2e 都通过 `tests/e2e/support/profile.mjs` 建临时 `DSH_HOME`、生成 profile、link 或安装本仓库、启动真实 Host。临时目录在结束时删除，不会碰你的 `desktop` profile。

### 接口端到端：`npm run test:e2e`

`tests/e2e/web-profile.e2e.mjs`，**38 步**，用真实 `/api/dsh-mcp-hub/*` 路由跑完：

| 阶段 | 内容 |
| --- | --- |
| 1 | stdio 全链路：列表 → 扫描 → 测试连接 → 添加 → 后台验证 → 读工具 → 停用 → 启用 → 重启 → 删除 |
| 1.5 | 启动 / 重连边界：慢握手、慢工具发现不能提前判失败；进程退出进入重连退避并暴露“第几次重试” |
| 2 | Streamable HTTP：静态 Bearer、`${credential:…}` 模板、凭证轮换后自动重连、错误 token 判“需要认证”并立即结算；非法端口在 8 秒内结算为“连接地址不可用” |
| 3 | 宿主重启恢复：停 Host 再用同一 profile 重启，已连接条目、工具、失败原因、`file-` 来源都要回来 |
| 4 | 删除后重新导入、外部 `cordis.patch.yml` 热加载与恢复、同一 revision 并发三写（恰一条成功、两条 `REVISION_CONFLICT`） |
| 5 | 慢验证中停 Host 不得伪报成功；`plugin remove` 后重启，插件路由 404、组合配置无插件层 |

### Registry 边界：`npm run test:registry`

`tests/e2e/registry.e2e.mjs` 用一个本地假 Registry 覆盖目录接口的边界：两页搜索与 `nextCursor`、下架项过滤、未知字段不丢条目、详情转换（包安装参数、密钥变量提示、SSE 明确不支持）、HTTP 500、坏 JSON、超时、连接不上。通过临时 profile 的 `cordis.patch.yml` 覆盖 `catalogBaseUrl` / `catalogTimeoutMs` / `catalogCacheMs`，不访问真实公网，因此 CI 不会因 Registry 抖动而随机失败。

### OAuth：`npm run test:oauth`

`tests/e2e/oauth.e2e.mjs` 用一个本地假授权服务器（`tests/manual/oauth-fixture.mjs`：PRM、AS metadata、DCR、PKCE 校验、token 与 refresh）驱动真实 Host：保存为 `needs-auth`（不空等验证）→ 打开授权链接 → 回调换 token → 自动连接并注册工具 → 重启 Host 后免重授权（临近过期自动 refresh）→ 删除时清理凭证引用与授权记录 → 不存在的服务返回 404。不访问真实 OAuth 服务。

### 页面端到端：`npm run test:ui`

`tests/e2e/ui-page.e2e.mjs`，**23 步**，用 `puppeteer-core` 驱动本机 Chrome，真的点一遍设置页：空状态、本地导入、JSON 逐行测试、批量添加、重名跳过、测试中取消、失败原因、保存后关闭、编辑后重新验证、密钥写入凭证、显示 / 复制 / 编辑密钥、删除确认等。失败时全页截图写到 `tests/e2e/artifacts/`。

Chrome 默认取 macOS 路径，可用 `CHROME_PATH` 指定；`DSH_E2E_CHROME_PATH` 供 CI 使用。

### 布局：`npm run test:layout`

`tests/e2e/ui-layout.e2e.mjs` 在临时 profile 上截 4 张图（浅色、深色、700px 窄窗、窄窗编辑窗），断言没有横向溢出、弹窗不超出视口。产物：`tests/e2e/artifacts/layout-*.png`。它只覆盖插件自带的回退配色；桌面注入的 `--dsw-alias-*` 主题仍需人工看，见 [桌面验收清单](../docs/DESKTOP_ACCEPTANCE.md)。

### 模拟来源：`npm run test:simulated`

`tests/e2e/simulated-sources.e2e.mjs` 造一个“装了九种客户端”的假 `HOME`（Claude Code / Claude Desktop / Codex / Gemini / VS Code / Copilot / Windsurf / Cursor / OpenCode），条目里混放明文密钥、`${env:X}`、`${X}`、`{env:X}`、Codex 的 `bearer_token_env_var` / `env_http_headers` / `env_vars`、停用项、未知字段和缺失变量。然后走真实 Host：扫描 → 逐个导入 → 密钥写入凭证（配置只留引用）→ 真连接并注册工具 → 跨来源重复识别 → 缺变量 / 相对命令被拒 → 导出（含与不含密钥）→ 确认来源文件未被写回。

### tarball：`npm run test:tarball`

`tests/e2e/tarball.e2e.mjs` 构建 → `npm pack` → 装进全新临时 profile，核对打包清单（当前 28 个文件）、`lib/client.js`、插件层与接口可用。对应 README 的方式 B（Release 安装），验证“用户实际装到的包”。

### 可选的真实链路

- `DSH_E2E_REMOTE=1 npm run test:remote`：连真实公网 MCP（默认 `https://mcp.deepwiki.com/mcp`），验证 DNS / TLS / 握手 / 工具发现；`DSH_E2E_REMOTE_URL` 可换端点。
- `DSH_E2E_REAL_SOURCES=1 npm run test:real-sources`：扫描**本机真实**客户端配置（Codex、Claude Code、Cursor、Windsurf、Copilot、VS Code）。插件固定按真实 home 扫描，与 `DSH_HOME` 无关；没有文件的客户端跳过。

## 常用环境变量

| 变量 | 作用 |
| --- | --- |
| `DSH_BIN` | `dsh` launcher 路径；默认自动探测桌面应用 / PATH |
| `CHROME_PATH` | 页面测试用的 Chrome 可执行文件 |
| `DSH_E2E_CHROME_PATH` | CI 上给页面测试用的 Chrome 路径 |
| `DSH_E2E_REQUIRED=1` | 把 SKIP 变成失败（CI 使用） |
| `DSH_E2E_PORT` | e2e 启动端口；桌面应用占用 3080 时改一个空闲端口 |
| `DSH_TEST_MODULES` | 集成测试用的官方包目录 |
| `DSH_E2E_REMOTE=1` / `DSH_E2E_REMOTE_URL` | 打开真实远程验收 / 换端点 |
| `DSH_E2E_REAL_SOURCES=1` | 打开真实来源文件验收 |

## 建议的验证顺序

```sh
npm test && npm run check && npm run build
npm run test:e2e
npm run test:registry
npm run test:oauth
npm run test:ui
npm run test:simulated
npm run test:layout
npm run test:tarball
# 有网络 / 有真实客户端时再跑
DSH_E2E_REMOTE=1 npm run test:remote
DSH_E2E_REAL_SOURCES=1 npm run test:real-sources
```

接口、Registry、OAuth、页面、模拟、布局六类都默认占用 `127.0.0.1:3080`；本机桌面应用在跑时可用 `DSH_E2E_PORT` 换端口，**必须串行**跑，不要并行。

## 常见问题

- **SKIP 还是失败？** 默认没装 `dsh` / Chrome 就 SKIP 并以 0 退出；CI 设 `DSH_E2E_REQUIRED=1` 后同样的环境问题会失败。本地要确认“确实跑过”，也设这个变量。
- **`npm pack` 在本地失败**：某些环境 `~/.npm/_logs` 不可写，给 `npm pack --dry-run --json --ignore-scripts --cache /tmp/npm-cache-mcphub`。
- **页面测试找不到按钮**：先看 `tests/e2e/artifacts/` 的截图；多半是构建产物过期，重新 `npm run build`。
- **端口被占**：确认没有另一个 e2e 或 `npm run dev` 在同机运行；桌面 DSH 自己占 3080 时用 `DSH_E2E_PORT=3207`。
- **真实来源测试没结果**：它只扫真实 home；`DSH_HOME` 指向别处不影响。装了客户端但没配过 MCP，也会没有服务。

## 写新测试

- 单测放 `tests/`，命名 `*.test.mjs`，用 `node:test` 的 `test()` 和 `assert/strict`；
- 需要真实 DSH 的放 `tests/e2e/`，复用 `support/profile.mjs` 的 `createProfile` / `bootProfile` / `createApi`，不要自己写一套启停；
- 需要“假客户端配置”的放 `tests/fixtures/` 或 `support/simulated-home.mjs`；
- 不执行来源配置里的命令，不写真实用户目录，不依赖桌面 `desktop` profile；
- 不硬编码 DSH 版本号；需要校验时读安装包里的 `package.json`；
- 新 e2e 结束必须清理临时目录与子进程，失败时尽量把证据写到 `tests/e2e/artifacts/`。
