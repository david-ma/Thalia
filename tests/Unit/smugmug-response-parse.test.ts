import { describe, expect, test } from 'bun:test'
import { parseSmugMugMultipartUploadResponse } from '../../server/smugmug/multipart-upload-response.js'
import { parseSmugMugVerbosityAlbumImage } from '../../server/smugmug/verbosity-response.js'

describe('parseSmugMugMultipartUploadResponse', () => {
  const validBody = JSON.stringify({
    stat: 'ok',
    Image: {
      AlbumImageUri: '/api/v2/album/x!/image/y!',
      URL: 'https://example.smugmug.com/p/',
      ImageUri: '/api/v2/image/z',
    },
  })

  test('accepts 200 + valid payload', () => {
    const ack = parseSmugMugMultipartUploadResponse(200, validBody)
    expect(ack.Image.AlbumImageUri).toContain('/api/v2/album/')
  })

  test('rejects non-2xx', () => {
    expect(() => parseSmugMugMultipartUploadResponse(500, validBody)).toThrow(/HTTP 500/)
  })

  test('rejects invalid JSON', () => {
    expect(() => parseSmugMugMultipartUploadResponse(200, 'not json')).toThrow(/invalid JSON/)
  })

  test('rejects missing Image', () => {
    expect(() => parseSmugMugMultipartUploadResponse(200, '{}')).toThrow(/missing Image/)
  })
})

describe('parseSmugMugVerbosityAlbumImage', () => {
  const body = JSON.stringify({
    Response: {
      AlbumImage: { ImageKey: 'k', AlbumKey: 'a', FileName: 'f.jpg' },
    },
  })

  test('returns AlbumImage object', () => {
    const ai = parseSmugMugVerbosityAlbumImage(body)
    expect(ai.ImageKey).toBe('k')
  })

  test('rejects missing Response.AlbumImage', () => {
    expect(() => parseSmugMugVerbosityAlbumImage(JSON.stringify({ Response: {} }))).toThrow(
      /missing Response\.AlbumImage/,
    )
  })
})
