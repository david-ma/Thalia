/**
 * MySQL integration tests for **`images.notes_blob`** on the **example-auth** database.
 *
 * Gated the same way as `database-online.test.ts`: only **`SKIP_DATABASE_TESTS=0`** runs real DB work.
 *
 * ```
 * SKIP_DATABASE_TESTS=0 bun test tests/Integration/example-auth-images-notes-blob.test.ts
 * ```
 */

import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/mysql2'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import type { RowDataPacket } from 'mysql2'
import path from 'path'
import { images } from '../../websites/example-auth/models/drizzle-schema.js'

const RUN_DATABASE_ONLINE_TESTS = process.env.SKIP_DATABASE_TESTS === '0'
const describeDatabaseOnline = RUN_DATABASE_ONLINE_TESTS ? describe : describe.skip

const thaliaRoot = path.resolve(import.meta.dirname, '../..')

describeDatabaseOnline('Integration: example-auth images.notesBlob (MySQL)', () => {
  let pool!: mysql.Pool
  let db!: MySql2Database<Record<string, never>>
  /** Unique per describe run so rows never collide with other runs or manual data. */
  let runPrefix!: string

  beforeAll(async () => {
    runPrefix = `nb-thalia-${Date.now()}-${Math.random().toString(36).slice(2, 10)}-`
    const cfg = await import(path.join(thaliaRoot, 'websites', 'example-auth', 'drizzle.config.ts'))
    const url = cfg.default.dbCredentials.url as string
    pool = mysql.createPool(url)
    db = drizzle(pool)

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'images' AND COLUMN_NAME = 'notes_blob'",
    )
    const first = Array.isArray(rows) && rows[0] ? (rows[0] as RowDataPacket & { c: number }) : undefined
    const c = first != null ? Number(first.c) : 0
    if (c < 1) {
      throw new Error(
        'Column `images.notes_blob` is missing. From `websites/example-auth` run `bun drizzle-kit push` ' +
          '(or apply `drizzle/0002_images_notes_blob.sql`) against this DATABASE_URL.',
      )
    }
  })

  afterEach(async () => {
    if (pool && runPrefix) {
      await pool.query('DELETE FROM `images` WHERE `image_key` LIKE ?', [`${runPrefix}%`])
    }
  })

  afterAll(async () => {
    if (pool) {
      if (runPrefix) {
        await pool.query('DELETE FROM `images` WHERE `image_key` LIKE ?', [`${runPrefix}%`])
      }
      await pool.end()
    }
  })

  function testImageKey(suffix: string): string {
    return `${runPrefix}${suffix}`
  }

  test('insert + select round-trips a JSON object on notes_blob', async () => {
    const imageKey = testImageKey(`ins-${Date.now()}`)
    const payload = { text: 'from integration', tags: ['a'], meta: { n: 1 } }

    await db.insert(images).values({
      imageKey,
      notesBlob: payload,
    })

    const rows = await db.select().from(images).where(eq(images.imageKey, imageKey)).limit(1)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.notesBlob).toEqual(payload)
  })

  test('update replaces notes_blob and read returns the new object', async () => {
    const imageKey = testImageKey(`upd-${Date.now()}`)
    await db.insert(images).values({
      imageKey,
      notesBlob: { v: 1 },
    })

    const next = { v: 2, reason: 'patched in test' }
    await db.update(images).set({ notesBlob: next }).where(eq(images.imageKey, imageKey))

    const rows = await db.select().from(images).where(eq(images.imageKey, imageKey)).limit(1)
    expect(rows[0]!.notesBlob).toEqual(next)
  })

  test('insert with notesBlob omitted yields null on read', async () => {
    const imageKey = testImageKey(`null-${Date.now()}`)
    await db.insert(images).values({
      imageKey,
    })

    const rows = await db.select().from(images).where(eq(images.imageKey, imageKey)).limit(1)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.notesBlob).toBeNull()
  })

  test('raw UTF-8 JSON written with mysql2 (Crud-style string) round-trips through column parser', async () => {
    const imageKey = testImageKey(`raw-${Date.now()}`)
    await db.insert(images).values({ imageKey })

    const json = JSON.stringify({ via: 'formField', ok: true })
    await pool.query('UPDATE `images` SET `notes_blob` = ? WHERE `image_key` = ?', [json, imageKey])

    const rows = await db.select().from(images).where(eq(images.imageKey, imageKey)).limit(1)
    expect(rows[0]!.notesBlob).toEqual({ via: 'formField', ok: true })
  })
})
