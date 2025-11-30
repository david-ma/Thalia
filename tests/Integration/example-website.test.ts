/**
 * Example Minimal Website Integration Test
 * 
 * Tests that the example-minimal website boots up and serves content correctly.
 * This is a lightweight test using the minimal example project (no database required).
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { startTestServer, stopTestServer, fetchFromServer } from './helpers.js'

const PROJECT = 'example-minimal'

describe('Example Minimal Website', () => {
  let port: number

  beforeAll(async () => {
    const serverInfo = await startTestServer(PROJECT)
    port = serverInfo.port
    // Give server a moment to start
    await new Promise(resolve => setTimeout(resolve, 500))
  })

  afterAll(async () => {
    await stopTestServer(PROJECT)
  })

  test('should serve example-minimal website index page', async () => {
    const response = await fetchFromServer('/', port)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    
    const html = await response.text()
    // Check for content that should be in example-minimal website
    expect(html).toContain('Hello from Example Minimal')
    expect(html).toContain('This is a minimal example website')
  })

  test('should serve static assets', async () => {
    // Test CSS
    const cssResponse = await fetchFromServer('/css/style.css', port)
    expect(cssResponse.status).toBe(200)
    expect(cssResponse.headers.get('content-type')).toContain('text/css')
    
    // Test JS
    const jsResponse = await fetchFromServer('/js/app.js', port)
    expect(jsResponse.status).toBe(200)
    expect(jsResponse.headers.get('content-type')).toContain('javascript')
  })

  test('should handle 404s gracefully', async () => {
    const response = await fetchFromServer('/definitely-does-not-exist.html', port)
    expect(response.status).toBe(404)
  })
})

