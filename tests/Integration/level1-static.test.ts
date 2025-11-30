/**
 * Level 1 Integration Tests: Static Files
 * 
 * Tests that Thalia can serve static HTML, CSS, and JavaScript files
 * from the public/ directory without any build step or templates.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { startTestServer, stopTestServer, fetchFromServer } from './helpers.js'

const PROJECT = 'test-minimal'

describe('Level 1: Static Files', () => {
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

  test('should serve index.html', async () => {
    const response = await fetchFromServer('/', port)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    
    const html = await response.text()
    expect(html).toContain('Hello from Test Minimal')
    expect(html).toContain('This is a minimal test website')
  })

  test('should serve CSS files', async () => {
    const response = await fetchFromServer('/css/style.css', port)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/css')
    
    const css = await response.text()
    expect(css).toContain('font-family')
    expect(css).toContain('background-color')
  })

  test('should serve JavaScript files', async () => {
    const response = await fetchFromServer('/js/app.js', port)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('javascript')
    
    const js = await response.text()
    expect(js).toContain('DOMContentLoaded')
    expect(js).toContain('getElementById')
  })

  test('should return 404 for non-existent files', async () => {
    const response = await fetchFromServer('/nonexistent.html', port)
    expect(response.status).toBe(404)
  })
})

