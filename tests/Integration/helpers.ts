/**
 * Test helper utilities for Thalia integration tests
 */

import { Thalia } from '../../server/thalia.js'
import { ServerOptions } from '../../server/types.js'
import { getPort } from 'get-port-please'
import path from 'path'

let testServers: Map<string, { thalia: Thalia; port: number }> = new Map()
let portCounter = 3000 // Start from 3000 and increment to avoid collisions

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

  // Use a unique port for each test to avoid collisions when running in parallel
  let testPort: number
  if (port) {
    testPort = port
  } else {
    // Try to get an available port starting from a base port
    // Use project name hash to get consistent but different ports per project
    const basePort = 3000 + (project.charCodeAt(0) % 1000)
    testPort = await getPort({ port: basePort, portRange: [basePort, basePort + 100] })
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

  // Wait a bit for server to be fully ready
  await new Promise(resolve => setTimeout(resolve, 100))

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

/**
 * Get the base URL for a test server
 */
export function getTestServerUrl(port: number): string {
  return `http://localhost:${port}`
}

