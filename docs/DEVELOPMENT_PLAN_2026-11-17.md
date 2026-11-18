# 开发计划：认证能力与下一阶段

更新日期：2026-11-17（Asia/Shanghai）。**修订 r2**：按 DSH 0.2.2-rc.3 安装包源码重新核对认证 seam、依赖声明与验证方式，修正 r1 中三处与实现不符的判断（见各节「修订」标注）。

当前基线：**0.1.0**。本文承接 [后续任务](NEXT_TASKS.md)，聚焦“需要登录认证的 MCP 服务”和下一阶段的产品优先级，不替代具体任务的验收清单。

## 结论

- 本地服务、以及用静态 Header / API Key 的远程服务，使用链路已经闭环：导入 → 添加 → 测试 → 保存 → 后台验证 → 启停 / 重启 / 删除。
- 认证要分层推进：**先做 Token / API Key + 认证状态；OAuth 用 DSH 已有的 `authorization` + `credentials` seam 在插件内实现，不做本地代理。**
- r1 判断"DSH 没有授权 seam"是错的：`dsh-base` 已挂载 `authorization`/`credentials`，MCP 客户端也会在 `credentials/reference-updated` 后重建连接。缺的是 MCP 规范发现与 401 重新授权，不是整条路。
- 除认证外，最值得补的是：真实桌面验收与 E2E、失败诊断、项目作用域、版本更新、备份来源分离。工具级权限和 Tool Search 仍应等待官方接口。
- 依赖边界属于必须修的项：官方 `@deepseek-ai/*` 包不能写进 `dependencies` 固定版本，否则插件自带第二份客户端，将来与宿主行为分叉（详见 [版本兼容](../README.md#版本兼容与依赖边界)）。

## 当前状态

### 已经闭环的部分

- 多来源导入、批量 JSON、逐行测试、一次 revision 写入、失败零写入、撤销本批。
- 表单 / JSON 独立草稿；重名提示与改名；手动来源持久化与删除。
- 官方 MCP Registry 搜索、详情、预填添加；不静默安装。
- 配置导出（可选密钥）、备份恢复、环境变量与请求头引用。
- 中英双语跟随 DSH locale。
- 单元测试 118 项、构建和语法检查通过（2026-11-18 复核）；`npm run test:e2e`（接口全链路 + 启动/重连边界，23 步）与 `npm run test:ui`（无头 Chrome 点页面，16 步）在临时 profile 里跑通，CI 的 checks 作业公开可复现。
- 密钥统一写入 DSH 凭证服务：明文 / `${env:X}` / 参数 / URL 凭证都会解析后写成 `${credential:MCPHUB_…}`；引用可就地查看、复制、行内编辑（编辑前先做真实连接测试）。
- 依赖声明已修正为「官方包 peer + dev、第三方库 dependencies、`engines.dsh` 声明范围」。

### 没有闭环的部分（2026-11-18 复核）

- 桌面 profile 已 link 安装并完成第一轮验收；剩下的只是主题/窄窗口、重启恢复、凭证缺失等必须看页面的手工项。
- OAuth 服务没有授权、刷新、过期、撤销和 401 重新授权流程（Token/API Key 与凭证存储已完成）。
- 没有认证状态模型，401/403 也没有归类。
- 失败诊断只有最后错误和工具列表，缺少启动日志、阶段和历史。
- 项目级发现只覆盖启动目录，不能切换作用域。
- 不能比较已安装版本与 Registry 版本，也不能升级 / 固定版本。
- 备份恢复没有把来源信息和连接配置分离，冲突预览不足。

## 认证能力

### 当前约束（2026-11-17 修订：按 0.2.2-rc.3 安装包源码核对）

MCP 客户端本身仍然没有 OAuth：

- `@deepseek-ai/dsh-mcp-client` 的 `streamable-http` 只把 `headers` 传给 `StreamableHTTPClientTransport`，没有传 `authProvider`；因此没有 Protected Resource Metadata / Authorization Server Metadata 发现、动态客户端注册（DCR）、PKCE、token 刷新与撤销。
- 连接状态只有 `closed`、`waiting-credentials`、`connecting`、`connected`、`reconnecting`、`failed`。`waiting-credentials` 指"引用的值不存在"，**不是** 401 过期；401 只能从 `lastError` 或 probe 文本里识别。

但 DSH 已经提供通用的授权 seam，此前文档"没有授权 seam"的判断需要修正：

- `@deepseek-ai/dsh-base` 默认挂载 `authorization` 与 `credentials` 两个服务。
- `ctx.authorization.registerFlow({ key, label, methods, run(session) })` 可以发起浏览器登录、收一次性码；`run` 必须通过 `ctx.credentials.modifyRecord` 提交记录，否则 seam 以 `NOT_COMMITTED` 拒绝。
- 凭证存储支持 `kind: grant` + `payload: { type: oauth, access, refresh, expires }`；`modifyRecord` 是带锁的读-改-写，正是刷新所需。
- MCP 客户端监听 `credentials/reference-updated`：插件改写它用到的引用后，客户端会关闭旧连接、重新解析模板并重连。

所以缺口是"MCP 规范那一层"和"401 之后的重新授权"，不是"完全无法做 OAuth"。

### 认证分层

| 类型 | 现在能否做 | 方案 |
| --- | --- | --- |
| API Key / Bearer Token | 能，优先做 | 粘贴或授权拿到 token → 写 DSH 凭证引用 → Header 用 `${credential:...}` → 复用测试 / 保存 |
| OAuth 2.1 远程 MCP | 能做授权与刷新，401 自动重授权要自己做 | 授权 flow + `credentials.set` 轮换 + `${credential:...}`；PRM/DCR/PKCE 在插件内实现；不做本地代理 |
| 云厂商签名（AWS SigV4、GCP ADC） | 不能直接做 | 需要代理或上游支持 |
| stdio 本地服务 | 已支持 | env / 本机已有登录态；本质仍是 API Key 或本机凭证 |
| 从其他应用导入的 OAuth 登录态 | 不能迁移 | 明确提示重新授权，不假定复制配置等于复制登录 |

### 两条路线（原三条收敛为两条）

- **A. 就用现有 seam，在插件内做完整 OAuth（推荐）**：`authorization.registerFlow` 负责授权 UI 与生命周期，grant 存 `records` 保留 refresh，需要进 Header 的 access token 用 `credentials.set` 落到 refs（`${credential:NAME}` 只解析 refs 键空间，解析不了 `<owner>/<id>` 记录），过期前主动刷新写回，客户端收到 `credentials/reference-updated` 自动重连。401 用文本匹配识别后触发一次重授权。
- **B. 等 DSH core 给 mcp-client 加 `authProvider`**：最干净，但目前没有排期；可作为将来的收敛方向，不必现在阻塞。

**放弃原方案 B（插件内置本地反向代理）**：既然凭证轮换与重连通知已经存在，代理要处理的流式转发、session、端口安全就没有收益。

### 凭证与安全原则

- token 存 DSH 凭证服务，不写普通配置，不出现在导出、日志和错误详情中。
- Header 模板使用 `${credential:...}`；不要在前端保存明文 token。
- 认证状态至少区分：`unauthenticated`、`authorizing`、`authenticated`、`expired`、`error`。
- 从其他应用导入的配置不携带 OAuth 登录态；首次使用必须重新授权。
- 目录只是目录，不代表安全审核；远程服务仍要展示地址、发布者、认证要求和风险提示。

## 其他能力缺口

| 能力 | 现状 | 缺口 | 优先级 |
| --- | --- | --- | --- |
| 真实桌面验收 | 预览和单测通过，桌面只做过零散验证；换机后本机尚未安装 | 安装、Connection Fetch 路由、主题、重启恢复、凭证引用、stdio / HTTP 全链路未系统验收 | P0 |
| 认证状态与重新授权 | 只有静态 env / header | 客户端无 `needs-auth` 状态，需插件归类 401/403；无过期、重新授权、账号 / 作用域展示 | P0 |
| 失败诊断与日志 | 有最后错误、工具列表、复诊 | 无 stderr / 启动日志、失败阶段、历史、自动重连策略 | P1 |
| 项目作用域 | 只扫描启动目录 | 不能切换项目、不显示归属、不区分全局 / 项目配置 | P1 |
| 版本与更新 | 目录能看 Registry 版本 | 没记录已安装版本，不能比较 / 升级 / 固定版本 | P1 |
| 备份恢复完整性 | 能导出 / 导入，密钥可选 | 来源信息与连接配置未分离，冲突预览不足 | P1 |
| 搜索质量 | 官方 Registry，按服务名、至少 3 字符 | 无本地 / 远程、认证类型、包类型筛选；无安全 / 可信标识 | P2 |
| 工具级权限 | 只能看工具列表 | 单工具开关 / 审批要等官方可执行权限接口 | 阻塞 |
| Resources / Prompts / Sampling | 未接 | 取决于 DSH client 是否暴露 | 后续 |
| 私有 / 企业目录、团队共享 | 无 | 需要目录协议和多用户模型 | 后续 |
| 多平台 | macOS 验证较多 | Windows PATH / PATHEXT、Linux、WSL / SSH 需实测 | P1 |
| E2E / CI | 单测 101 项 + `test:e2e` / `test:ui` 本机脚本 | 仍无 CI；桌面实例的人工项（主题、窄窗口、重启恢复、凭证）无自动化 | P0 |

## 分阶段计划

不绑定发布日期，按三个迭代推进。

### 迭代 1：把现有闭环做可信，补 Token 认证

目标：真实桌面环境可重复验收；需要 API Key / Token 的远程服务可以安全添加。

- 真实 DSH desktop profile 验收：stdio、Streamable HTTP、凭证引用、启停 / 重启 / 删除、重启恢复。
- 把人工验收转为可重复 E2E，接入 CI。
- 补齐保存边界：停用配置、缺失引用、超时阶段、失败诊断。
- 认证探测：401 / 403 由插件归类为「需要认证」。DSH 没有 `needs-auth` 状态，客户端只给 `failed` / `reconnecting` 加文本 `lastError`；2026-11-18 已落地文本口径 `AUTH_FAILURE`（401/403/unauthorized/invalid_token/authenticat），验证时提前结算成「需要认证：…」，实测 2 ms，识别不到时保留原文。
- Token 助手：
  - 粘贴 API Key / Token；
  - 存入 DSH 凭证，不写普通配置；
  - Header 使用 `${credential:...}`；
  - 测试连接、保存、显示认证状态；
  - 提供“重新授权 / 清除凭证”。
- 明确提示：从其他应用导入的配置不会携带 OAuth 登录态。

验收：

- 一个需要 Bearer Token 的远程服务，能在不出现明文密钥的情况下完成添加、测试、保存。
- token 失效时提示重新授权，而不是只报连接失败。
- 导出、日志、错误详情中不出现 token 明文。

### 迭代 2：OAuth 决策与实现

技术决策已经做完（本节为 r2 修订；原 r1 的"先决策三选一"已收敛）：

- seam 可用：`authorization.registerFlow` + `credentials`（grant 记录、`modifyRecord` 带锁读改写）+ 客户端 `credentials/reference-updated` 重连。
- 不用本地代理。MCP 规范那层（PRM → ASM → DCR → PKCE）在插件内实现。
- access token 进 Header 必须先落到 refs：`${credential:NAME}` 只解析 refs 键空间，解析不了 `<owner>/<id>` 记录；refresh 留在 grant 记录里。

实现要覆盖：授权、刷新、过期、撤销、重新授权、账号 / 作用域展示、401 自动重授权（用 `lastError`/probe 文本识别，识别不了就明确报"认证失败但无法确认状态"）。

验收：

- 授权失败、用户取消、token 过期、刷新失败都有明确状态。
- 不把 refresh token 暴露给浏览器或导出文件。
- 不对其他应用导入的登录态做静默迁移。
- 刷新后不需要用户手动重启 DSH 就能继续用（靠 `reference-updated` 重连验证）。

### 迭代 3：管理深度

- 项目作用域与配置归属。
- 诊断日志、stderr、健康检查、自动重连。
- 已安装版本 vs Registry 版本、升级 / 固定版本。
- 备份恢复：来源信息分离、冲突预览。
- 搜索筛选：远程 / 本地、认证类型、包类型、更新时间。
- 安全提示：目录未审核、命令预览、第三方代码警告。

### 后续阶段

- 单工具权限 / 审批（等官方接口）。
- Tool Search（等 DSH 能控制最终工具 Schema）。
- 私有 / 企业目录。
- 团队共享、配置同步。

## 风险与不做

- 不做本地反向代理（凭证轮换已有通路，收益不抵风险）。
- 不把 token 写入普通配置、前端状态或导出文件。
- 不把官方 Registry 当作安全审核或安装背书。
- 不在没有官方权限 seam 的情况下伪造单工具开关。
- 不为了"看起来支持 OAuth"而静默降级成静态 token。
- 不把官方 `@deepseek-ai/*` 包固定进 `dependencies`（会自带第二份客户端，与宿主行为分叉）。

## 下一步

状态（2026-11-18）：桌面 link 安装与第一轮验收已完成；`test:e2e`（stdio + Streamable HTTP + 凭证轮换 + 401）与 `test:ui`（页面主流程）已跑通；401 已按 `AUTH_FAILURE` 文本口径提前结算。

1. **接入 CI**：单测 / check / build / 打包检查上公开 runner；`test:e2e` 与 `test:ui` 上自托管 runner 或夜间任务。这是目前唯一完全空着的工程项。
2. 补桌面实例的人工项：深浅色与窄窗口、重启 DSH 后的配置与失败原因恢复、凭证缺失与凭证服务不可用。
3. 补页面流程分支：重名改名/跳过、env 补全、隐藏值改名、保存后关闭、失败保留、测试取消。
4. 进入认证：Token 助手（凭证写入端点 + 认证状态模型），再按迭代 2 用 `authorization` seam 做 OAuth 授权与刷新。
5. 集成测试里的 DSH 版本不要硬编码，升级时明确报「版本不符」而不是静默失效。