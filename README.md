# DSH MCP Hub

> 把散落在各个 AI 客户端里的 MCP 配置，收进 DSH 的一个页面：扫描导入、逐项验证、启停排障，密钥统一交给 DSH 凭证服务保管。

[![CI](https://github.com/mr-hanlu/dsh-mcp-hub/actions/workflows/ci.yml/badge.svg)](https://github.com/mr-hanlu/dsh-mcp-hub/actions/workflows/ci.yml) [![DSH](https://img.shields.io/badge/DSH-0.2.2%E7%B3%BB-4f46e5)](https://github.com/deepseek-ai/deepseek-harness) [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

DSH MCP Hub 是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的设置页插件。它不替代官方 MCP Manager，而是在它之上提供一个更好用的管理面板：你能看到每个服务的真实连接状态、工具清单和失败原因，也能把 Claude Code、Codex、Cursor、Windsurf 等客户端里已经配好的服务一次性搬过来。

当前版本 **0.1.0**，面向 DSH **0.2.2** 系。

## 为什么需要它

MCP 配置通常藏在十几个 JSON / TOML 文件里，改一个命令要翻目录，密钥以明文散落，服务连不上时只能看日志猜。MCP Hub 把这件事收敛成三步：

1. **导入**——自动发现本机已知客户端的配置，或直接粘贴 JSON；
2. **验证**——用官方 `probeServer` 真正握手、拉工具列表，通过才允许保存；
3. **托管**——密钥写入 DSH 凭证服务，配置里只留引用；之后在页面里启停、复诊、看诊断。

## 功能

- **统一管理**：添加、编辑、改名、启停、重启、复诊、删除官方 Manager 中的服务；异常项一键重连。
- **本机配置导入**：扫描 Claude Code / Claude Desktop、Codex、Gemini CLI、VS Code / Copilot、Copilot CLI、Windsurf、Cursor、OpenCode，兼容 TOML / JSON / JSONC 与桌面端、CLI、Server 变体。
- **项目级发现**：读取启动目录下的 `.mcp.json`、`.cursor/mcp.json`、`.vscode/mcp.json` 等，导入时自动加名称后缀，避免跨项目重名。
- **在线搜索**：查询官方 MCP Registry，选 npm / PyPI / OCI / 远程 HTTP 后预填编辑页；**不自动安装、不静默写入**。
- **先测试再保存**：逐行测试、批量一次性写入；失败零写入，已存在同名服务自动跳过。
- **后台验证**：保存即关闭窗口，连接与工具注册在后台完成；失败自动停用并保留原因，不把失败显示成成功。
- **密钥不出现在配置里**：明文在保存时写入 DSH 凭证服务，配置只保留 `${credential:MCPHUB_…}`；支持就地显示 10 秒、复制、行内改密钥。
- **可分享的备份**：导出默认不含密钥，含密钥时文件名明确标注；重新导入能识别“同名同连接、只是缺凭据”的情况。
- **跟随 DSH**：中英双语、`--dsw-alias-*` 主题变量、深浅色与窄窗口适配，作为设置页的一部分存在。
- **无隐藏副作用**：扫描只读配置、不执行启动命令；不修改来源应用的文件；不调用业务工具来探测权限。

## 安装

### 准备

- DSH **0.2.2** 系（当前验证版本 `0.2.2-rc.5`）；
- Node `^22.19.0 || >=24` 与 npm，仅用于构建和测试，插件本身运行在 DSH Host 内；
- 只支持 `stdio` 与 `streamable-http`，`sse` 明确不支持。

```sh
git clone https://github.com/mr-hanlu/dsh-mcp-hub.git
cd dsh-mcp-hub
npm ci
npm run build     # 生成 lib/client.js 与 lib/style.css，插件页加载的就是这两个文件
```

### 方式 A：桌面应用（推荐）

桌面应用独占 `desktop` profile，`dsh plugin` 无法操作它，所以走界面：

1. 打开 DSH → 侧边栏 **插件**；
2. **添加插件** → 输入本仓库的绝对路径（如 `/Users/<you>/Desktop/my/dsh-mcp-hub`）→ 确认；
3. 确认 **MCP Hub** 行为启用状态；
4. 打开 **设置 → MCP Hub**。

本地目录是 **link 安装**：改代码后需要重新 `npm run build` 并重启 DSH 才会生效。

### 方式 B：独立 CLI profile（隔离验证）

```sh
DSH="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"
"$DSH" plugin --profile hub-dev add /Users/<you>/Desktop/my/dsh-mcp-hub
"$DSH" --profile hub-dev --dump-config | grep -n "dsh-mcp-hub"
"$DSH" --profile hub-dev web
```

删除：`"$DSH" plugin --profile hub-dev remove dsh-mcp-hub`。`dsh` 已在 PATH 时可去掉 `DSH=` 前缀。

### 方式 C：tarball（验证真实发布形态）

```sh
npm pack     # prepack 会自动 build
```

在 **添加插件** 里输入 tarball 的绝对路径。tarball 不 link，`files` 白名单生效，适合验证“用户实际装到的包”。

### 装好后确认

- 列表显示官方 Manager 已有服务，且不重复列出插件注册的服务；
- 加一个 stdio 服务：测试连接 → 保存 → 行状态变为「验证通过」，工具数与详情一致；
- 需要 Bearer token 的远程服务：配置里是 `${credential:MCPHUB_…}` 而不是明文，点「显示」能读回值。

## 兼容性

- `package.json` 的 `engines.dsh`（`>=0.2.2-0 <0.3.0-0`）是唯一判据，不满足时 DSH 拒绝加载并列出未满足项。
- 官方包声明为 `peerDependencies`，`devDependencies` 只供本地构建；**link 安装**会优先用仓库的 dev 副本，只有 tarball / 注册表安装才真正使用宿主副本——所以“宿主副本是否兼容”要靠方式 C 验证。
- 确需跨范围验证时使用官方豁免（写入 profile 的 `compatibility.json`，升级后需重新授权）：

```sh
"$DSH" plugin --profile hub-dev allow-version dsh-mcp-hub@0.1.0 --dsh-version 0.2.2-rc.5 --accept-risk
```

## 使用

三个页签：**已添加**、**本地导入**、**在线搜索**。完整说明（扫描范围、验证口径、密钥与导出规则、配置项）见 [使用说明](docs/USAGE.md)。

## 安全与边界

- 扫描只读取配置文件和检查访问权限，**不执行**里面的启动命令；
- 不修改、不持续同步来源应用配置；导入是一次性复制；
- 插件注册的服务只读，继承配置只能停用；不迁移其他 MCP 管理插件的数据；
- 远程服务目前只支持静态 env / headers 与 DSH 凭证引用，**不含 OAuth 登录**；
- 单工具权限管理与 Tool Search 不在本版本范围，界面不保留占位入口。

## 文档

| 文档 | 内容 |
| --- | --- |
| [使用说明](docs/USAGE.md) | 导入、验证、密钥、在线搜索、配置项与已知边界 |
| [测试说明](tests/README.md) | 每层测试做什么、怎么跑、需要什么环境 |
| [开发进度](docs/DEVELOPMENT_PROGRESS.md) | 已完成能力、验证记录与已知问题 |
| [后续任务](docs/NEXT_TASKS.md) | 按优先级排列的下一步工作 |
| [桌面验收清单](docs/DESKTOP_ACCEPTANCE.md) | 只能人工确认的主题、窄窗与官方 Manager 边界 |
| [开发计划](docs/DEVELOPMENT_PLAN_2026-11-17.md) | 认证分层与 OAuth 方案（历史快照） |
| [文档索引](docs/README.md) | 全部文档的用途与阅读顺序 |

## 开发

```sh
npm ci
npm run build
npm test          # 单测
npm run check     # 语法与共享层检查
npm run dev       # 本地预览 http://127.0.0.1:4173（仅开发辅助，不能替代真实验收）
```

端到端测试建临时 `DSH_HOME`、启动真实 Host 或无头 Chrome；怎么跑、环境变量和常见失败见 [测试说明](tests/README.md)。

## License

[MIT](LICENSE)
