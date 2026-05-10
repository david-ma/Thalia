/**
 * Test helper utilities for Thalia integration tests
 */

import { Thalia } from '../../server/thalia.js'
import { ServerOptions } from '../../server/types.js'
import { getPort } from 'get-port-please'
import path from 'path'

let testServers: Map<string, { thalia: Thalia; port: number }> = new Map()

/**
 * Start a test server for a specific project
 * @param project Project name (must exist in websites/)
 * @param port Optional port (will find available port if not provided)
 * @returns Thalia instance and port number
 */
export async function startTestServer(
  project: string,
  port?: number,
): Promise<{ thalia: Thalia; port: number }> {
  // Check if server already running for this project
  const existing = testServers.get(project)
  if (existing) {
    return existing
  }

  // Use an arbitrary free port per server. Do not derive the base from only the first
  // character of `project`: names like example-minimal and example-src share 'e' and
  // used to collide on the same narrow portRange, so parallel describe beforeAll hooks
  // could bind the wrong site to the port waitForServerHttp() observed (CI flake).
  let testPort: number
  if (port) {
    testPort = port
  } else {
    testPort = await getPort({ random: true })
  }
  
  // Resolve Thalia repo root from this file (tests/Integration/helpers.ts) so tests
  // work the same whether run from repo root or from a website dir (e.g. websites/kras).
  // Otherwise process.cwd() when run from websites/kras would yield rootPath
  // websites/kras/websites/kras and tryScss would write dist/css/main.css there.
  const thaliaRoot = path.resolve(import.meta.dirname, '../..')
  const rootPath = path.join(thaliaRoot, 'websites', project)

  const options: ServerOptions = {
    node_env: 'test',
    project: project,
    port: testPort,
    mode: 'standalone',
    rootPath: rootPath,
  }

  const thalia = await Thalia.init(options)
  await thalia.start()

  const serverInfo = { thalia, port: testPort }
  testServers.set(project, serverInfo)

  return serverInfo
}

/**
 * Stop a test server
 */
export async function stopTestServer(project: string): Promise<void> {
  const serverInfo = testServers.get(project)
  if (serverInfo) {
    await serverInfo.thalia.stop()
    testServers.delete(project)
  }
}

/**
 * Stop all test servers (cleanup)
 */
export async function stopAllTestServers(): Promise<void> {
  const promises = Array.from(testServers.keys()).map((project) => stopTestServer(project))
  await Promise.all(promises)
}

/**
 * Fetch from a test server
 */
export async function fetchFromServer(url: string, port: number, options?: RequestInit): Promise<Response> {
  const fullUrl = url.startsWith('http') ? url : `http://localhost:${port}${url}`
  // Add Host header to ensure requests go to the right server
  const headers = new Headers(options?.headers)
  headers.set('Host', `localhost:${port}`)
  return fetch(fullUrl, { ...options, headers })
}

const SERVER_READY_DEFAULT_MS = 15_000
const SERVER_READY_POLL_MS = 50

/**
 * Poll until the server accepts TCP and returns any normal HTTP status.
 * Prefer this over fixed `setTimeout` after `startTestServer` so slow CI
 * does not flake while keeping fast machines responsive.
 */
export async function waitForServerHttp(
  port: number,
  url = '/',
  maxWaitMs = SERVER_READY_DEFAULT_MS,
): Promise<Response> {
  const deadline = Date.now() + maxWaitMs
  let lastError: string | undefined
  while (Date.now() < deadline) {
    try {
      const res = await fetchFromServer(url, port)
      if (res.status >= 100 && res.status < 600) {
        return res
      }
    } catch (e: unknown) {
      lastError = e instanceof Error ? e.message : String(e)
    }
    await new Promise((r) => setTimeout(r, SERVER_READY_POLL_MS))
  }
  throw new Error(
    `Server on port ${port} did not accept HTTP within ${maxWaitMs}ms` +
      (lastError ? ` (last error: ${lastError})` : ''),
  )
}

/**
 * Get the base URL for a test server
 */
export function getTestServerUrl(port: number): string {
  return `http://localhost:${port}`
}

