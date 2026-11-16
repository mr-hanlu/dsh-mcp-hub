# DSH MCP Hub

DSH 的 MCP 可视化管理与本机配置导入插件。第一版提供「已添加」「本地导入」，页面使用可展开的服务列表，跟随 DSH 设置页使用。

当前首版版本号为 **0.1.0**。开发状态与验证边界见 [开发进度](docs/DEVELOPMENT_PROGRESS.md)，下一阶段工作见 [后续任务](docs/NEXT_TASKS.md)。开发期间的本地临时编号不计入正式发布历史。

## 功能

- 管理官方 MCP Manager 中的服务：添加、编辑、改名、启停、重启、复诊、删除，异常项可一键重连。
- 展开查看连接状态、配置、工具描述与参数 JSON Schema、连接诊断；工具参数在展开那一行时才读取，列表只带摘要。
- 状态实时推送：页面用长轮询等待 Host 的变化通知，不再按固定间隔整页刷新。
- 读取 Codex、Claude Code、OpenCode、Cursor 的已知全局配置位置，并扫描当前启动目录下的 `.mcp.json`、`.cursor/mcp.json`、`.vscode/mcp.json`；兼容 TOML、JSON、JSONC。
- 手动选择配置文件，逐项导入；按连接配置和认证上下文检测重复，提示同名冲突。
- 导入前检查运行环境、命令、工作目录、环境变量引用、请求头；支持表单和 JSON 编辑。
- 添加时等待 DSH 正式连接及工具注册，未通过不会显示添加成功。
- 失败配置保留供修复，并尝试停用；编辑已停用的服务时保持停用，新建服务默认启用（启停只由列表里的开关控制）。
- 导出一份不含凭据字段的配置备份；备份里被省略的凭据会写成明确的中文占位符，不会把 `••••••••` 原样恢复成配置值。连接状态与诊断信息直接显示在服务行和详情页，不再单独导出。

## 安装

需要提供官方 `mcpManager`、`settings`、`configEditor`、`tools`、`profileContext` 和 Connection Fetch 路由的 DSH 0.2.2。真实集成测试使用官方 **0.2.2-rc.3** 包。

```sh
npm ci
npm run build
npm pack
dsh plugin --profile desktop add ./dsh-mcp-hub-0.1.0.tgz
```

打开 DSH **设置 → MCP Hub**。Web 用户将 profile 改为 `web`。如果使用桌面应用自带的 CLI，请使用其已配置的 `dsh` 命令执行安装。

未自动安装进现有 DSH profile。安装不迁移或删除其他 MCP 管理插件的配置；Hub 只管理官方 Manager 所拥有的服务。插件注册的服务只读，继承配置只能停用，不能通过此页删除。静态 mcp-client 与 Agent preset 中的服务不属于官方 Manager 的完整管理范围。

## 本地界面预览

```sh
npm run dev
```

访问 <http://127.0.0.1:4173>（页面标题为「界面预览」）。预览的初始列表是示例数据；点击「测试连接」或添加启用的服务时，会在本机真实启动 / 连接 MCP，完成握手和工具发现后关闭连接。不会写入现有 DSH 配置，预览列表仅在当前页面会话中保存；不再模拟连接成功。普通环境变量引用读取预览进程环境，DSH 凭证引用需要在实际 DSH 中验证。

## 导入与验证

1. 页面连接 DSH 后自动扫描，本地导入只显示包含 MCP 配置的来源，也可选择配置文件或重新扫描。读取失败单独提示；缺失文件和空来源不显示。扫描仅读取配置和检查文件访问，不执行启动命令。
2. 展开应用，选择服务，核对名称、启动命令、参数、目录和环境变量。
3. 点击「添加」或「保存」，在 Host 环境检查配置并写入 DSH，窗口立即关闭；连接与工具注册在后台验证，结果作为服务行的「验证中 / 验证通过 / 验证失败」显示，可从该行取消验证。验证结论会写入本机记录，重启 DSH 后仍能看到上次的失败原因。
4. 只有正式连接状态为 `connected`，且注册工具数与 Manager 报告一致，才显示成功。零工具服务允许连接成功；不自动调用业务工具来探测所有操作权限。
5. 「复诊」对已有条目（包括已停用的）调用官方 `mcpManager.probe`，不触碰正在运行的实例，结果同样写入服务行。

扫描发生在 **DSH Host 所在机器**。不会复用来源应用的运行进程，也不会修改或持续同步来源配置。

配置来源：

| 应用 | 默认全局配置 |
| --- | --- |
| Codex | `~/.codex/config.toml`，识别 `CODEX_HOME` |
| Claude Code | `~/.claude.json`（含 `projects.<目录>.mcpServers` 的项目级服务，导入时自动加名称后缀） |
| OpenCode | `~/.config/opencode/opencode.json(c)`，识别 `XDG_CONFIG_HOME` 和 `OPENCODE_CONFIG` |
| Cursor | `~/.cursor/mcp.json` |
| 当前项目 | 启动目录下的 `.mcp.json`、`.cursor/mcp.json`、`.vscode/mcp.json` |

配置文件读取上限 2 MB，手动选择文件上限 200 KB。项目级扫描只读启动目录下的三个已知文件，不递归遍历。相对启动参数需要明确工作目录；桌面 Host 的 PATH 可能不同于终端，请根据检查结果填写可执行文件绝对路径。

支持 `${NAME}`、`${env:NAME}`、`{env:NAME}` 环境变量引用，保存时会改写成 DSH 的 `${credential:NAME}` 模板，由官方凭证服务在连接时解析；配置里不写入密钥明文。来源应用自己的 OAuth 状态不会迁移。未知字段需要明确核对后才允许忽略；旧 SSE 不能通过忽略检查转换成 HTTP。

敏感配置默认不返回明文，编辑未修改的隐藏值会在 Host 恢复原值。引用是否存在于运行环境仍会检查，但只在测试连接时于内存中取值，不写回配置。确实需要把当前值写进配置时，把插件配置项 `referenceStorage` 设为 `value`。来源记录只包含应用、路径和时间，保存于 `$DSH_HOME/mcp-hub/<profile>/sources.json`。

## 编辑与反馈规则

- 删除使用模态确认框。增删改后重新计算导入项状态，不需要重新扫描，不会让删除后的来源项继续标为已添加。
- 普通 args 直接显示，按独立参数编辑，保留空格和空参数；疑似 token、密码、密钥等参数才隐藏。敏感值可在编辑窗口中点击「显示」读取，普通列表不返回其明文。
- 环境变量和请求头支持直接填写、环境变量引用、DSH 凭证引用，检查后逐项标识缺失的引用。Authorization 的引用模式采用 Bearer 前缀；其他认证格式可直接填写或通过 JSON 编辑。
- 测试连接或保存后，编辑窗口会显示「将写入 DSH 的配置」，并列出与来源配置的字段级差异（命令会被改写成绝对路径、引用会变成凭证模板）。来源配置本身不会被写入。
- JSON 编辑、配置文件导入和本机扫描共用解析规则。支持单个对象、`{服务名: 配置}`、`mcpServers`、`mcp_servers`、`servers` 和 OpenCode 容器；推断 stdio / HTTP 并保留 env。多个服务必须选择，不会只取第一项。普通单个对象没有服务名称时，需要手动命名。
- 「测试连接」使用官方 `probeServer` 实际执行 MCP 握手、工具发现和连接清理，不保存配置、不注册工具到会话。字段或变量检查未通过时不执行启动命令；可执行文件存在但不实现 MCP 时也会失败。服务名称是本地别名，连接测试验证的是命令或地址是否提供 MCP。
- 编辑已停用服务后仍保持停用（弹窗不再提供启用开关）；切换传输方式时保留该窗口内各自填写的内容。配置版本冲突会拒绝写入，并可在窗口内「同步最新版本」后继续保存，不必丢掉已经填好的内容。
- 变量与参数行用稳定标识渲染，删除中间一行不会串位；取消编辑直接关闭，不做二次确认。
- 编辑窗口里始终显示「将写入 DSH 的配置」与字段级差异；配置里不会出现自动补上的工作目录（留空就由 DSH 决定）。
- 成功反馈使用约 3.5 秒后关闭的轻提示，悬停或聚焦时暂停消失；错误保留供用户处理。保存成功不再要求额外点击「完成」。
- 验证在后台完成：保存不再阻塞等待，失败会自动停用该服务并保留原因。诊断页显示重试次数、下次重试时间、连接清理是否确认，以及官方的停止原因（重连预算耗尽、清理未完成等）。

## 开发与测试

```sh
npm test
npm run check
npm run build
```

单元测试覆盖配置解析、脱敏往返、环境变量与凭据判定、项目级导入、冲突、失败状态、Schema 默认值、旧连接误判、工具注册等待、坏条目容错、验证结果持久化、推送通道、复诊和官方 Fetch 路由注册（当前 70 项）。

真实集成测试在临时 profile 中启动受控 MCP 子进程，验证官方 Settings 持久化、连接、工具注册、重复检测和停用。依赖安装在独立目录，不随插件发布：

```sh
npm install --prefix /tmp/dsh-mcp-hub-smoke --ignore-scripts \
  @deepseek-ai/cordis \
  @deepseek-ai/dsh-mcp-manager@0.2.2-rc.3 \
  @deepseek-ai/dsh-app-boot@0.2.2-rc.3 \
  @deepseek-ai/dsh-config-editor@0.2.2-rc.3 \
  @deepseek-ai/dsh-settings@0.2.2-rc.3
DSH_TEST_MODULES=/tmp/dsh-mcp-hub-smoke npm run test:integration
```

Host 通过官方 `connection.fetch.register` 注册仅 owner 可访问、位于 `/api` 下的精确路由；桌面页面和 Web 页面都经同一条本地 HTTP 通道访问，没有单独的桌面 IPC 分发路径。配置修改通过 `settings.mutate` 携带 revision，连接生命周期由 `mcpManager` 管理。已知失败原因返回结构化 `code`，未知异常只记日志并返回通用提示。

## 配置项

以下值可在 profile 的 `cordis.patch.yml` 中覆盖，用户层配置会跨插件升级保留：

| 配置 | 默认值 | 含义 |
| --- | --- | --- |
| `connectWaitMs` | `45000` | 保存后等待正式连接与工具注册的基础预算；条目声明了更大的 `startupTimeoutMs` 时自动放宽 |
| `probeTimeoutMs` | `20000` | 测试连接时握手与工具发现的预算 |
| `verifyPollMs` | `1000` | 验证期间读取运行状态的兜底间隔；状态事件会立即触发结算 |
| `descriptorTtlMs` | `1500` | 配置视图缓存时间；写入后立即失效 |
| `maxConfigBytes` | `2097152` | 单个配置文件与请求体上限 |
| `referenceStorage` | `template` | `template` 保留 `${credential:…}`；`value` 保存时写入当前值 |

配色直接引用 DSH 官方 `--dsw-alias-*` 主题变量，覆盖背景层次、文字、边框、按钮、开关及成功 / 警告 / 错误状态，支持深浅色主题。独立预览采用对应的回退色值。

## 后续范围

在线搜索发现、完整 OAuth 登录、单工具权限管理与 Tool Search 不包含在此版本，界面上也不保留相应占位入口。项目级发现只覆盖启动目录下的三个已知文件，不递归遍历，也不能在界面里切换扫描范围；配置备份不包含凭据字段，恢复依赖「本地导入」。

## 官方参考

- [MCP Manager](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/mcp/mcp-manager)
- [Settings](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/settings/settings)
- [Connection](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/client/connection)
- [插件打包与安装](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)
