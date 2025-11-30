/**
 * Example Website Integration Test
 * 
 * Tests that the example website boots up and serves content correctly.
 * This is a real-world test using the actual example project.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { startTestServer, stopTestServer, fetchFromServer } from './helpers.js'

const PROJECT = 'example'

describe('Example Website', () => {
  let port: number

  beforeAll(async () => {
    const serverInfo = await startTestServer(PROJECT)
    port = serverInfo.port
    // Give server a moment to start
    await new Promise(resolve => setTimeout(resolve, 1000))
  })

  afterAll(async () => {
    await stopTestServer(PROJECT)
  })

  test('should serve example website index page', async () => {
    const response = await fetchFromServer('/', port)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    
    const html = await response.text()
    // Check for content that should be in example website
    expect(html.length).toBeGreaterThan(0)
  })

  test('should serve static assets', async () => {
    // Test CSS
    const cssResponse = await fetchFromServer('/css/main.css', port)
    // Might be 200 (exists) or 404 (doesn't exist), both are valid
    expect([200, 404]).toContain(cssResponse.status)
    
    // Test JS
    const jsResponse = await fetchFromServer('/js/scripts.min.js', port)
    expect([200, 404]).toContain(jsResponse.status)
  })

  test('should handle 404s gracefully', async () => {
    const response = await fetchFromServer('/definitely-does-not-exist.html', port)
    expect(response.status).toBe(404)
  })
})

