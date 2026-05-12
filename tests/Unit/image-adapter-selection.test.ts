/**
 * Adapter selection tests for ThaliaImageUploader.
 *
 * ── Section A: ImageStoreAdapter interface conformance ─────────────────────
 *    These tests PASS now. They lock in the shape of the interface and act as
 *    a regression guard after adapters are implemented.
 *
 * ── Section B: ThaliaImageUploader.pickAdapterName() ──────────────────────
 *    These tests FAIL now (method does not exist yet).
 *    They define the expected static helper that selects a tier based on
 *    available config, without needing the full async init() machinery.
 *    Pass condition: ThaliaImageUploader.pickAdapterName({ hasSmugMugKeys,
 *    hasUploadThingKey }) → 'smugmug' | 'uploadthing' | 'local-disk'.
 *
 * ── Section C: ThaliaImageUploader instance adapterName ───────────────────
 *    These tests FAIL now (property does not exist yet).
 *    They define the expected public adapterName property on instances.
 *    The property should be set synchronously during init() once the tier is
 *    resolved (SmugMug secrets load is async, but the fallback tiers can be
 *    resolved from env vars before the import resolves).
 */

import { describe, expect, test } from 'bun:test'
import { ThaliaImageUploader } from '../../server/images/smugmug-controller.js'
import type { ImageMeta, ImageStoreAdapter, StoredImage } from '../../server/images/adapters.js'

// ── A: Interface conformance (PASS now) ────────────────────────────────────

/** A minimal in-memory mock that satisfies ImageStoreAdapter. */
const store: StoredImage[] = []
const mockAdapter: ImageStoreAdapter = {
  name: 'mock',
  async store(_bytes: Buffer, meta: ImageMeta): Promise<StoredImage> {
    const row: StoredImage = { url: `https://mock.example.com/${meta.filename}`, filename: meta.filename, adapterName: 'mock' }
    store.push(row)
    return row
  },
  async findByMd5(md5: string): Promise<StoredImage | null> {
    return store.find((r) => r.md5 === md5) ?? null
  },
}

describe('ImageStoreAdapter interface — conformance (passing)', () => {
  test('mock adapter satisfies the interface at compile time', () => {
    expect(mockAdapter.name).toBe('mock')
    expect(typeof mockAdapter.store).toBe('function')
    expect(typeof mockAdapter.findByMd5).toBe('function')
  })

  test('store() resolves to StoredImage with url, filename, and adapterName', async () => {
    const result = await mockAdapter.store(Buffer.from('pixel'), {
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
    })
    expect(typeof result.url).toBe('string')
    expect(result.url.endsWith('photo.jpg')).toBe(true)
    expect(result.filename).toBe('photo.jpg')
    expect(result.adapterName).toBe('mock')
  })

  test('store() optional fields can be absent', async () => {
    const result = await mockAdapter.store(Buffer.from('x'), { filename: 'x.png', mimeType: 'image/png' })
    // SmugMug-specific fields should be absent for non-SmugMug adapters
    expect(result.imageKey).toBeUndefined()
    expect(result.albumKey).toBeUndefined()
  })

  test('findByMd5() returns null when no match', async () => {
    const result = await mockAdapter.findByMd5!('nonexistent-md5')
    expect(result).toBeNull()
  })

  test('ImageMeta type: mimeType field is required', () => {
    const meta: ImageMeta = { filename: 'img.jpg', mimeType: 'image/jpeg' }
    expect(meta.mimeType).toBe('image/jpeg')
    expect(meta.caption).toBeUndefined()
  })
})

// ── B: ThaliaImageUploader.pickAdapterName() (FAILING until implemented) ───

describe('ThaliaImageUploader.pickAdapterName() — FAILING until implemented', () => {
  test('returns "smugmug" when SmugMug consumer keys are present', () => {
    // EXPECTED TO FAIL: ThaliaImageUploader.pickAdapterName does not exist yet.
    // Once implemented, this static method should select the SmugMug tier.
    const fn = (ThaliaImageUploader as any).pickAdapterName
    expect(typeof fn).toBe('function')
    expect(fn({ hasSmugMugKeys: true, hasUploadThingKey: false })).toBe('smugmug')
  })

  test('returns "smugmug" even when UploadThing key is also present (SmugMug takes priority)', () => {
    const fn = (ThaliaImageUploader as any).pickAdapterName
    expect(typeof fn).toBe('function')
    expect(fn({ hasSmugMugKeys: true, hasUploadThingKey: true })).toBe('smugmug')
  })

  test('returns "uploadthing" when only UploadThing key is present', () => {
    const fn = (ThaliaImageUploader as any).pickAdapterName
    expect(typeof fn).toBe('function')
    expect(fn({ hasSmugMugKeys: false, hasUploadThingKey: true })).toBe('uploadthing')
  })

  test('returns "local-disk" when no external keys are configured', () => {
    const fn = (ThaliaImageUploader as any).pickAdapterName
    expect(typeof fn).toBe('function')
    expect(fn({ hasSmugMugKeys: false, hasUploadThingKey: false })).toBe('local-disk')
  })
})

// ── C: ThaliaImageUploader instance adapterName (FAILING until implemented) ─

describe('ThaliaImageUploader instance adapterName — FAILING until implemented', () => {
  test('new instance has adapterName set to a known string', () => {
    // EXPECTED TO FAIL: adapterName property does not exist yet.
    // Once init() sets the adapter, adapterName should reflect the selected tier.
    const uploader = new ThaliaImageUploader()
    const name: unknown = (uploader as any).adapterName
    expect(typeof name).toBe('string')
  })

  test('adapterName is one of the three valid tier names', () => {
    const uploader = new ThaliaImageUploader()
    const valid = ['smugmug', 'uploadthing', 'local-disk']
    expect(valid).toContain((uploader as any).adapterName)
  })

  test('adapterName defaults to "local-disk" when no env vars are set', () => {
    // Simulate a clean environment (no SmugMug or UploadThing keys)
    const saved = {
      SMUGMUG_CONSUMER_KEY: process.env.SMUGMUG_CONSUMER_KEY,
      SMUGMUG_CONSUMER_SECRET: process.env.SMUGMUG_CONSUMER_SECRET,
      UPLOADTHING_SECRET: process.env.UPLOADTHING_SECRET,
    }
    delete process.env.SMUGMUG_CONSUMER_KEY
    delete process.env.SMUGMUG_CONSUMER_SECRET
    delete process.env.UPLOADTHING_SECRET

    const uploader = new ThaliaImageUploader()
    expect((uploader as any).adapterName).toBe('local-disk')

    // Restore
    if (saved.SMUGMUG_CONSUMER_KEY !== undefined) process.env.SMUGMUG_CONSUMER_KEY = saved.SMUGMUG_CONSUMER_KEY
    if (saved.SMUGMUG_CONSUMER_SECRET !== undefined) process.env.SMUGMUG_CONSUMER_SECRET = saved.SMUGMUG_CONSUMER_SECRET
    if (saved.UPLOADTHING_SECRET !== undefined) process.env.UPLOADTHING_SECRET = saved.UPLOADTHING_SECRET
  })
})
