/**
 * MySQL-backed integration checks for **`example-auth`**.
 *
 * - **`SKIP_DATABASE_TESTS=0`** (explicit) → this file runs with real assertions. Anything else
 *   (unset, **`1`**, etc.) → the whole suite is **`describe.skip`** (counts as skipped in Bun).
 * - When enabled, failures are **never** swallowed: missing DB, migrations, or seed users **fail**
 *   with normal `expect` / HTTP status checks.
 *
 * From repo root:
 * ```
 * SKIP_DATABASE_TESTS=0 bun run test:integration:database
 * (also runs `example-auth-images-notes-blob.test.ts` for `images.notes_blob`)
 * bun run example-auth:seed-test-users   # upserts fixtures (see websites/example-auth/README.md)
 * ```
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  fetchFromServer,
  startTestServer,
  stopTestServer,
  waitForServerHttp,
} from './helpers.js'

/** Only **`'0'`** turns this suite on; any other env value (including unset) skips. */
const RUN_DATABASE_ONLINE_TESTS = process.env.SKIP_DATABASE_TESTS === '0'

const describeDatabaseOnline = RUN_DATABASE_ONLINE_TESTS ? describe : describe.skip

const PROJECT = 'example-auth'
const USER_EMAIL = 'user@example-auth.test'
const ADMIN_EMAIL = 'admin@example-auth.test'
const PASSWORD = 'test-password'

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

describeDatabaseOnline('Integration: database online (example-auth + MySQL)', () => {
  let port!: number

  beforeAll(async () => {
    const { port: p } = await startTestServer(PROJECT, { fresh: true })
    port = p
    await waitForServerHttp(port)
    const logonPage = await fetchFromServer('/logon', port)
    expect(logonPage.status).toBe(200)
    const html = await logonPage.text()
    expect(html).toMatch(/log in|login|password/i)

    const userCookie = await loginExampleAuth(port, USER_EMAIL, PASSWORD)
    const adminCookie = await loginExampleAuth(port, ADMIN_EMAIL, PASSWORD)
    if (userCookie === null || adminCookie === null) {
      throw new Error(
        `Seeded logins required (${USER_EMAIL}, ${ADMIN_EMAIL}, password "${PASSWORD}"). ` +
          'Run `bun run example-auth:seed-test-users` from repo root.',
      )
    }
  })

  afterAll(async () => {
    await stopTestServer(PROJECT)
  })

  function authFetch(url: string, cookie: string, init?: RequestInit) {
    const headers = new Headers(init?.headers)
    headers.set('Cookie', cookie)
    return fetchFromServer(url, port, { ...init, headers })
  }

  test('GET /logon returns HTML login page (DB-backed app is up)', async () => {
    const response = await fetchFromServer('/logon', port)
    expect(response.status).toBe(200)
    const body = await response.text()
    expect(body).not.toMatch(/Service unavailable|The database is not connected/i)
    expect(body).toMatch(/email|password/i)
  })

  test('POST /logon with wrong password returns 200 and error messaging', async () => {
    const bodyForm = new URLSearchParams({
      Email: USER_EMAIL,
      Password: 'definitely-not-the-seed-password',
    }).toString()
    const response = await fetchFromServer('/logon', port, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyForm,
    })
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toMatch(/Invalid email or password|error/i)
  })

  test('POST /logon with seeded admin returns redirect and session cookie', async () => {
    const bodyForm = new URLSearchParams({ Email: ADMIN_EMAIL, Password: PASSWORD }).toString()
    const response = await fetchFromServer('/logon', port, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyForm,
      redirect: 'manual',
    })
    expect([302, 303]).toContain(response.status)
    const cookieBlob = sessionCookieFromLoginResponse(response)
    expect(cookieBlob).toMatch(/^sessionId=.+/)
  })

  test('user session: GET /users/list returns 200 with CRUD list markup', async () => {
    const cookie = (await loginExampleAuth(port, USER_EMAIL, PASSWORD))!
    const response = await authFetch('/users/list', cookie)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toMatch(/user|myTable|DataTable|columns|list/i)
  })

  test('user session: GET /admin returns 403 (role boundary)', async () => {
    const cookie = (await loginExampleAuth(port, USER_EMAIL, PASSWORD))!
    const response = await authFetch('/admin', cookie)
    expect(response.status).toBe(403)
  })

  test('user session: GET /fruit/list returns 200 (CRUD touches fruit table)', async () => {
    const cookie = (await loginExampleAuth(port, USER_EMAIL, PASSWORD))!
    const response = await fetchFromServer('/fruit/list', port, {
      headers: new Headers({
        Cookie: cookie,
      }),
    })
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toMatch(/fruit|myTable|DataTable|columns|list/i)
  })

  test('user session: GET /fruit/json with no paging query echoes default draw and returns data array', async () => {
    const cookie = (await loginExampleAuth(port, USER_EMAIL, PASSWORD))!
    const response = await authFetch('/fruit/json', cookie)
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      draw?: string
      data?: unknown[]
      recordsTotal?: number
      recordsFiltered?: number
    }
    expect(body.draw).toBe('1')
    expect(Array.isArray(body.data)).toBe(true)
    expect(typeof body.recordsTotal).toBe('number')
    expect(typeof body.recordsFiltered).toBe('number')
    const total = body.recordsTotal as number
    const filtered = body.recordsFiltered as number
    const rows = body.data ?? []
    expect(total).toBeGreaterThanOrEqual(rows.length)
    expect(filtered).toBe(total)
  })

  test('user session: GET /fruit/json search narrows recordsFiltered vs recordsTotal', async () => {
    const cookie = (await loginExampleAuth(port, USER_EMAIL, PASSWORD))!
    const base = await authFetch('/fruit/json', cookie)
    expect(base.status).toBe(200)
    const full = (await base.json()) as { recordsTotal: number; recordsFiltered: number }
    expect(full.recordsFiltered).toBe(full.recordsTotal)

    const narrow = await authFetch(
      '/fruit/json?' + new URLSearchParams({ 'search[value]': '___no_such_fruit_row___' }).toString(),
      cookie,
    )
    expect(narrow.status).toBe(200)
    const subset = (await narrow.json()) as { recordsTotal: number; recordsFiltered: number; data: unknown[] }
    expect(subset.recordsTotal).toBe(full.recordsTotal)
    expect(subset.recordsFiltered).toBe(0)
    expect(subset.data).toHaveLength(0)
  })

  test('user session: GET /users/json returns full counts and page slice', async () => {
    const cookie = (await loginExampleAuth(port, USER_EMAIL, PASSWORD))!
    const response = await authFetch('/users/json?draw=1&start=0&length=50', cookie)
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      recordsTotal: number
      recordsFiltered: number
      data: unknown[]
    }
    expect(body.recordsFiltered).toBe(body.recordsTotal)
    expect(body.recordsTotal).toBeGreaterThanOrEqual(body.data.length)
    expect(body.data.length).toBeLessThanOrEqual(50)
  })

  test('admin session: GET /sessions/list returns 200', async () => {
    const cookie = (await loginExampleAuth(port, ADMIN_EMAIL, PASSWORD))!
    const response = await authFetch('/sessions/list', cookie)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toMatch(/session|myTable|DataTable|columns|list/i)
  })

  test('admin session: GET /admin returns 200', async () => {
    const cookie = (await loginExampleAuth(port, ADMIN_EMAIL, PASSWORD))!
    const response = await authFetch('/admin', cookie)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).not.toMatch(/Service unavailable|The database is not connected/i)
  })

  test('admin session: GET /audits/list returns 200', async () => {
    const cookie = (await loginExampleAuth(port, ADMIN_EMAIL, PASSWORD))!
    const response = await authFetch('/audits/list', cookie)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toMatch(/audit|myTable|DataTable|columns|list/i)
  })

  test('authenticated user: GET /profile/:id returns 200 for an existing user (id from /users/json)', async () => {
    const cookie = (await loginExampleAuth(port, USER_EMAIL, PASSWORD))!
    const listRes = await authFetch('/users/json?draw=1&start=0&length=100', cookie)
    expect(listRes.status).toBe(200)
    const listBody = (await listRes.json()) as { data?: { id?: number }[] }
    const anyId = listBody.data?.find((r) => typeof r?.id === 'number')?.id
    if (anyId === undefined) return
    const response = await authFetch(`/profile/${anyId}`, cookie)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toMatch(/profile|<h1/i)
  })

  test('admin: PUT /profile/:id updates users row then restores original name', async () => {
    const adminCookie = (await loginExampleAuth(port, ADMIN_EMAIL, PASSWORD))!
    const jsonRes = await authFetch('/users/json?draw=1&start=0&length=500', adminCookie)
    expect(jsonRes.status).toBe(200)
    const payload = (await jsonRes.json()) as {
      data?: { id?: number; name?: string | null; email?: string | null }[]
    }
    const target = payload.data?.find(
      (r) => typeof r?.id === 'number' && String(r.email ?? '').toLowerCase() === USER_EMAIL.toLowerCase(),
    )
    if (!target?.id) {
      throw new Error(`Need seeded ${USER_EMAIL} (run bun run example-auth:seed-test-users).`)
    }
    const priorName = target.name ?? ''
    const newName = `DBOnline-${Date.now()}`
    try {
      const put = await authFetch(`/profile/${target.id}`, adminCookie, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })
      expect(put.status).toBe(200)
      const body = await put.json()
      expect(body.ok).toBe(true)
      expect(body.id).toBe(target.id)
    } finally {
      await authFetch(`/profile/${target.id}`, adminCookie, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: priorName }),
      })
    }
  })
})
