import { describe, expect, test } from 'bun:test'
import { buildSmugMugNewImageInsert } from '../../server/smugmug/save-image-map.js'
import { loadUploadAndVerbosityFixture, sampleSmugImageInsertRow } from '../helpers/smugmug-fixtures.js'

describe('buildSmugMugNewImageInsert', () => {
  test('maps upload ack + AlbumImage fixture to Drizzle insert shape', () => {
    const { uploadAck, albumImageFromVerbosityApi } = loadUploadAndVerbosityFixture()
    const row = buildSmugMugNewImageInsert(uploadAck, albumImageFromVerbosityApi)

    expect(row.imageKey).toBe('fixture-img-key')
    expect(row.albumKey).toBe('fixtureAlbum')
    expect(row.url).toBe(uploadAck.Image.URL)
    expect(row.uri).toBe(albumImageFromVerbosityApi.Uri as string)
    expect(row.originalWidth).toBe(800)
    expect(row.archivedMD5).toBe('fixture-md5')
  })

  test('throws when AlbumImage.ImageKey missing', () => {
    const { uploadAck, albumImageFromVerbosityApi } = loadUploadAndVerbosityFixture()
    const withoutKey = { ...albumImageFromVerbosityApi, ImageKey: undefined }
    expect(() => buildSmugMugNewImageInsert(uploadAck, withoutKey)).toThrow(
      /missing AlbumImage\.ImageKey/,
    )
  })

  test('sampleSmugImageInsertRow matches direct builder', () => {
    const { uploadAck, albumImageFromVerbosityApi } = loadUploadAndVerbosityFixture()
    expect(sampleSmugImageInsertRow()).toEqual(buildSmugMugNewImageInsert(uploadAck, albumImageFromVerbosityApi))
  })
})
