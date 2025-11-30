/**
 * E2E Tests: Multi-Tenant Routing
 * 
 * Tests that Thalia can serve multiple projects based on domain/Host header.
 * Starts server in multiplex mode with all projects loaded.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { Server } from '../../server/server'
import { Website } from '../../server/website'
import path from 'path'
import { getPort } from 'get-port-please'

const thaliaDirectory = path.resolve(import.meta.dir, '../..')

describe('E2E: Multi-Tenant Routing', () => {
  let server: Server
  let port: number

  beforeAll(async () => {
    // Start server in multiplex mode (all projects)
    port = await getPort({ port: 3200 })
    
    const websites = await Website.loadAllWebsites({
      mode: 'multiplex',
      project: 'default',
      rootPath: path.join(thaliaDirectory, 'websites'),
      port: port,
      node_env: 'test',
    })

    server = new Server({
      mode: 'multiplex',
      project: 'default',
      rootPath: path.join(thaliaDirectory, 'websites'),
      port: port,
      node_env: 'test',
    }, websites)

    await server.start()
    await new Promise(resolve => setTimeout(resolve, 1000))
  })

  afterAll(async () => {
    await server.stop()
  })

  test('server responds with 200 for root path', async () => {
    const response = await fetch(`http://localhost:${port}/`)
    
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html.length).toBeGreaterThan(0)
    expect(html).toContain('html')
  })
})
