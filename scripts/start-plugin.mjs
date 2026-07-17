import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const localPort = Number(process.env.COWRITE_PORT || 4320)
const baseUrl = process.env.COWRITE_URL || `http://127.0.0.1:${localPort}`
const dataDir = process.env.COWRITE_HOME || path.join(homedir(), '.cowrite')
const tsxCli = path.join(rootDir, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const mcpEntry = path.join(rootDir, 'mcp', 'index.ts')
const serverEntry = path.join(rootDir, 'server', 'index.ts')
const distEntry = path.join(rootDir, 'dist', 'index.html')
let webProcess = null
let mcpProcess = null

function run(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    env: { ...process.env, FORCE_COLOR: '0' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.stdout) process.stderr.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}.`)
}

function npmCommand(args) {
  return process.platform === 'win32'
    ? { command: 'cmd.exe', args: ['/d', '/s', '/c', 'npm', ...args] }
    : { command: 'npm', args }
}

function ensurePrepared() {
  if (!existsSync(tsxCli)) {
    const npm = npmCommand(['install'])
    run(npm.command, npm.args, 'npm install')
  }
  if (!existsSync(distEntry)) {
    const npm = npmCommand(['run', 'build'])
    run(npm.command, npm.args, 'npm run build')
  }
}

async function cowriteIsReady() {
  try {
    const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1500) })
    if (!response.ok) return false
    const body = await response.json()
    return body?.ok === true && body?.service === 'cowrite'
  } catch {
    return false
  }
}

function pipeToStderr(child, prefix) {
  child.stdout?.on('data', (chunk) => process.stderr.write(`[${prefix}] ${chunk}`))
  child.stderr?.on('data', (chunk) => process.stderr.write(`[${prefix}] ${chunk}`))
}

async function startWebIfNeeded() {
  if (process.env.COWRITE_URL) {
    if (!(await cowriteIsReady())) throw new Error(`COWRITE_URL is not reachable: ${baseUrl}`)
    return
  }
  if (await cowriteIsReady()) return

  await mkdir(dataDir, { recursive: true })
  webProcess = spawn(process.execPath, [tsxCli, serverEntry], {
    cwd: rootDir,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      COWRITE_PORT: String(localPort),
      COWRITE_DATA: path.join(dataDir, 'cowrite.json'),
      COWRITE_ASSETS: path.join(dataDir, 'assets'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  pipeToStderr(webProcess, 'cowrite-web')

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await cowriteIsReady()) return
    if (webProcess.exitCode !== null) break
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Cowrite could not start at ${baseUrl}. Check whether port ${localPort} is already in use.`)
}

function stopChildren() {
  if (mcpProcess && mcpProcess.exitCode === null) mcpProcess.kill('SIGTERM')
  if (webProcess && webProcess.exitCode === null) webProcess.kill('SIGTERM')
}

async function main() {
  ensurePrepared()
  await startWebIfNeeded()
  process.stderr.write(`[cowrite] Canvas ready at ${baseUrl}\n`)

  mcpProcess = spawn(process.execPath, [tsxCli, mcpEntry], {
    cwd: rootDir,
    env: { ...process.env, COWRITE_URL: baseUrl },
    stdio: ['inherit', 'inherit', 'inherit'],
  })
  mcpProcess.on('error', (error) => {
    process.stderr.write(`[cowrite-mcp] ${error.message}\n`)
    stopChildren()
  })
  const exitCode = await new Promise((resolve) => mcpProcess.on('exit', (code) => resolve(code ?? 1)))
  if (webProcess && webProcess.exitCode === null) webProcess.kill('SIGTERM')
  process.exitCode = exitCode
}

process.on('SIGINT', stopChildren)
process.on('SIGTERM', stopChildren)
process.on('exit', stopChildren)

main().catch((error) => {
  process.stderr.write(`[cowrite] ${error instanceof Error ? error.message : String(error)}\n`)
  stopChildren()
  process.exitCode = 1
})
