import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const port = 14320 + Math.floor(Math.random() * 500)
const baseUrl = `http://127.0.0.1:${port}`
const dataDir = await mkdtemp(path.join(tmpdir(), 'cowrite-plugin-probe-'))
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mcpConfig = JSON.parse(await readFile(path.join(projectRoot, '.mcp.json'), 'utf8'))
const launcher = mcpConfig.mcpServers.cowrite
const transport = new StdioClientTransport({
  command: launcher.command,
  args: launcher.args,
  cwd: projectRoot,
  env: {
    ...process.env,
    CLAUDE_PLUGIN_ROOT: projectRoot,
    COWRITE_PORT: String(port),
    COWRITE_HOME: dataDir,
  },
  stderr: 'inherit',
})
const client = new Client({ name: 'cowrite-plugin-probe', version: '0.11.0' })

try {
  await client.connect(transport)
  const tools = await client.listTools()
  const names = tools.tools.map((tool) => tool.name)
  for (const required of ['cowrite_get_status', 'cowrite_list_pages', 'cowrite_create_page', 'cowrite_update_page']) {
    if (!names.includes(required)) throw new Error(`Missing MCP tool: ${required}`)
  }

  const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json())
  if (!health.ok || health.service !== 'cowrite') throw new Error('Production web service health check failed.')
  const html = await fetch(baseUrl).then((response) => response.text())
  if (!html.includes('<div id="root">')) throw new Error('Production Cowrite canvas was not served.')

  await client.callTool({
    name: 'cowrite_create_page',
    arguments: { title: 'Plugin probe', content: '# It works' },
  })
  const stored = JSON.parse(await readFile(path.join(dataDir, 'cowrite.json'), 'utf8'))
  if (!stored.pages.some((page) => page.title === 'Plugin probe')) throw new Error('Persistent plugin data was not written.')
  console.log(`OK: install runner, local canvas, persistent data, and ${names.length} MCP tools are ready.`)
} finally {
  await client.close().catch(() => undefined)
  await rm(dataDir, { recursive: true, force: true })
}
