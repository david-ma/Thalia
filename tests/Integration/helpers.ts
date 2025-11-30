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

  const testPort = port || (await getPort())
  const thaliaRoot = process.cwd()
  // Use standalone mode for tests - only load the specific project
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
export async function fetchFromServer(url: string, port: number): Promise<Response> {
  const fullUrl = url.startsWith('http') ? url : `http://localhost:${port}${url}`
  return fetch(fullUrl)
}

/**
 * Get the base URL for a test server
 */
export function getTestServerUrl(port: number): string {
  return `http://localhost:${port}`
}

