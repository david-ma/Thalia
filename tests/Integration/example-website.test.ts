/**
 * Lightweight static example integration tests.
 * 
 * Tests that the example-minimal website boots up and serves content correctly.
 * This is a lightweight test using the minimal example project (no database required).
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { startTestServer, stopTestServer, fetchFromServer, waitForServerHttp } from './helpers.js'

const PROJECT = 'example-minimal'

describe('Example Minimal Website', () => {
  let port: number

  beforeAll(async () => {
    const serverInfo = await startTestServer(PROJECT)
    port = serverInfo.port
    await waitForServerHttp(port)
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

describe('Example Agency reference website', () => {
  const project = 'example-agency'
  let port: number

  beforeAll(async () => {
    const serverInfo = await startTestServer(project)
    port = serverInfo.port
    await waitForServerHttp(port)
  })

  afterAll(async () => {
    await stopTestServer(project)
  })

  test('serves the static upstream visual reference', async () => {
    const response = await fetchFromServer('/', port)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('<title>Agency - Start Bootstrap Theme</title>')
    expect(html).toContain('startbootstrap-agency')
  })

  test('serves its independent static stylesheet', async () => {
    const response = await fetchFromServer('/css/styles.css', port)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/css')
    expect((await response.text()).length).toBeGreaterThan(10_000)
  })
})
