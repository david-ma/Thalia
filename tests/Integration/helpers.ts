/**
 * Test helper utilities for Thalia integration tests
 */

import { Thalia } from '../../server/thalia.js'
import { ServerOptions } from '../../server/types.js'
import { getPort } from 'get-port-please'
import path from 'path'

let testServers: Map<string, { thalia: Thalia; port: number }> = new Map()

export type StartTestServerOpts = {
  /** Explicit port; otherwise an ephemeral free port is chosen. */
  port?: number
  /** Passed to Thalia as `ServerOptions.node_env` (also RequestInfo.node_env). Default `'test'`. */
  node_env?: string
  /**
   * Stop any cached server for this project + node_env before starting.
   * Use for suites that need a clean HTTP stack (e.g. auth) after another describe reused the site.
   */
  fresh?: boolean
}

function testServerCacheKey(project: string, node_env: string): string {
  return `${project}::${node_env}`
}

/**
 * Start a test server for a specific project
 * @param project Project name (must exist in websites/)
 * @param opts Optional port and `node_env` (servers are cached per project **and** node_env)
 * @returns Thalia instance and port number
 */
export async function startTestServer(
  project: string,
  opts?: StartTestServerOpts,
): Promise<{ thalia: Thalia; port: number }> {
  const node_env = opts?.node_env ?? 'test'
  const cacheKey = testServerCacheKey(project, node_env)

  if (opts?.fresh) {
    await stopTestServer(project, { node_env })
  }

  const existing = testServers.get(cacheKey)
  if (existing) {
    return existing
  }

  // Use an arbitrary free port per server. Do not derive the base from only the first
  // character of `project`: names like example-minimal and example-src share 'e' and
  // used to collide on the same narrow portRange, so parallel describe beforeAll hooks
  // could bind the wrong site to the port waitForServerHttp() observed (CI flake).
  const testPort = opts?.port ?? (await getPort({ random: true }))

  // Resolve Thalia repo root from this file (tests/Integration/helpers.ts) so tests
  // work the same whether run from repo root or from a website dir (e.g. websites/kras).
  // Otherwise process.cwd() when run from websites/kras would yield rootPath
  // websites/kras/websites/kras and tryScss would write dist/css/main.css there.
  const thaliaRoot = path.resolve(import.meta.dirname, '../..')
  const rootPath = path.join(thaliaRoot, 'websites', project)

  const options: ServerOptions = {
    node_env,
    project: project,
    port: testPort,
    mode: 'standalone',
    rootPath: rootPath,
  }

  const thalia = await Thalia.init(options)
  await thalia.start()

  const serverInfo = { thalia, port: testPort }
  testServers.set(cacheKey, serverInfo)

  return serverInfo
}

/**
 * Stop a test server started with {@link startTestServer}.
 * @param project Website project name under websites/
 * @param opts Must match the `node_env` used when starting (default `'test'`).
 */
// Bun's hook timeout is 5s by default; keep teardown below that so afterAll doesn't time out.
const STOP_TEST_SERVER_MS = 4_000

export async function stopTestServer(project: string, opts?: Pick<StartTestServerOpts, 'node_env'>): Promise<void> {
  const node_env = opts?.node_env ?? 'test'
  const cacheKey = testServerCacheKey(project, node_env)
  const serverInfo = testServers.get(cacheKey)
  if (serverInfo) {
    const stopPromise = serverInfo.thalia.stop()
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`thalia.stop() exceeded ${STOP_TEST_SERVER_MS}ms`)), STOP_TEST_SERVER_MS),
    )
    try {
      await Promise.race([stopPromise, timeout])
    } catch (err) {
      console.warn(
        `[stopTestServer] ${project} teardown did not finish in ${STOP_TEST_SERVER_MS}ms; continuing. ` +
          (err instanceof Error ? err.message : String(err)),
      )
    }
    testServers.delete(cacheKey)
  }
}

/**
 * Stop all test servers (cleanup)
 */
export async function stopAllTestServers(): Promise<void> {
  const promises = Array.from(testServers.keys()).map((cacheKey) => {
    const sep = cacheKey.indexOf('::')
    const project = sep >= 0 ? cacheKey.slice(0, sep) : cacheKey
    const node_env = sep >= 0 ? cacheKey.slice(sep + 2) : 'test'
    return stopTestServer(project, { node_env })
  })
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
  // Avoid keep-alive sockets keeping the test HTTP server open so httpServer.close() finishes in afterAll.
  if (!headers.has('Connection')) {
    headers.set('Connection', 'close')
  }
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

