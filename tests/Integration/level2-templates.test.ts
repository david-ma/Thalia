/**
 * Level 2 Integration Tests: Handlebars Templates
 * 
 * Tests that Thalia can render Handlebars templates with partials
 * from the src/ directory.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { startTestServer, stopTestServer, fetchFromServer } from './helpers.js'

const PROJECT = 'example-src'

describe('Level 2: Handlebars Templates', () => {
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

  test('should render Handlebars template', async () => {
    // Templates are served when requesting .html paths
    const response = await fetchFromServer('/index.html', port)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    
    const html = await response.text()
    expect(html).toContain('Welcome to Test Templates')
    expect(html).toContain('This website uses Handlebars templates')
  })

  test('should include header partial', async () => {
    const response = await fetchFromServer('/index.html', port)
    const html = await response.text()
    
    expect(html).toContain('Test Templates Site')
    expect(html).toContain('<header>')
    expect(html).toContain('<nav>')
  })

  test('should include footer partial', async () => {
    const response = await fetchFromServer('/index.html', port)
    const html = await response.text()
    
    expect(html).toContain('Footer content from partial')
    expect(html).toContain('<footer>')
  })

  test('should render template variables', async () => {
    const response = await fetchFromServer('/index.html', port)
    const html = await response.text()
    
    // Template should render {{time}} variable (from requestInfo)
    expect(html).toContain('Current time:')
    // Should not contain the literal {{time}}
    expect(html).not.toContain('{{time}}')
  })
})

