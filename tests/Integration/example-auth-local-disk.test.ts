/**
 * Integration tests: `ThaliaImageUploader` with the **local-disk** adapter on `example-auth`.
 *
 * Verifies the full path from HTTP POST → `LocalDiskAdapter.store()` → MySQL `images` row.
 *
 * Gated identically to `database-online.test.ts`:
 *   - `SKIP_DATABASE_TESTS=0`  → runs with real assertions against the example-auth MySQL DB.
 *   - Any other value          → `describe.skip`.
 *
 * The test overrides `THALIA_LOCAL_DISK_BASEPATH` to a temporary directory so it never
 * touches `/data/photos` (which may not exist or be writable on the test machine).
 * SmugMug and UploadThing env vars are cleared for the duration to guarantee the
 * local-disk adapter is selected.
 *
 * ```
 * SKIP_DATABASE_TESTS=0 bun test tests/Integration/example-auth-local-disk.test.ts
 * ```
 *
 * Prerequisites: same as `database-online.test.ts` — Docker MySQL up, migrations applied.
 *   cd websites/example-auth
 *   docker compose up -d
 *   bun drizzle-kit push
 *   bun ../../websites/example-auth/scripts/seed-test-users.ts  # not required for this suite
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import crypto from 'node:crypto'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { drizzle } from 'drizzle-orm/mysql2'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import { eq } from 'drizzle-orm'
import { images } from '../../websites/example-auth/models/drizzle-schema.js'
import {
  fetchFromServer,
  startTestServer,
  stopTestServer,
  waitForServerHttp,
} from './helpers.js'

const RUN_DATABASE_ONLINE_TESTS = process.env.SKIP_DATABASE_TESTS === '0'
const describeDatabaseOnline = RUN_DATABASE_ONLINE_TESTS ? describe : describe.skip

const thaliaRoot = path.resolve(import.meta.dirname, '../..')

describeDatabaseOnline('Integration: local-disk adapter upload (example-auth + MySQL)', () => {
  let port!: number
  let tmpDir!: string
  let pool!: mysql.Pool
  let db!: MySql2Database<Record<string, never>>

  /** URLs of rows inserted during this run — cleaned up in afterAll. */
  const insertedUrls: string[] = []
  /** Env vars saved before modification so we can restore them in afterAll. */
  let savedEnv: Record<string, string | undefined>

  beforeAll(async () => {
    // Create a writable temp dir for image files
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'thalia-local-disk-it-'))

    // Save and clear keys that would select a higher-priority adapter
    savedEnv = {
      SMUGMUG_CONSUMER_KEY: process.env.SMUGMUG_CONSUMER_KEY,
      SMUGMUG_CONSUMER_SECRET: process.env.SMUGMUG_CONSUMER_SECRET,
      UPLOADTHING_SECRET: process.env.UPLOADTHING_SECRET,
      THALIA_LOCAL_DISK_BASEPATH: process.env.THALIA_LOCAL_DISK_BASEPATH,
      THALIA_LOCAL_DISK_BASEURL: process.env.THALIA_LOCAL_DISK_BASEURL,
    }
    delete process.env.SMUGMUG_CONSUMER_KEY
    delete process.env.SMUGMUG_CONSUMER_SECRET
    delete process.env.UPLOADTHING_SECRET
    process.env.THALIA_LOCAL_DISK_BASEPATH = tmpDir
    process.env.THALIA_LOCAL_DISK_BASEURL = '/test-photos'

    // Start a fresh example-auth server (forces re-init of ThaliaImageUploader with local-disk)
    const { port: p } = await startTestServer('example-auth', { fresh: true })
    port = p
    await waitForServerHttp(port)

    // Direct DB connection for assertions and cleanup
    const cfg = await import(path.join(thaliaRoot, 'websites', 'example-auth', 'drizzle.config.ts'))
    const url = cfg.default.dbCredentials.url as string
    pool = mysql.createPool(url)
    db = drizzle(pool)
  })

  afterAll(async () => {
    // Clean up DB rows inserted by this suite
    for (const url of insertedUrls) {
      await pool.query('DELETE FROM `images` WHERE `url` = ?', [url]).catch(() => {})
    }

    // Clean up temp directory
    if (tmpDir) {
      await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }

    // Restore env vars
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }

    await stopTestServer('example-auth')
    await pool.end()
  })

  test('POST /uploadPhoto with multipart form returns 200 JSON with adapterName "local-disk"', async () => {
    const imageBytes = Buffer.from('fake-png-bytes-for-local-disk-test')
    const file = new File([imageBytes], 'test-upload.png', { type: 'image/png' })
    const form = new FormData()
    form.append('fileToUpload', file)

    const response = await fetchFromServer('/uploadPhoto', port, {
      method: 'POST',
      body: form,
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(body.adapterName).toBe('local-disk')
    expect(typeof body.url).toBe('string')
    expect(String(body.url)).toMatch(/\/test-photos\/[a-f0-9]{32}\.png$/)

    // Track for cleanup
    if (typeof body.url === 'string') insertedUrls.push(body.url)
  })

  test('uploaded image row is persisted in the MySQL images table', async () => {
    const imageBytes = Buffer.from('another-fake-image-for-db-check')
    const expectedMd5 = crypto.createHash('md5').update(imageBytes).digest('hex')
    const file = new File([imageBytes], 'db-check.jpg', { type: 'image/jpeg' })
    const form = new FormData()
    form.append('fileToUpload', file)

    const response = await fetchFromServer('/uploadPhoto', port, {
      method: 'POST',
      body: form,
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    const insertedUrl = String(body.url)
    if (typeof body.url === 'string') insertedUrls.push(insertedUrl)

    // Verify DB row
    const rows = await db.select().from(images).where(eq(images.archivedMD5, expectedMd5))
    expect(rows).toHaveLength(1)
    const row = rows[0]!
    expect(row.adapterName).toBe('local-disk')
    expect(row.url).toBe(insertedUrl)
    expect(row.filename).toBe('db-check.jpg')
    expect(row.archivedMD5).toBe(expectedMd5)
  })

  test('uploaded image file is written to the configured basePath on disk', async () => {
    const imageBytes = Buffer.from('pixels-on-disk-integration-test')
    const expectedMd5 = crypto.createHash('md5').update(imageBytes).digest('hex')
    const file = new File([imageBytes], 'disk-check.png', { type: 'image/png' })
    const form = new FormData()
    form.append('fileToUpload', file)

    const response = await fetchFromServer('/uploadPhoto', port, {
      method: 'POST',
      body: form,
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    if (typeof body.url === 'string') insertedUrls.push(body.url)

    // Verify file was written to our temp dir
    const expectedDiskPath = path.join(tmpDir, `${expectedMd5}.png`)
    const diskBytes = await fsp.readFile(expectedDiskPath)
    expect(Buffer.from(diskBytes).equals(imageBytes)).toBe(true)
  })

  test('uploading the same bytes twice returns the existing DB row (MD5 deduplication)', async () => {
    const imageBytes = Buffer.from('dedup-integration-test-content')
    const expectedMd5 = crypto.createHash('md5').update(imageBytes).digest('hex')
    const makeForm = () => {
      const f = new FormData()
      f.append('fileToUpload', new File([imageBytes], 'dedup.jpg', { type: 'image/jpeg' }))
      return f
    }

    // First upload
    const first = await fetchFromServer('/uploadPhoto', port, { method: 'POST', body: makeForm() })
    expect(first.status).toBe(200)
    const firstBody = (await first.json()) as Record<string, unknown>
    if (typeof firstBody.url === 'string') insertedUrls.push(firstBody.url)

    // Second upload — same bytes
    const second = await fetchFromServer('/uploadPhoto', port, { method: 'POST', body: makeForm() })
    expect(second.status).toBe(200)
    const secondBody = (await second.json()) as Record<string, unknown>

    // Both calls should return the same URL
    expect(secondBody.url).toBe(firstBody.url)

    // Only one DB row should exist for this MD5
    const rows = await db.select().from(images).where(eq(images.archivedMD5, expectedMd5))
    expect(rows).toHaveLength(1)
  })
})
