/**
 * Level 2 Integration Tests: Handlebars Templates
 *
 * `src/views/level2-home.hbs` is served as `/views/level2-home` (no dist/public collision).
 *
 * `/index.html` behaviour depends on **ServerOptions.node_env** (also RequestInfo.node_env):
 * - `development`: `dist/*.html` is skipped so static HTML can fall through to Handlebars or `public/`.
 * - anything else (e.g. `test`, `production`): `dist/index.html` is served when present.
 *
 * The dist skip uses `requestInfo.node_env`, not `process.env.NODE_ENV`, so tests stay deterministic.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { startTestServer, stopTestServer, fetchFromServer, waitForServerHttp } from './helpers.js'

const PROJECT = 'example-src'
/** Path that maps to `src/views/level2-home.hbs` via tryHandlebars (no dist/public collision). */
const LEVEL2_PATH = '/views/level2-home'

async function expectLevel2HomePage(port: number): Promise<void> {
  const response = await fetchFromServer(LEVEL2_PATH, port)
  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toContain('text/html')

  const html = await response.text()
  expect(html).toContain('Welcome to Test Templates')
  expect(html).toContain('This website uses Handlebars templates')
  expect(html).toContain('Test Templates Site')
  expect(html).toContain('<header>')
  expect(html).toContain('<nav>')
  expect(html).toContain('Footer content from partial')
  expect(html).toContain('<footer>')
  // `{{time}}` omitted from template data unless provided; should not appear literally.
  expect(html).toContain('Current time:')
  expect(html).not.toContain('{{time}}')
}

describe('Level 2: Handlebars (node_env=development)', () => {
  let port: number

  beforeAll(async () => {
    const serverInfo = await startTestServer(PROJECT, { node_env: 'development' })
    port = serverInfo.port
    await waitForServerHttp(port)
  })

  afterAll(async () => {
    await stopTestServer(PROJECT, { node_env: 'development' })
  })

  test('serves level2 home template with partials', async () => {
    await expectLevel2HomePage(port)
  })

  test('/index.html: dist HTML skipped, then public/index.html when no src/index.hbs', async () => {
    const response = await fetchFromServer('/index.html', port)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('public/index.html')
  })
})

for (const node_env of ['test', 'production'] as const) {
  describe(`Level 2: Handlebars (node_env=${node_env})`, () => {
    let port: number

    beforeAll(async () => {
      const serverInfo = await startTestServer(PROJECT, { node_env })
      port = serverInfo.port
      await waitForServerHttp(port)
    })

    afterAll(async () => {
      await stopTestServer(PROJECT, { node_env })
    })

    test('serves level2 home template with partials', async () => {
      await expectLevel2HomePage(port)
    })

    test('/index.html: dist/index.html wins when present', async () => {
      const response = await fetchFromServer('/index.html', port)
      expect(response.status).toBe(200)
      const html = await response.text()
      expect(html).toContain('dist version')
    })
  })
}
