/**
 * Integration tests: **`ProfileControllerFactory`** on **example-auth** (redirect, email visibility,
 * JSON **`validatePhoto`**, error **`code`**).
 *
 * Gated like **`database-online.test.ts`**:
 * - **`SKIP_DATABASE_TESTS=0`** → runs against real MySQL + seeded users.
 * - Otherwise **`describe.skip`**.
 *
 * ```
 * SKIP_DATABASE_TESTS=0 bun test tests/Integration/example-auth-profile.test.ts
 * ```
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import path from 'node:path'
import {
  fetchFromServer,
  startTestServer,
  stopTestServer,
  waitForServerHttp,
} from './helpers.js'

const thaliaRoot = path.resolve(import.meta.dirname, '../..')
const exampleAuthSeedScriptPath = path.join(
  thaliaRoot,
  'websites',
  'example-auth',
  'scripts',
  'seed-test-users.ts',
)

function runExampleAuthSeedScript(): void {
  const result = Bun.spawnSync(['bun', exampleAuthSeedScriptPath], {
    cwd: thaliaRoot,
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env as Record<string, string>,
  })
  if (result.exitCode !== 0) {
    const err = result.stderr.toString()
    const out = result.stdout.toString()
    throw new Error(
      `Seed script failed (exit ${result.exitCode}): ${exampleAuthSeedScriptPath}.\nstderr:\n${err}\nstdout:\n${out}`,
    )
  }
}

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

describeDatabaseOnline('Integration: example-auth profile (HTTP)', () => {
  let port!: number
  let userCookie!: string
  let adminCookie!: string
  let userId!: number
  let adminId!: number

  function authFetch(url: string, cookie: string, init?: RequestInit) {
    const headers = new Headers(init?.headers)
    headers.set('Cookie', cookie)
    return fetchFromServer(url, port, { ...init, headers })
  }

  beforeAll(async () => {
    const { port: p } = await startTestServer(PROJECT, { fresh: true })
    port = p
    await waitForServerHttp(port)

    let u = await loginExampleAuth(port, USER_EMAIL, PASSWORD)
    let a = await loginExampleAuth(port, ADMIN_EMAIL, PASSWORD)
    if (!u || !a) {
      runExampleAuthSeedScript()
      u = await loginExampleAuth(port, USER_EMAIL, PASSWORD)
      a = await loginExampleAuth(port, ADMIN_EMAIL, PASSWORD)
    }
    if (!u || !a) {
      throw new Error(`Login failed for seeded ${USER_EMAIL} / ${ADMIN_EMAIL} (password: ${PASSWORD}).`)
    }
    userCookie = u
    adminCookie = a

    const listRes = await authFetch('/users/json?draw=1&start=0&length=500', adminCookie)
    expect(listRes.status).toBe(200)
    const listBody = (await listRes.json()) as { data?: { id?: number; email?: string | null }[] }
    const userRow = listBody.data?.find(
      (r) => typeof r?.id === 'number' && String(r.email ?? '').toLowerCase() === USER_EMAIL.toLowerCase(),
    )
    const adminRow = listBody.data?.find(
      (r) => typeof r?.id === 'number' && String(r.email ?? '').toLowerCase() === ADMIN_EMAIL.toLowerCase(),
    )
    if (!userRow?.id || !adminRow?.id) {
      throw new Error('Need user + admin rows in DB (run seed-test-users.ts).')
    }
    userId = userRow.id
    adminId = adminRow.id
  })

  afterAll(async () => {
    await stopTestServer(PROJECT)
  })

  test('GET /profile redirects to /profile/<session user id>', async () => {
    const res = await authFetch('/profile', userCookie, { redirect: 'manual' })
    expect([302, 303]).toContain(res.status)
    expect(res.headers.get('location')).toBe(`/profile/${userId}`)
  })

  test('user GET other profile: email redacted (no mailto to other user)', async () => {
    const res = await authFetch(`/profile/${adminId}`, userCookie)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toMatch(/Hidden from viewers/)
    expect(html).not.toMatch(/mailto:admin@example-auth\.test/i)
  })

  test('user GET own profile: mailto with own email', async () => {
    const res = await authFetch(`/profile/${userId}`, userCookie)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toMatch(/mailto:user@example-auth\.test/i)
    expect(html).not.toMatch(/Hidden from viewers/)
  })

  test('admin GET user profile: mailto visible (not redacted for admin)', async () => {
    const res = await authFetch(`/profile/${userId}`, adminCookie)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toMatch(/mailto:user@example-auth\.test/i)
  })

  test('PUT own profile rejects javascript: photo with PHOTO_VALUE_REJECTED', async () => {
    const res = await authFetch(`/profile/${userId}`, userCookie, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo: 'javascript:alert(1)' }),
    })
    expect(res.status).toBe(422)
    const body = (await res.json()) as { code?: string; error?: string }
    expect(body.code).toBe('PHOTO_VALUE_REJECTED')
    expect(body.error).toBeTruthy()
  })

  test('PUT own profile accepts https photo then clears with null', async () => {
    const putOk = await authFetch(`/profile/${userId}`, userCookie, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo: 'https://example.com/it-profile-photo.png' }),
    })
    expect(putOk.status).toBe(200)
    const clear = await authFetch(`/profile/${userId}`, userCookie, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo: null }),
    })
    expect(clear.status).toBe(200)
  })

  test('PUT /profile/abc returns 400 JSON PROFILE_ID_REQUIRED', async () => {
    const res = await authFetch('/profile/abc', userCookie, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x' }),
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { code?: string }
    expect(body.code).toBe('PROFILE_ID_REQUIRED')
  })
})
