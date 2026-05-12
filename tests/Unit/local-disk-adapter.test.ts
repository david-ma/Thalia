/**
 * Unit tests for LocalDiskAdapter.
 *
 * Uses a real temporary directory so filesystem writes are verified without mocking fsp.
 * The Drizzle DB is replaced with a lightweight in-memory mock that simulates the
 * three `drizzle` calls LocalDiskAdapter makes:
 *   1. select (findByMd5 dedup check)
 *   2. insert
 *   3. select (fetch-after-insert)
 *
 * Run:
 *   bun test tests/Unit/local-disk-adapter.test.ts
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import crypto from 'node:crypto'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { Website } from '../../server/website.js'
import { LocalDiskAdapter } from '../../server/images/local-disk-adapter.js'

// ── Mock DB factory ─────────────────────────────────────────────────────────

type MockImageRow = {
  id?: number
  url?: string | null
  filename?: string | null
  archivedMD5?: string | null
  adapterName?: string | null
  [key: string]: unknown
}

/**
 * Build a minimal mock drizzle that satisfies LocalDiskAdapter's three query calls.
 *
 * Call order:
 *   1. select().from().where() → findByMd5 check (returns `existingRows`)
 *   2. insert().values()       → insert new row (returns `[{ insertId }]`)
 *   3. select().from().where() → fetch-after-insert (returns `[insertedRow]`)
 */
function makeMockDrizzle(opts: {
  existingRows?: MockImageRow[]
  insertId?: number
  insertedRow?: MockImageRow
}) {
  const { existingRows = [], insertId = 1, insertedRow } = opts
  let selectCallCount = 0

  const resolvedInsertedRow: MockImageRow = insertedRow ?? {
    id: insertId,
    url: null,
    filename: null,
    archivedMD5: null,
    adapterName: 'local-disk',
  }

  return {
    select: () => ({
      from: () => ({
        where: () => {
          selectCallCount++
          if (selectCallCount === 1) return Promise.resolve(existingRows)
          return Promise.resolve([resolvedInsertedRow])
        },
      }),
    }),
    insert: () => ({
      values: (_vals: unknown) => Promise.resolve([{ insertId, affectedRows: 1 }]),
    }),
  }
}

function makeMockWebsite(drizzle: ReturnType<typeof makeMockDrizzle>): Website {
  return { db: { drizzle }, name: 'test-site' } as unknown as Website
}

// ── Shared test state ────────────────────────────────────────────────────────

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'thalia-disk-test-'))
})

afterEach(async () => {
  await fsp.rm(tmpDir, { recursive: true, force: true })
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('LocalDiskAdapter — name property', () => {
  test('name is "local-disk"', () => {
    const drizzle = makeMockDrizzle({})
    const website = makeMockWebsite(drizzle)
    const adapter = new LocalDiskAdapter(website, tmpDir, '/photos')
    expect(adapter.name).toBe('local-disk')
  })
})

describe('LocalDiskAdapter — store(): happy path', () => {
  test('writes a file to the basePath with md5-based name and returns StoredImage', async () => {
    const bytes = Buffer.from('hello world image bytes')
    const expectedMd5 = crypto.createHash('md5').update(bytes).digest('hex')
    const expectedFilename = `${expectedMd5}.jpg`
    const expectedUrl = `/photos/${expectedFilename}`

    const insertedRow: MockImageRow = {
      id: 7,
      url: expectedUrl,
      filename: 'photo.jpg',
      archivedMD5: expectedMd5,
      adapterName: 'local-disk',
    }
    const drizzle = makeMockDrizzle({ insertId: 7, insertedRow })
    const adapter = new LocalDiskAdapter(makeMockWebsite(drizzle), tmpDir, '/photos')

    const result = await adapter.store(bytes, { filename: 'photo.jpg', mimeType: 'image/jpeg' })

    // File should be on disk
    const diskPath = path.join(tmpDir, expectedFilename)
    const written = await fsp.readFile(diskPath)
    expect(written.equals(bytes)).toBe(true)

    // StoredImage should reflect the DB row
    expect(result.url).toBe(expectedUrl)
    expect(result.filename).toBe('photo.jpg')
    expect(result.adapterName).toBe('local-disk')
  })

  test('uses .bin extension when filename has no extension', async () => {
    const bytes = Buffer.from('binary without ext')
    const expectedMd5 = crypto.createHash('md5').update(bytes).digest('hex')

    const drizzle = makeMockDrizzle({
      insertedRow: {
        id: 2,
        url: `/photos/${expectedMd5}.bin`,
        filename: 'noext',
        archivedMD5: expectedMd5,
        adapterName: 'local-disk',
      },
    })
    const adapter = new LocalDiskAdapter(makeMockWebsite(drizzle), tmpDir, '/photos')
    await adapter.store(bytes, { filename: 'noext', mimeType: 'application/octet-stream' })

    const diskPath = path.join(tmpDir, `${expectedMd5}.bin`)
    const exists = await fsp.access(diskPath).then(() => true).catch(() => false)
    expect(exists).toBe(true)
  })

  test('basePath directory is created automatically if it does not exist', async () => {
    const nestedDir = path.join(tmpDir, 'nested', 'photos')
    const bytes = Buffer.from('test auto mkdir')
    const expectedMd5 = crypto.createHash('md5').update(bytes).digest('hex')

    const drizzle = makeMockDrizzle({
      insertedRow: {
        id: 3,
        url: `/photos/${expectedMd5}.bin`,
        filename: 'test.bin',
        archivedMD5: expectedMd5,
        adapterName: 'local-disk',
      },
    })
    const adapter = new LocalDiskAdapter(makeMockWebsite(drizzle), nestedDir, '/photos')
    await adapter.store(bytes, { filename: 'test.bin', mimeType: 'application/octet-stream' })

    // Directory should now exist and the file be written
    const diskPath = path.join(nestedDir, `${expectedMd5}.bin`)
    const exists = await fsp.access(diskPath).then(() => true).catch(() => false)
    expect(exists).toBe(true)
  })
})

describe('LocalDiskAdapter — store(): deduplication', () => {
  test('returns existing StoredImage without writing to disk when md5 already in DB', async () => {
    const bytes = Buffer.from('duplicate bytes')
    const existingRow: MockImageRow = {
      id: 5,
      url: '/photos/already-there.jpg',
      filename: 'already-there.jpg',
      archivedMD5: 'any-md5-in-db',
      adapterName: 'local-disk',
    }
    const drizzle = makeMockDrizzle({ existingRows: [existingRow] })
    const adapter = new LocalDiskAdapter(makeMockWebsite(drizzle), tmpDir, '/photos')

    const result = await adapter.store(bytes, { filename: 'photo.jpg', mimeType: 'image/jpeg' })

    // The temp dir must be empty — no file written
    const files = await fsp.readdir(tmpDir)
    expect(files).toHaveLength(0)

    // StoredImage is the existing row
    expect(result.url).toBe('/photos/already-there.jpg')
    expect(result.adapterName).toBe('local-disk')
  })
})

describe('LocalDiskAdapter — findByMd5()', () => {
  test('returns null when the DB has no matching row', async () => {
    const drizzle = makeMockDrizzle({ existingRows: [] })
    const adapter = new LocalDiskAdapter(makeMockWebsite(drizzle), tmpDir, '/photos')
    const result = await adapter.findByMd5('nonexistent-md5')
    expect(result).toBeNull()
  })

  test('returns a StoredImage when the DB has a matching row', async () => {
    const existingRow: MockImageRow = {
      id: 10,
      url: '/photos/found.png',
      filename: 'found.png',
      archivedMD5: 'match-hash',
      adapterName: 'local-disk',
    }
    const drizzle = makeMockDrizzle({ existingRows: [existingRow] })
    const adapter = new LocalDiskAdapter(makeMockWebsite(drizzle), tmpDir, '/photos')

    const result = await adapter.findByMd5('match-hash')
    expect(result).not.toBeNull()
    expect(result!.url).toBe('/photos/found.png')
    expect(result!.filename).toBe('found.png')
    expect(result!.md5).toBe('match-hash')
    expect(result!.adapterName).toBe('local-disk')
  })
})
