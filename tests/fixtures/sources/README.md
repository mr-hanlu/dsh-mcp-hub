# 来源应用的脱敏配置样本

这些文件用来验证「导入其它应用的 MCP 配置」时，各来源真实写法的字段都能被读到、且不静默丢字段。测试见 [tests/sources.test.mjs](../../sources.test.mjs)，它会把这里的文件摆到一个临时 `HOME` 的对应路径上再扫描。

样本分两种来源，**不要混为一谈**：

| 文件 | 来源 | 说明 |
| --- | --- | --- |
| `claude-code.json` | 取自本机 `~/.claude.json`（Claude Code 2.1.71，native 安装） | 结构、字段名与真实文件一致：顶层 `"mcpServers": []`（空数组），真实文件里项目级服务也是空的；这里按 Claude Code 文档补了项目级服务条目。路径、名称、取值全部替换成示例值。 |
| `codex-config.toml` | 取自本机 `~/.codex/config.toml`（Codex CLI 0.125.0） | 保留了真实文件里的写法：相对命令（`./Codex Computer Use.app/...`）、`env_vars = [...]` 转发、`[mcp_servers.x.env]` 表、`startup_timeout_sec`。HTTP 条目里的 `bearer_token_env_var` 与 `env_http_headers` 按 Codex 文档补。 |
| `claude-desktop.json` | 本机 Claude Desktop 的配置文件存在，但**没有 MCP 服务**（只有 `preferences`） | 样本按文档写法整理，未与真实文件逐字段对齐。 |
| `opencode.jsonc`、`gemini-settings.json`、`vscode-mcp.json`、`windsurf-mcp.json`、`copilot-mcp.json` | 本机没有安装这些应用 | 全部按各应用文档的写法整理，只用于验证解析规则，不代表某个具体版本的真实文件。 |

约定：

- 样本里只出现 `example.com`、`/Users/example`、`sk-example-replaced` 这类明显的占位值；新增样本时不要贴真实路径、真实 token 或账号。
- 每个样本都应能被 `scanSources()` 读到（`state: 'read'`），需要用户核对的字段由 `issues` 表达，而不是从条目里消失。
- 需要「某个客户端版本的原始文件」时，请在装了该应用的机器上另存一份并在这里记录应用名与版本。