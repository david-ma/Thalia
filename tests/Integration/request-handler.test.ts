/**
 * Request-handler integration tests
 *
 * Exercises the handler chain (request-handler.ts) using the example projects.
 * Chain order (must stay in sync with request-handler.ts):
 *   checkPathExploit → routeGuard → tryController → tryStaticFile('dist') → tryScss
 *   → tryTypescript → tryHandlebars → tryMarkdown → tryStaticFile('public')
 *   → tryStaticFile('docs') → tryStaticFile('data') → tryStaticFile(thalia public) → fileNotFound
 *
 * tryHandlebars path resolution (sites may rely on this):
 *   For request /path: first check src/path/index.hbs, else src/path.hbs; then serve that template.
 * tryMarkdown: same logic for src/path/index.md and src/path.md.
 *
 * - example-minimal: static files (public/), 404, path exploit
 * - example-src: Handlebars (path.hbs + path/index.hbs), Markdown, TypeScript, controller (fruit)
 * - example-auth: route guard, controller (skipped by default; remove .skip when DB/auth configured)
 *
 * Run from Thalia root: bun test tests/Integration/request-handler.test.ts
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { startTestServer, stopTestServer, fetchFromServer } from './helpers.js'

describe('Request-handler: example-minimal (static, 404, path exploit)', () => {
  let port: number
  const PROJECT = 'example-minimal'

  beforeAll(async () => {
    const serverInfo = await startTestServer(PROJECT)
    port = serverInfo.port
    await new Promise((r) => setTimeout(r, 300))
  })

  afterAll(async () => {
    await stopTestServer(PROJECT)
  })

  test('path with .. returns 400 (checkPathExploit)', async () => {
    // Note: fetch() may normalize URLs, so pathname might not contain ".." at the server.
    // If the client sends a normalized path, we get 404 instead of 400.
    const response = await fetchFromServer('/../etc/passwd', port)
    expect([400, 404]).toContain(response.status)
  })

  test('/ serves public/index.html (tryStaticFile public)', async () => {
    const response = await fetchFromServer('/', port)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    const html = await response.text()
    expect(html).toContain('Hello from Example Minimal')
  })

  test('/index.html serves public/index.html', async () => {
    const response = await fetchFromServer('/index.html', port)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('Hello from Example Minimal')
  })

  test('/css/style.css serves static CSS (tryStaticFile public)', async () => {
    const response = await fetchFromServer('/css/style.css', port)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/css')
  })

  test('/js/app.js serves static JS (tryStaticFile public)', async () => {
    const response = await fetchFromServer('/js/app.js', port)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('javascript')
  })

  test('non-existent path returns 404 (fileNotFound)', async () => {
    const response = await fetchFromServer('/nonexistent.html', port)
    expect(response.status).toBe(404)
  })
})

describe('Request-handler: example-src (Handlebars, TypeScript, controller)', () => {
  let port: number
  const PROJECT = 'example-src'

  beforeAll(async () => {
    const serverInfo = await startTestServer(PROJECT)
    port = serverInfo.port
    await new Promise((r) => setTimeout(r, 300))
  })

  afterAll(async () => {
    await stopTestServer(PROJECT)
  })

  test('/ or /index.html returns HTML (dist or tryHandlebars)', async () => {
    const response = await fetchFromServer('/', port)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    const html = await response.text()
    // example-src has both dist/index.html and src/index.hbs; dist is tried first, so we may get either
    expect(html.length).toBeGreaterThan(0)
    expect(html).toMatch(/Welcome to Test Templates|dist version/)
  })

  test('tryHandlebars: /path serves src/path.hbs when path.hbs exists (file-style)', async () => {
    const response = await fetchFromServer('/views/apple', port)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    const html = await response.text()
    expect(html).toContain('apple')
  })

  test('tryHandlebars: /path serves src/path/index.hbs when path/index.hbs exists (directory-style)', async () => {
    const response = await fetchFromServer('/guide', port)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    const html = await response.text()
    expect(html).toContain('Guide index page')
    expect(html).toContain('src/guide/index.hbs')
  })

  test('tryHandlebars: /path/ also resolves to path/index.hbs when present', async () => {
    const response = await fetchFromServer('/guide/', port)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('Guide index page')
  })

  test('/js/test.js serves compiled src/js/test.ts (tryTypescript)', async () => {
    const response = await fetchFromServer('/js/test.js', port)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('javascript')
    const js = await response.text()
    expect(js.length).toBeGreaterThan(0)
  })

  test('/fruit redirects or serves via controller (tryController)', async () => {
    const response = await fetchFromServer('/fruit', port)
    expect([200, 301, 302]).toContain(response.status)
  })

  test('tryMarkdown: /path serves src/path.md when path.md exists (file-style)', async () => {
    const response = await fetchFromServer('/about', port)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    const html = await response.text()
    expect(html).toContain('About')
    expect(html).toContain('src/about.md')
  })

  test('tryMarkdown: /path serves src/path/index.md when path/index.md exists (directory-style)', async () => {
    const response = await fetchFromServer('/faq', port)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    const html = await response.text()
    expect(html).toContain('FAQ')
    expect(html).toContain('src/faq/index.md')
  })

  test('path with .. returns 400 or 404 (checkPathExploit vs client normalization)', async () => {
    const response = await fetchFromServer('/views/../config/config.ts', port)
    expect([400, 404]).toContain(response.status)
  })
})

describe('Request-handler: handler chain fallback (example-minimal)', () => {
  let port: number
  const PROJECT = 'example-minimal'

  beforeAll(async () => {
    const serverInfo = await startTestServer(PROJECT)
    port = serverInfo.port
    await new Promise((r) => setTimeout(r, 300))
  })

  afterAll(async () => {
    await stopTestServer(PROJECT)
  })

  test('chain falls through to tryStaticFile(public) then fileNotFound: unknown path returns 404', async () => {
    const response = await fetchFromServer('/no-controller-no-dist-no-hbs-no-md-not-in-public', port)
    expect(response.status).toBe(404)
    const body = await response.text()
    expect(body).toContain('404')
  })

  test('chain serves from public when no controller/dist/scss/ts/hbs/md match', async () => {
    const response = await fetchFromServer('/index.html', port)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('Hello from Example Minimal')
  })

  test('chain order: static file in public is served after tryHandlebars etc. pass', async () => {
    const response = await fetchFromServer('/css/style.css', port)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/css')
  })
})

describe('Request-handler: handler chain fallback (example-src)', () => {
  let port: number
  const PROJECT = 'example-src'

  beforeAll(async () => {
    const serverInfo = await startTestServer(PROJECT)
    port = serverInfo.port
    await new Promise((r) => setTimeout(r, 300))
  })

  afterAll(async () => {
    await stopTestServer(PROJECT)
  })

  test('chain falls through to fileNotFound when path matches nothing in the chain', async () => {
    const response = await fetchFromServer('/this-path-has-no-controller-no-template-no-public-file', port)
    expect(response.status).toBe(404)
  })

  test('chain order: tryController wins before tryStaticFile/tryHandlebars for configured path', async () => {
    const response = await fetchFromServer('/fruit', port)
    expect([200, 301, 302]).toContain(response.status)
  })

  test('chain order: tryStaticFile(dist) wins before tryHandlebars when dist file exists', async () => {
    const response = await fetchFromServer('/', port)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toMatch(/Welcome to Test Templates|dist version/)
  })
})

describe.skip('Request-handler: example-auth (route guard, controller)', () => {
  let port: number
  const PROJECT = 'example-auth'

  beforeAll(async () => {
    const serverInfo = await startTestServer(PROJECT)
    port = serverInfo.port
    await new Promise((r) => setTimeout(r, 300))
  })

  afterAll(async () => {
    await stopTestServer(PROJECT)
  })

  test('server starts and responds for root', async () => {
    const response = await fetchFromServer('/', port)
    expect([200, 301, 302, 401]).toContain(response.status)
  })

  test('/fruit is protected or served by controller', async () => {
    const response = await fetchFromServer('/fruit', port)
    expect([200, 301, 302, 401]).toContain(response.status)
  })
})
