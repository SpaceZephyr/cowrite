import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = (relativePath: string) => JSON.parse(readFileSync(path.join(projectRoot, relativePath), 'utf8'))

describe('plugin distribution', () => {
  it('keeps package and both plugin manifests on the same version', () => {
    const packageJson = readJson('package.json')
    const codexPlugin = readJson('.codex-plugin/plugin.json')
    const claudePlugin = readJson('.claude-plugin/plugin.json')
    const claudeMarketplace = readJson('.claude-plugin/marketplace.json')

    expect(codexPlugin.version).toBe(packageJson.version)
    expect(claudePlugin.version).toBe(packageJson.version)
    expect(claudeMarketplace.plugins[0].version).toBe(packageJson.version)
  })

  it('publishes installable Codex and Claude Code marketplaces', () => {
    const codexMarketplace = readJson('.agents/plugins/marketplace.json')
    const claudeMarketplace = readJson('.claude-plugin/marketplace.json')

    expect(codexMarketplace.name).toBe('cowrite')
    expect(codexMarketplace.plugins[0].source).toMatchObject({
      source: 'url',
      url: 'https://github.com/SpaceZephyr/cowrite.git',
      ref: 'main',
    })
    expect(codexMarketplace.plugins[0].policy).toEqual({
      installation: 'AVAILABLE',
      authentication: 'ON_INSTALL',
    })
    expect(claudeMarketplace.name).toBe('cowrite')
    expect(claudeMarketplace.plugins[0].source).toBe('./')
  })

  it('routes both agents through the portable self-starting MCP launcher', () => {
    const codexPlugin = readJson('.codex-plugin/plugin.json')
    const claudePlugin = readJson('.claude-plugin/plugin.json')
    const mcp = readJson('.mcp.json')
    const launcher = mcp.mcpServers.cowrite

    expect(codexPlugin.mcpServers).toBe('./.mcp.json')
    expect(claudePlugin.mcpServers).toBe('./.mcp.json')
    expect(launcher.command).toBe('node')
    expect(launcher.args.join(' ')).toContain('CLAUDE_PLUGIN_ROOT')
    expect(launcher.args.join(' ')).toContain('scripts/start-plugin.mjs')
  })
})
