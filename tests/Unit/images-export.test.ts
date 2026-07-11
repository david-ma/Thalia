/**
 * Verifies `thalia/images` resolves via package.json exports (consumer sites).
 */

import { describe, expect, test } from 'bun:test'
import {
  fetchRemoteHttpsImageBytes,
  pickRemoteFileUrl,
  SmugMugClient,
  normalizeSmugMugAlbumUri,
  smugmugBundleAuthorization,
  parseSmugMugMultipartUploadResponse,
  parseSmugMugVerbosityAlbumImage,
  requestHttpsUtf8,
} from 'thalia/images'

describe('thalia/images package export', () => {
  test('exports gallery / SmugMug pipeline helpers', () => {
    expect(typeof fetchRemoteHttpsImageBytes).toBe('function')
    expect(typeof pickRemoteFileUrl).toBe('function')
    expect(typeof SmugMugClient).toBe('function')
    expect(typeof normalizeSmugMugAlbumUri).toBe('function')
    expect(typeof smugmugBundleAuthorization).toBe('function')
    expect(typeof parseSmugMugMultipartUploadResponse).toBe('function')
    expect(typeof parseSmugMugVerbosityAlbumImage).toBe('function')
    expect(typeof requestHttpsUtf8).toBe('function')
  })
})
