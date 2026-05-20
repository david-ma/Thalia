/**
 * ThaliaImageUploader constructor and adapter tier tests.
 */

import { describe, expect, test } from 'bun:test'
import { ThaliaImageUploader } from '../../server/images/image-uploader.js'
import type { ImageMeta, ImageStoreAdapter, StoredImage } from '../../server/images/adapters.js'

// ── A: Interface conformance ────────────────────────────────────────────────

const store: StoredImage[] = []
const mockAdapter: ImageStoreAdapter = {
  name: 'mock',
  async store(_bytes: Buffer, meta: ImageMeta): Promise<StoredImage> {
    const row: StoredImage = {
      url: `https://mock.example.com/${meta.filename}`,
      filename: meta.filename,
      adapterName: 'mock',
    }
    store.push(row)
    return row
  },
  async findByMd5(md5: string): Promise<StoredImage | null> {
    return store.find((r) => r.md5 === md5) ?? null
  },
}

describe('ImageStoreAdapter interface — conformance', () => {
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

// ── B: resolveConfiguredAdapter() ───────────────────────────────────────────

describe('ThaliaImageUploader.resolveConfiguredAdapter()', () => {
  test('returns explicit adapter from options', () => {
    expect(ThaliaImageUploader.resolveConfiguredAdapter({ adapter: 'smugmug' })).toBe('smugmug')
    expect(ThaliaImageUploader.resolveConfiguredAdapter({ adapter: 'uploadthing' })).toBe('uploadthing')
    expect(ThaliaImageUploader.resolveConfiguredAdapter({ adapter: 'local-disk' })).toBe('local-disk')
  })

  test('defaults to local-disk when adapter omitted', () => {
    expect(ThaliaImageUploader.resolveConfiguredAdapter({})).toBe('local-disk')
  })

  test('THALIA_IMAGE_ADAPTER overrides constructor options', () => {
    const saved = process.env.THALIA_IMAGE_ADAPTER
    process.env.THALIA_IMAGE_ADAPTER = 'local-disk'
    expect(ThaliaImageUploader.resolveConfiguredAdapter({ adapter: 'smugmug' })).toBe('local-disk')
    if (saved === undefined) delete process.env.THALIA_IMAGE_ADAPTER
    else process.env.THALIA_IMAGE_ADAPTER = saved
  })
})

// ── C: instance adapterName (constructor; not env-inferred) ─────────────────

describe('ThaliaImageUploader instance adapterName', () => {
  test('defaults to local-disk with no options', () => {
    const uploader = new ThaliaImageUploader()
    expect(uploader.adapterName).toBe('local-disk')
  })

  test('reflects explicit adapter option', () => {
    expect(new ThaliaImageUploader({ adapter: 'smugmug' }).adapterName).toBe('smugmug')
    expect(new ThaliaImageUploader({ adapter: 'uploadthing' }).adapterName).toBe('uploadthing')
  })

  test('UPLOADTHING_SECRET in env alone does not select uploadthing tier', () => {
    const saved = {
      UPLOADTHING_SECRET: process.env.UPLOADTHING_SECRET,
      SMUGMUG_CONSUMER_KEY: process.env.SMUGMUG_CONSUMER_KEY,
      SMUGMUG_CONSUMER_SECRET: process.env.SMUGMUG_CONSUMER_SECRET,
    }
    process.env.UPLOADTHING_SECRET = 'test-secret-from-env'
    delete process.env.SMUGMUG_CONSUMER_KEY
    delete process.env.SMUGMUG_CONSUMER_SECRET

    expect(new ThaliaImageUploader().adapterName).toBe('local-disk')
    expect(new ThaliaImageUploader({ adapter: 'local-disk' }).adapterName).toBe('local-disk')

    if (saved.UPLOADTHING_SECRET === undefined) delete process.env.UPLOADTHING_SECRET
    else process.env.UPLOADTHING_SECRET = saved.UPLOADTHING_SECRET
    if (saved.SMUGMUG_CONSUMER_KEY === undefined) delete process.env.SMUGMUG_CONSUMER_KEY
    else process.env.SMUGMUG_CONSUMER_KEY = saved.SMUGMUG_CONSUMER_KEY
    if (saved.SMUGMUG_CONSUMER_SECRET === undefined) delete process.env.SMUGMUG_CONSUMER_SECRET
    else process.env.SMUGMUG_CONSUMER_SECRET = saved.SMUGMUG_CONSUMER_SECRET
  })
})
