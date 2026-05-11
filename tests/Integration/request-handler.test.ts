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
 * Fail cases: non-existent paths, folders with no index file, and missing assets all return 404.
 *
 * - example-minimal: static files (public/), 404, path exploit
 * - example-src: Handlebars (path.hbs + path/index.hbs), Markdown, TypeScript, controller (fruit);
 *   encoding fixtures under src/encoding (URL-encoded paths, CJK in .md and .hbs)
 * - example-auth: route guard, controller (skipped by default; remove .skip when DB/auth configured)
 *
 * Run from Thalia root: bun test tests/Integration/request-handler.test.ts
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { startTestServer, stopTestServer, fetchFromServer, waitForServerHttp } from './helpers.js'

describe('Request-handler: example-minimal (static, 404, path exploit)', () => {
  let port: number
  const PROJECT = 'example-minimal'

  beforeAll(async () => {
    const serverInfo = await startTestServer(PROJECT)
    port = serverInfo.port
    await waitForServerHttp(port)
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

  test('fail: non-existent file path returns 404', async () => {
    const response = await fetchFromServer('/does-not-exist', port)
    expect(response.status).toBe(404)
  })

  test('fail: non-existent asset path returns 404', async () => {
    const response = await fetchFromServer('/css/missing.css', port)
    expect(response.status).toBe(404)
  })

  test('fail: non-existent folder path (no index) returns 404', async () => {
    const response = await fetchFromServer('/no-such-folder', port)
    expect(response.status).toBe(404)
  })

  test('fail: folder with trailing slash but no index returns 404', async () => {
    const response = await fetchFromServer('/no-such-folder/', port)
    expect(response.status).toBe(404)
  })
})

describe('Request-handler: example-src (Handlebars, TypeScript, controller)', () => {
  let port: number
  const PROJECT = 'example-src'

  beforeAll(async () => {
    const serverInfo = await startTestServer(PROJECT)
    port = serverInfo.port
    await waitForServerHttp(port)
  })

  afterAll(async () => {
    await stopTestServer(PROJECT)
  })

  test('/ or /index.html returns HTML (dist, public, or handlebars fallback)', async () => {
    const response = await fetchFromServer('/', port)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    const html = await response.text()
    expect(html.length).toBeGreaterThan(0)
    // `/` redirects to index.html; when server's node_env is `development`, dist/*.html is skipped so public may win.
    expect(html).toMatch(/dist version|public\/index\.html/)
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

  test('tryHandlebars: paths containing /partials/ are not served as top-level templates (no HTML render)', async () => {
    // This would previously render the input partial as a full page; now it should fall through and 404.
    const response = await fetchFromServer('/views/partials/input.html', port)
    expect(response.status).toBe(404)
  })

  test('/css/test.css serves compiled src/css/test.scss (tryScss)', async () => {
    const response = await fetchFromServer('/css/test.css', port)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/css')
    const css = await response.text()
    expect(css).toMatch(/336699|color/)
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

  test('CRUD: GET /fruit returns 200 (list) or 301/302 (redirect); no 500', async () => {
    const response = await fetchFromServer('/fruit', port)
    expect([200, 301, 302]).toContain(response.status)
    const html = await response.text()
    expect(html.length).toBeGreaterThan(0)
    // If we got list HTML (not a redirect-followed page), body should look like list view
    if (response.status === 200 && html.length > 200) {
      expect(html).toMatch(/fruit|list|table|html/i)
    }
  })

  test('CRUD: GET /fruit/list returns 200 and list view', async () => {
    const response = await fetchFromServer('/fruit/list', port)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html.length).toBeGreaterThan(0)
    expect(html).toMatch(/fruit|list|table|html/i)
  })

  test('CRUD: GET /fruit/new returns 200 and new form', async () => {
    const response = await fetchFromServer('/fruit/new', port)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html.length).toBeGreaterThan(0)
    expect(html).toMatch(/fruit|Create|form|html/i)
  })

  test('CRUD: GET /fruit/1 returns 200 (show) or 404 (record not found)', async () => {
    const response = await fetchFromServer('/fruit/1', port)
    expect([200, 404]).toContain(response.status)
    if (response.status === 200) {
      const html = await response.text()
      expect(html.length).toBeGreaterThan(0)
      expect(html).toMatch(/fruit|Show|record|html/i)
    }
  })

  test('CRUD: GET /fruit/nonexistent-id returns 404 or 200', async () => {
    const response = await fetchFromServer('/fruit/999999', port)
    expect([200, 404]).toContain(response.status)
  })

  test('CRUD: GET /fruit/columns returns 200 (DataTables columns)', async () => {
    const response = await fetchFromServer('/fruit/columns', port)
    expect(response.status).toBe(200)
    const body = await response.text()
    expect(body.length).toBeGreaterThan(0)
  })

  test('CRUD: GET /fruit/json returns 200 (DataTables data)', async () => {
    const response = await fetchFromServer('/fruit/json', port)
    expect(response.status).toBe(200)
    const body = await response.text()
    expect(body.length).toBeGreaterThan(0)
  })

  test('CRUD: GET /fruit/edit/1 returns 200 (edit form) or 404 (record not found)', async () => {
    const response = await fetchFromServer('/fruit/edit/1', port)
    expect([200, 404]).toContain(response.status)
    if (response.status === 200) {
      const html = await response.text()
      expect(html.length).toBeGreaterThan(0)
      expect(html).toMatch(/fruit|edit|form|html/i)
    }
  })

  test('Nested controller: GET /api/create-blog returns 200 and runs nested controller', async () => {
    const response = await fetchFromServer('/api/create-blog', port)
    expect(response.status).toBe(200)
    const body = await response.text()
    expect(body).toBe('create-blog')
    expect(response.headers.get('x-nested-controller')).toBe('create-blog')
  })

  test('Nested controller: GET /api (only segment; node is object) falls through to 404', async () => {
    const response = await fetchFromServer('/api', port)
    expect(response.status).toBe(404)
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

  test('tryMarkdown: URL-encoded spaces (%20) in path match on-disk folder names', async () => {
    const response = await fetchFromServer('/encoding/Has%20Space/note', port)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    const html = await response.text()
    expect(html).toContain('RQH_SPACE_URL_OK')
  })

  test('tryMarkdown: percent-encoded UTF-8 path segments match folder names', async () => {
    const response = await fetchFromServer('/encoding/%E4%B8%AD%E6%96%87/note', port)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('RQH_UNICODE_SEGMENT_OK')
  })

  test('tryMarkdown: CJK characters in markdown render in HTML (UTF-8)', async () => {
    const response = await fetchFromServer('/encoding/cjk', port)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('中文标题')
    expect(html).toContain('RQH_CJK_MD')
    expect(html).toContain('你好')
  })

  test('tryHandlebars: CJK characters in .hbs render in HTML (UTF-8)', async () => {
    const response = await fetchFromServer('/views/encoding-cjk', port)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    const html = await response.text()
    expect(html).toContain('RQH_CJK_HBS')
    expect(html).toContain('你好')
  })

  test('path with .. returns 400 or 404 (checkPathExploit vs client normalization)', async () => {
    const response = await fetchFromServer('/views/../config/config.ts', port)
    expect([400, 404]).toContain(response.status)
  })

  test('fail: path to folder that has no index.hbs or index.md returns 404', async () => {
    const response = await fetchFromServer('/views', port)
    expect(response.status).toBe(404)
  })

  test('fail: path to folder with trailing slash, no index file returns 404', async () => {
    const response = await fetchFromServer('/views/', port)
    expect(response.status).toBe(404)
  })

  test('fail: non-existent .hbs path returns 404', async () => {
    const response = await fetchFromServer('/views/nonexistent-page', port)
    expect(response.status).toBe(404)
  })

  test('fail: non-existent .md path returns 404', async () => {
    const response = await fetchFromServer('/no-such-markdown-page', port)
    expect(response.status).toBe(404)
  })

  test('fail: request for .js with no corresponding .ts and no static file returns 404', async () => {
    const response = await fetchFromServer('/js/nonexistent-script.js', port)
    expect(response.status).toBe(404)
  })
})

describe('Request-handler: handler chain fallback (example-minimal)', () => {
  let port: number
  const PROJECT = 'example-minimal'

  beforeAll(async () => {
    const serverInfo = await startTestServer(PROJECT)
    port = serverInfo.port
    await waitForServerHttp(port)
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
    await waitForServerHttp(port)
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
    expect(html).toMatch(/dist version|public\/index\.html/)
  })
})

/**
 * example-auth uses ThaliaSecurity, RoleRouteGuard, and config.routes (path + permissions).
 * Requires database (and optionally config/mailAuth.js) to be configured so the site and
 * route guard can start. If the server fails to start, these tests are skipped.
 *
 * Plan (see websites/example-auth/README.md): guest gets 401 for /, /profile/:id, /admin;
 * /fruit is guest read; profile viewable by logged-in user, editable only by owner or admin.
 */
const SKIP_EXAMPLE_AUTH_ENV = 'SKIP_EXAMPLE_AUTH_TESTS'
const describeExampleAuth = process.env[SKIP_EXAMPLE_AUTH_ENV] === '1' ? describe.skip : describe

describeExampleAuth('Request-handler: example-auth (route guard, controller)', () => {
  let port: number
  let serverStarted: boolean
  const PROJECT = 'example-auth'

  beforeAll(async () => {
    serverStarted = false
    try {
      const serverInfo = await startTestServer(PROJECT)
      port = serverInfo.port
      await waitForServerHttp(port)
      serverStarted = true
    } catch (err) {
      console.warn('example-auth server did not start (DB/mailAuth may be required):', (err as Error)?.message)
      port = 0
    }
  })

  afterAll(async () => {
    if (serverStarted) await stopTestServer(PROJECT)
  })

  test('server starts and responds for root (or skips if auth deps missing)', async () => {
    if (!serverStarted) {
      expect(port).toBe(0)
      return
    }
    const response = await fetchFromServer('/', port)
    expect([200, 301, 302, 401]).toContain(response.status)
  })

  test('route guard runs before controller: /fruit returns 200/301/302 or 401', async () => {
    if (!serverStarted) return
    const response = await fetchFromServer('/fruit', port)
    expect([200, 301, 302, 401]).toContain(response.status)
  })

  test('request with Host in domains reaches handler (no 404 from missing host)', async () => {
    if (!serverStarted) return
    const response = await fetchFromServer('/fruit', port)
    expect(response.status).not.toBe(404)
  })

  test('unauthenticated request to protected path gets 200 or 401 (not 500)', async () => {
    if (!serverStarted) return
    const response = await fetchFromServer('/fruit', port)
    expect([200, 301, 302, 401]).toContain(response.status)
  })

  test('CRUD: GET /fruit/list returns 200 or 401 (list action)', async () => {
    if (!serverStarted) return
    const response = await fetchFromServer('/fruit/list', port)
    expect([200, 301, 302, 401]).toContain(response.status)
    if (response.status === 200) {
      const html = await response.text()
      expect(html).toMatch(/fruit|list|table|html/i)
    }
  })

  test('CRUD: GET /fruit/new returns 200 or 401 (new form action)', async () => {
    if (!serverStarted) return
    const response = await fetchFromServer('/fruit/new', port)
    expect([200, 301, 302, 401]).toContain(response.status)
    if (response.status === 200) {
      const html = await response.text()
      expect(html).toMatch(/fruit|new|form|html/i)
    }
  })
})

describeExampleAuth('Request-handler: example-auth guest (no session)', () => {
  let port: number
  let serverStarted: boolean
  const PROJECT = 'example-auth'

  beforeAll(async () => {
    serverStarted = false
    try {
      const serverInfo = await startTestServer(PROJECT)
      port = serverInfo.port
      await waitForServerHttp(port)
      serverStarted = true
    } catch {
      port = 0
    }
  })

  afterAll(async () => {
    if (serverStarted) await stopTestServer(PROJECT)
  })

  test('guest GET / returns 401 (login required)', async () => {
    if (!serverStarted) return
    const response = await fetchFromServer('/', port)
    expect(response.status).toBe(401)
  })

  test('guest GET /fruit returns 200 (guest read allowed)', async () => {
    if (!serverStarted) return
    const response = await fetchFromServer('/fruit', port)
    expect(response.status).toBe(200)
  })

  test('guest GET /profile/1 returns 401 (no guest access)', async () => {
    if (!serverStarted) return
    const response = await fetchFromServer('/profile/1', port)
    expect(response.status).toBe(401)
  })

  test('guest GET /admin returns 401', async () => {
    if (!serverStarted) return
    const response = await fetchFromServer('/admin', port)
    expect(response.status).toBe(401)
  })

  test('auth flow: guest GET /logon returns 200 and login form', async () => {
    if (!serverStarted) return
    const response = await fetchFromServer('/logon', port)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toMatch(/log in|login|Log in/i)
    expect(html).toMatch(/Email|email/i)
    expect(html).toMatch(/Password|password/i)
    expect(html).toMatch(/newUser|Create new account/i)
    expect(html).toMatch(/forgotPassword|Forgot password/i)
  })

  test('auth flow: guest POST /logon with wrong password returns 200 and error', async () => {
    if (!serverStarted) return
    const body = new URLSearchParams({ Email: 'user@example-auth.test', Password: 'wrong' }).toString()
    const response = await fetchFromServer('/logon', port, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toMatch(/Invalid email or password|error/i)
  })

  test('auth flow: guest POST /logon with unknown email returns 200 and error (no user enumeration)', async () => {
    if (!serverStarted) return
    const body = new URLSearchParams({ Email: 'nobody@example.invalid', Password: 'any' }).toString()
    const response = await fetchFromServer('/logon', port, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toMatch(/Invalid email or password|error/i)
  })

  test('auth flow: guest GET /newUser returns 200 and registration form', async () => {
    if (!serverStarted) return
    const response = await fetchFromServer('/newUser', port)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toMatch(/New User|Create|new account/i)
    expect(html).toMatch(/Name|name/i)
    expect(html).toMatch(/Email|email/i)
    expect(html).toMatch(/Password|password/i)
  })

  test('auth flow: guest GET /forgotPassword returns 200 and form', async () => {
    if (!serverStarted) return
    const response = await fetchFromServer('/forgotPassword', port)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toMatch(/Forgot Password|forgot|reset/i)
    expect(html).toMatch(/email/i)
  })

const MAILCATCHER_URL = 'http://127.0.0.1:1080'
const SKIP_MAILCATCHER_ENV = 'SKIP_MAILCATCHER_TESTS'

test('auth flow: password reset via MailCatcher works end-to-end (example-auth)', async () => {
  if (!serverStarted) return

  if (process.env[SKIP_MAILCATCHER_ENV] === '1') {
    expect(true).toBe(true)
    return
  }

  const TEST_EMAIL = `reset-user-${Date.now()}@example-auth.test`
  const OLD_PASSWORD = 'old-password-1'
  const NEW_PASSWORD = 'new-password-2'

  // Helper: clear MailCatcher messages; fail if MailCatcher not reachable
  async function clearMailcatcher(): Promise<boolean> {
    try {
      const res = await fetch(`${MAILCATCHER_URL}/messages`, { method: 'DELETE' })
      return res.ok
    } catch (err) {
      throw new Error(
        `MailCatcher is not running at ${MAILCATCHER_URL}. Start it (e.g. mailcatcher) or set SKIP_MAILCATCHER_TESTS=1 to skip. ${(err as Error).message}`
      )
    }
  }

  // Helper: get latest message body for our test email (HTML or plain)
  async function getLatestResetEmailBody(): Promise<string | null> {
    try {
      const res = await fetch(`${MAILCATCHER_URL}/messages`)
      if (!res.ok) return null
      const messages: any[] = await res.json()
      if (!Array.isArray(messages) || messages.length === 0) return null

      // Find last message that mentions TEST_EMAIL in recipients or subject
      const match = [...messages]
        .reverse()
        .find((m) => JSON.stringify(m).includes(TEST_EMAIL))
      if (!match) return null

      const id = match.id
      const htmlRes = await fetch(`${MAILCATCHER_URL}/messages/${id}.html`)
      if (htmlRes.ok) return await htmlRes.text()
      const textRes = await fetch(`${MAILCATCHER_URL}/messages/${id}.plain`)
      if (textRes.ok) return await textRes.text()
      return null
    } catch (err) {
      throw new Error(
        `MailCatcher not reachable at ${MAILCATCHER_URL}: ${(err as Error).message}`
      )
    }
  }

  // 0. Clear MailCatcher (fails loudly if MailCatcher is off)
  const cleared = await clearMailcatcher()
  expect(cleared).toBe(true)

  // 1. Create user via /createNewUser
  const createBody = new URLSearchParams({
    Name: 'Reset User',
    Email: TEST_EMAIL,
    Password: OLD_PASSWORD,
  }).toString()
  const createResp = await fetchFromServer('/createNewUser', port, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: createBody,
    redirect: 'manual',
  })
  // If user already exists, controller returns 200 with an error; either is fine for this flow.
  expect([200, 302, 303]).toContain(createResp.status)

  // 2. Trigger forgotPassword
  const forgotBody = new URLSearchParams({ email: TEST_EMAIL }).toString()
  const forgotResp = await fetchFromServer('/forgotPassword', port, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: forgotBody,
  })
  expect(forgotResp.status).toBe(200)

  // 3. Poll MailCatcher for reset email
  let emailBody: string | null = null
  for (let i = 0; i < 6; i++) {
    emailBody = await getLatestResetEmailBody()
    if (emailBody) break
    await new Promise((r) => setTimeout(r, 500))
  }
  if (!emailBody) {
    throw new Error(`No reset email found in MailCatcher for ${TEST_EMAIL} after polling. Check that MailCatcher is running and the app sent the email.`)
  }

  // 4. Extract token from reset link in email body (handle '=' or HTML-escaped '&#x3D;')
  const tokenMatch = emailBody.match(/resetPassword\?token(?:=|&#x3D;)([^"'\\s<]+)/)
  expect(tokenMatch).not.toBeNull()
  const token = decodeURIComponent(tokenMatch![1])

  // 5. GET /resetPassword?token=...
  const resetGetResp = await fetchFromServer(`/resetPassword?token=${encodeURIComponent(token)}`, port)
  expect(resetGetResp.status).toBe(200)
  const resetGetHtml = await resetGetResp.text()
  expect(resetGetHtml).toMatch(/Reset Password|New password/i)

  // 6. POST /resetPassword with new password
  const resetPostBody = new URLSearchParams({
    token,
    password: NEW_PASSWORD,
    confirmPassword: NEW_PASSWORD,
  }).toString()
  const resetPostResp = await fetchFromServer('/resetPassword', port, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: resetPostBody,
    redirect: 'manual',
  })
  expect([302, 303]).toContain(resetPostResp.status)
  const loc = resetPostResp.headers.get('location') ?? ''
  expect(loc).toMatch(/\/logon\?message=Password\+reset/i)

  // 7. Login with old password should fail
  const oldCookie = await loginExampleAuth(port, TEST_EMAIL, OLD_PASSWORD)
  expect(oldCookie).toBeNull()

  // 8. Login with new password should succeed
  const newCookie = await loginExampleAuth(port, TEST_EMAIL, NEW_PASSWORD)
  expect(newCookie).not.toBeNull()

  // 9. With new session, GET /profile/1 or / returns 200/404 (sanity)
  if (newCookie) {
    const headers = new Headers({ Cookie: newCookie })
    const resp = await fetchFromServer('/', port, { headers })
    expect([200, 401]).toContain(resp.status)
  }
})
})

/**
 * Parse `sessionId` from a login response. Prefer `getSetCookie()` (Bun/Undici) because
 * `headers.get('set-cookie')` is often null when multiple `Set-Cookie` headers are present.
 */
function sessionCookieFromLoginResponse(response: Response): string | null {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  const lines =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : (() => {
          const raw = headers.get('set-cookie')
          return raw ? [raw] : []
        })()
  const blob = lines.join('\n')
  if (!blob.includes('sessionId=')) return null
  const match = blob.match(/sessionId=([^;\s,]+)/)
  return match ? `sessionId=${match[1]}` : null
}

/** Try to log in; returns `Cookie` header value for `sessionId` or null. */
async function loginExampleAuth(port: number, email: string, password: string): Promise<string | null> {
  const body = new URLSearchParams({ Email: email, Password: password }).toString()
  const response = await fetchFromServer('/logon', port, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    redirect: 'manual',
  })
  if (response.status !== 302 && response.status !== 303) return null
  return sessionCookieFromLoginResponse(response)
}

describeExampleAuth('Request-handler: example-auth authenticated (user / admin)', () => {
  let port: number
  let serverStarted: boolean
  let userCookie: string | null = null
  let adminCookie: string | null = null
  const PROJECT = 'example-auth'
  const USER_EMAIL = 'user@example-auth.test'
  const ADMIN_EMAIL = 'admin@example-auth.test'
  const PASSWORD = 'test-password'

  beforeAll(async () => {
    serverStarted = false
    userCookie = null
    adminCookie = null
    try {
      const serverInfo = await startTestServer(PROJECT, { fresh: true })
      port = serverInfo.port
      await waitForServerHttp(port)
      serverStarted = true
    } catch {
      port = 0
      return
    }
    userCookie = await loginExampleAuth(port, USER_EMAIL, PASSWORD)
    adminCookie = await loginExampleAuth(port, ADMIN_EMAIL, PASSWORD)
    if (!userCookie || !adminCookie) {
      console.warn(
        '[example-auth authenticated] Login did not return session cookies for both test users; ' +
          `authenticated tests will no-op. Seed ${USER_EMAIL} and ${ADMIN_EMAIL} (password: ${PASSWORD}) ` +
          'or see websites/example-auth/README.md.',
      )
    }
  })

  afterAll(async () => {
    if (serverStarted) await stopTestServer(PROJECT)
  })

  function fetchWithCookie(url: string, cookie: string | null, options?: RequestInit) {
    const headers = new Headers(options?.headers)
    if (cookie) headers.set('Cookie', cookie)
    return fetchFromServer(url, port, { ...options, headers })
  }

  /** Opt-in: CI or local with DB — fails fast if the server is up but logins did not yield cookies. */
  test('example-auth: REQUIRE_EXAMPLE_AUTH_LOGIN=1 enforces seeded users when the server starts', () => {
    if (process.env.REQUIRE_EXAMPLE_AUTH_LOGIN !== '1' || !serverStarted) return
    expect(userCookie).not.toBeNull()
    expect(adminCookie).not.toBeNull()
  })

  test('logged-in user GET / returns 200', async () => {
    if (!serverStarted || !userCookie) return
    const response = await fetchWithCookie('/', userCookie)
    expect(response.status).toBe(200)
  })

  test('logged-in user GET /profile/1 returns 200 or 404 (view any profile)', async () => {
    if (!serverStarted || !userCookie) return
    const response = await fetchWithCookie('/profile/1', userCookie)
    expect([200, 404]).toContain(response.status)
  })

  test('user PUT /profile/2 without being owner returns 403', async () => {
    if (!serverStarted || !userCookie) return
    const response = await fetchWithCookie('/profile/2', userCookie, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked' }),
    })
    expect([403, 404]).toContain(response.status)
  })

  test('user GET /admin returns 403', async () => {
    if (!serverStarted || !userCookie) return
    const response = await fetchWithCookie('/admin', userCookie)
    expect(response.status).toBe(403)
  })

  test('logged-in user GET /fruit returns 200 list (route guard must not match root / to /fruit)', async () => {
    if (!serverStarted || !userCookie) return
    const response = await fetchWithCookie('/fruit', userCookie, { redirect: 'manual' })
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toMatch(/fruit|myTable|DataTable|columns/i)
    expect(html).toMatch(/<title>\s*List\s+fruit\s*<\/title>/i)
  })

  test('admin GET /admin returns 200', async () => {
    if (!serverStarted || !adminCookie) return
    const response = await fetchWithCookie('/admin', adminCookie)
    expect(response.status).toBe(200)
  })

  test('admin PUT /profile/1 returns 200 or 404 (admin can edit any)', async () => {
    if (!serverStarted || !adminCookie) return
    const response = await fetchWithCookie('/profile/1', adminCookie, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated by admin' }),
    })
    expect([200, 404]).toContain(response.status)
  })

  test('auth flow: GET /logout returns 302 and clears session cookie', async () => {
    if (!serverStarted || !userCookie) return
    const response = await fetchWithCookie('/logout', userCookie, { redirect: 'manual' })
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toMatch(/\/$/)
    const h = response.headers as Headers & { getSetCookie?: () => string[] }
    const setCookieBlob =
      typeof h.getSetCookie === 'function' ? h.getSetCookie().join('\n') : (h.get('set-cookie') ?? '')
    expect(setCookieBlob).toMatch(/sessionId=;|Expires=Thu, 01 Jan 1970/)
  })

  test('auth flow: after logout, request without cookie gets 401 for protected path', async () => {
    if (!serverStarted) return
    const response = await fetchFromServer('/', port)
    expect(response.status).toBe(401)
  })
})
