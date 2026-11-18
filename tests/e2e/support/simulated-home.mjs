/**
 * 造一个「装了各种 MCP 客户端」的假 HOME，用来验证本机导入与密钥处理。
 *
 * 这里刻意把密钥的各种写法都放进去：明文、`${env:X}`、`{env:X}`、`${X}`、
 * Codex 的 `bearer_token_env_var` / `env_http_headers` / `env_vars`、停用项、
 * 需要核对的未知字段，以及一个环境里没有值的引用。
 *
 * 所有条目都指向受控的 echo 服务，导入后能真的连上，而不是只验证解析。
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** 假 HOME 里各来源的路径（macOS 布局），与 src/host/config.js 的探测路径一致。 */
export const SIMULATED_PATHS = {
  claude: '.claude.json',
  codex: '.codex/config.toml',
  opencode: '.config/opencode/opencode.jsonc',
  gemini: '.gemini/settings.json',
  cursor: '.cursor/mcp.json',
  desktop: 'Library/Application Support/Claude/claude_desktop_config.json',
  vscode: 'Library/Application Support/Code/User/mcp.json',
  copilot: '.copilot/mcp-config.json',
  windsurf: '.codeium/windsurf/mcp_config.json',
};

/** 验证时要用的宿主环境变量：引用能解析的、和故意不存在的。 */
export const SIMULATED_ENV = {
  SHARED_TOKEN: 'shared-secret-value',
  BARE_TOKEN: 'bare-secret-value',
  DOCS_TOKEN: 'docs-token-value',
  TENANT_ID: 'tenant-a',
  CATALOG_KEY: 'catalog-key-value',
  SEARCH_TOKEN: 'search-token-value',
};

const json = value => JSON.stringify(value, null, 2);

/**
 * @param {object} options
 * @param {string} options.root - 假 HOME 的目录（应为临时目录）。
 * @param {string} options.stdioFixture - 受控 stdio MCP 脚本的绝对路径。
 * @param {string} options.cwd - stdio 服务的工作目录。
 * @param {string} options.authUrl - 需要 Bearer 的受控 HTTP MCP 地址。
 * @param {string} options.openUrl - 不校验认证的受控 HTTP MCP 地址。
 * @returns {Promise<{home: string, files: string[]}>}
 */
export async function buildSimulatedHome({ root, stdioFixture, cwd, authUrl, openUrl }) {
  const node = process.execPath;
  const write = async (path, text) => {
    const target = join(root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, text);
    return target;
  };
  const stdio = extra => ({ command: node, args: [stdioFixture], cwd, ...extra });

  const files = [];
  // Claude Desktop：一条明文密钥，一条已停用。
  files.push(await write(SIMULATED_PATHS.desktop, json({
    mcpServers: {
      'sim-desktop-plain': stdio({ env: { WIKI_API_KEY: 'sk-live-desktop-secret' } }),
      'sim-desktop-disabled': stdio({ disabled: true }),
    },
    preferences: { sidebarMode: 'chat' },
  })));

  // Claude Code：顶层 `${env:X}` 引用，项目级 `${X}` 简写。
  files.push(await write(SIMULATED_PATHS.claude, json({
    numStartups: 3,
    installMethod: 'native',
    mcpServers: { 'sim-claude-ref': stdio({ env: { GITHUB_TOKEN: '${env:SHARED_TOKEN}' } }) },
    projects: {
      '/Users/sim/work/shop': { mcpServers: { 'sim-claude-bare': stdio({ env: { TOKEN: '${BARE_TOKEN}' } }) } },
    },
  })));

  // Codex：Bearer 环境变量 + env 请求头；env_vars 转发；以及一条相对命令（本机跑不起来）。
  files.push(await write(SIMULATED_PATHS.codex, [
    'model = "gpt-5-codex"',
    '',
    '[mcp_servers.sim-codex-http]',
    `url = "${authUrl}"`,
    'bearer_token_env_var = "DOCS_TOKEN"',
    'startup_timeout_sec = 20',
    '',
    '[mcp_servers.sim-codex-http.env_http_headers]',
    'X-Tenant-Id = "TENANT_ID"',
    '',
    '[mcp_servers.sim-codex-stdio]',
    `command = "${node}"`,
    `args = ["${stdioFixture}"]`,
    `cwd = "${cwd}"`,
    'env_vars = ["SHARED_TOKEN"]',
    '',
    '[mcp_servers.sim-codex-stdio.env]',
    'SIM_MODE = "1"',
    '',
    '[mcp_servers.sim-codex-relative]',
    'command = "./Tools/missing-binary"',
    'args = ["mcp"]',
    '',
  ].join('\n')));

  // OpenCode：JSONC 注释 + 新容器；local 用命令数组，remote 用单花括号引用。
  files.push(await write(SIMULATED_PATHS.opencode, `{
  // 模拟 OpenCode 的全局配置
  "mcp": {
    "servers": {
      "sim-opencode-local": {
        "type": "local",
        "command": ["${node}", "${stdioFixture}"],
        "environment": { "MATH_TOKEN": "plain-math-secret", "SIM_MODE": "2" }
      },
      "sim-opencode-remote": {
        "type": "remote",
        "url": "${openUrl}",
        "headers": { "X-Api-Key": "{env:CATALOG_KEY}" }
      }
    }
  }
}
`));

  // Gemini CLI：httpUrl + Bearer 引用，另有单位不明的 timeout 与 trust 需要核对。
  files.push(await write(SIMULATED_PATHS.gemini, json({
    theme: 'Default',
    mcpServers: {
      'sim-gemini-http': {
        httpUrl: openUrl,
        headers: { Authorization: 'Bearer ${SEARCH_TOKEN}' },
        timeout: 30000,
        trust: true,
      },
    },
  })));

  // VS Code：envFile 是不可迁移字段；另一条引用在环境里没有值。
  files.push(await write(SIMULATED_PATHS.vscode, json({
    inputs: [],
    servers: {
      'sim-vscode-local': { type: 'stdio', command: node, args: [stdioFixture], cwd, envFile: '${workspaceFolder}/.env' },
      'sim-vscode-missing': stdio({ env: { TOKEN: '${env:SIM_NOT_CONFIGURED}' } }),
    },
  })));

  // Copilot CLI：与 Codex 那条是完全相同的连接（地址 + 两个认证头），
  // 只是名字不同——用来验证「跨来源的重复配置」能否被认出来。
  files.push(await write(SIMULATED_PATHS.copilot, json({
    mcpServers: {
      'sim-copilot-http': {
        type: 'http',
        url: authUrl,
        headers: { Authorization: 'Bearer ${env:DOCS_TOKEN}', 'X-Tenant-Id': '${env:TENANT_ID}' },
      },
    },
  })));

  files.push(await write(SIMULATED_PATHS.windsurf, json({ mcpServers: { 'sim-windsurf-local': stdio({}) } })));
  files.push(await write(SIMULATED_PATHS.cursor, json({ mcpServers: { 'sim-cursor-local': stdio({ env: { CURSOR_TOKEN: 'plain-cursor-secret' } }) } })));

  return { home: root, files };
}