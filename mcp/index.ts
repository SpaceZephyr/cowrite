import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'

const baseUrl = process.env.COWRITE_URL || 'http://127.0.0.1:4320'

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options?.headers ?? {}) },
  })
  const data = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(data.error || `Cowrite returned HTTP ${response.status}`)
  return data
}

function toolResult<T extends object>(value: T) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  }
}

export function createCowriteMcpServer() {
  const server = new McpServer({ name: 'cowrite-mcp-server', version: '0.7.1' })

  server.registerTool(
    'cowrite_get_status',
    {
      title: 'Get Cowrite status and canvas URL',
      description: 'Check that the local Cowrite service is ready and return the browser canvas URL. Use when the user asks to start, open, or locate Cowrite.',
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => toolResult({ ...(await api<Record<string, unknown>>('/api/health')), canvasUrl: baseUrl }),
  )

  server.registerTool(
    'cowrite_list_pages',
    {
      title: 'List Cowrite pages',
      description: 'List all pages in the local Cowrite writing canvas (id, title, optional creation prompt, revision, timestamps; content omitted). Pages with a prompt and low revision are usually waiting for the agent to write them. Use this to find valid page IDs before reading or editing.',
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const pages = await api<Record<string, unknown>[]>('/api/pages')
      return toolResult({ total: pages.length, pages })
    },
  )

  server.registerTool(
    'cowrite_get_page',
    {
      title: 'Get one Cowrite page',
      description: 'Read a page including its full Markdown content, creation prompt, and current revision. Always call this immediately before cowrite_update_page: the returned revision is required to write safely.',
      inputSchema: { page_id: z.string().min(1) },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ page_id }) => toolResult(await api<Record<string, unknown>>(`/api/pages/${encodeURIComponent(page_id)}`)),
  )

  server.registerTool(
    'cowrite_create_page',
    {
      title: 'Create a Cowrite page',
      description: 'Create a new page in the Cowrite canvas. Use when the user asks to create an article or document in Cowrite. Write the finished Markdown into content directly; the user sees it in the browser editor immediately.',
      inputSchema: {
        title: z.string().min(1).max(300),
        content: z.string().max(500_000).default('').describe('Markdown content'),
        prompt: z.string().max(5000).optional().describe('Optional: the creation brief this page was written from'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (input) => toolResult(await api<Record<string, unknown>>('/api/pages', { method: 'POST', body: JSON.stringify(input) })),
  )

  server.registerTool(
    'cowrite_update_page',
    {
      title: 'Update a Cowrite page',
      description: 'Update a page title or Markdown content. Content updates use optimistic concurrency: pass the revision from cowrite_get_page as expected_revision. On a revision conflict, read the page again and merge with the latest content instead of overwriting human edits.',
      inputSchema: {
        page_id: z.string().min(1),
        title: z.string().max(300).optional(),
        content: z.string().max(500_000).optional().describe('Complete replacement Markdown content'),
        expected_revision: z.number().int().positive().optional().describe('Required when content is provided'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ page_id, expected_revision, ...patch }) => toolResult(await api<Record<string, unknown>>(`/api/pages/${encodeURIComponent(page_id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...patch, ...(expected_revision !== undefined ? { expectedRevision: expected_revision } : {}) }),
    })),
  )

  server.registerTool(
    'cowrite_upload_asset',
    {
      title: 'Upload a local asset to Cowrite',
      description: 'Copy a local image, self-contained HTML, PPTX, or PDF into Cowrite\'s asset store. Returns a /assets/... url that can be embedded or linked in page content. Use after generating an illustration, explainer, or slide deck locally.',
      inputSchema: { path: z.string().min(1).describe('Absolute path to the local file') },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ path }) => toolResult(await api<Record<string, unknown>>('/api/assets', { method: 'POST', body: JSON.stringify({ path }) })),
  )

  server.registerTool(
    'cowrite_insert_after',
    {
      title: 'Insert a block after anchor text',
      description: 'Insert a Markdown block (e.g. an image ![..](/assets/x.png) or an <iframe> for an HTML explainer) right after the paragraph that contains the anchor text. The anchor must be an exact substring of the current page content; read the page first. Requires expected_revision. Use this to place illustrations at the position the user selected, without touching the rest of the page.',
      inputSchema: {
        page_id: z.string().min(1),
        anchor: z.string().min(1).max(2000).describe('Exact substring of the current content marking the insertion point'),
        markdown: z.string().min(1).max(100_000).describe('The block to insert (Markdown or a single HTML block)'),
        expected_revision: z.number().int().positive(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ page_id, anchor, markdown, expected_revision }) => toolResult(await api<Record<string, unknown>>(`/api/pages/${encodeURIComponent(page_id)}/insert`, {
      method: 'POST',
      body: JSON.stringify({ anchor, markdown, expectedRevision: expected_revision }),
    })),
  )

  return server
}

async function main() {
  const server = createCowriteMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
