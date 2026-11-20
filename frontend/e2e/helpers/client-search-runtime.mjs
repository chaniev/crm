import { spawn } from 'node:child_process'
import { createServer, request } from 'node:http'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { once } from 'node:events'

const folder = await mkdtemp(join(tmpdir(), 'task204-browser-'))
const target = join(folder, 'host.json')
const host = spawn('dotnet', ['test', 'backend/tests/GymCrm.Tests/GymCrm.Tests.csproj', '--no-build', '--configuration', 'Release', '--filter', 'FullyQualifiedName~ClientFullNameSearchPostgreSqlTests', '--verbosity', 'quiet'], {
  cwd: resolve('..'), env: { ...process.env, TASK204_BROWSER_HOST_FILE: target }, stdio: ['ignore', 'pipe', 'pipe'],
})
let hostLog = ''
host.stdout.on('data', chunk => { hostLog += chunk })
host.stderr.on('data', chunk => { hostLog += chunk })
let server
let frontend
let closing = false
async function cleanup() {
  if (closing) return
  closing = true
  frontend?.kill('SIGTERM')
  server?.closeAllConnections()
  server?.close()
  await writeFile(target + '.stop', '')
  if (host.exitCode === null) await Promise.race([once(host, 'exit'), delay(15000)])
  if (host.exitCode === null) host.kill('SIGTERM')
  await rm(folder, { recursive: true, force: true })
}
process.on('SIGINT', () => { void cleanup().then(() => process.exit(0)) })
process.on('SIGTERM', () => { void cleanup().then(() => process.exit(0)) })
try {
  let address
  for (let attempt = 0; attempt < 300; attempt++) {
    if (host.exitCode !== null) throw new Error(hostLog)
    try { address = JSON.parse(await readFile(target, 'utf8')).address; break } catch { await delay(200) }
  }
  if (!address) throw new Error('Search fixture did not start: ' + hostLog)
  server = createServer((incoming, outgoing) => {
    const upstream = request(new URL(incoming.url, address), { method: incoming.method, headers: incoming.headers }, response => {
      outgoing.writeHead(response.statusCode, response.headers)
      response.pipe(outgoing)
    })
    upstream.on('error', () => { outgoing.writeHead(502); outgoing.end() })
    incoming.pipe(upstream)
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  frontend = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', process.env.E2E_PORT ?? '3000'], {
    env: { ...process.env, VITE_API_PROXY_TARGET: `http://127.0.0.1:${server.address().port}` }, stdio: 'inherit',
  })
  await once(frontend, 'exit')
} finally { await cleanup() }
