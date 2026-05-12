import { describe, expect, test } from 'bun:test'
import { normalizeSmugMugAlbumUri } from '../../server/images/smugmug/album-uri.js'

describe('normalizeSmugMugAlbumUri', () => {
  test('bare album key maps to upload header path', () => {
    expect(normalizeSmugMugAlbumUri('AbCd123')).toBe('/api/v2/album/AbCd123')
  })

  test('respects explicit /api/v2/album/ path and trims slashes', () => {
    expect(normalizeSmugMugAlbumUri('/api/v2/album/AbCd/')).toBe('/api/v2/album/AbCd')
    expect(normalizeSmugMugAlbumUri('/////api/v2/album/Zed')).toBe('/api/v2/album/Zed')
  })

  test('accepts pasted path without leading slash', () => {
    expect(normalizeSmugMugAlbumUri('api/v2/album/fromPaste')).toBe('/api/v2/album/fromPaste')
  })

  test('API URL → pathname only', () => {
    expect(normalizeSmugMugAlbumUri('https://api.smugmug.com/api/v2/album/Key?extras=ignored')).toBe(
      '/api/v2/album/Key',
    )
  })

  test('gallery / non-API https URL returns empty (invalid for X-Smug-AlbumUri)', () => {
    expect(normalizeSmugMugAlbumUri('https://example.smugmug.com/My-Gallery/My-Album/')).toBe('')
  })

  test('malformed https URL yields empty', () => {
    expect(normalizeSmugMugAlbumUri('https://[')).toBe('')
  })

  test('opaque string without scheme is treated as bare key fragment', () => {
    expect(normalizeSmugMugAlbumUri('my-node-id')).toBe('/api/v2/album/my-node-id')
  })

  test('whitespace-only is empty', () => {
    expect(normalizeSmugMugAlbumUri('   ')).toBe('')
  })

  test('bare key preserves Smug punctuation (e.g. node id style)', () => {
    expect(normalizeSmugMugAlbumUri('albumKey!suffix')).toBe('/api/v2/album/albumKey!suffix')
  })
})
