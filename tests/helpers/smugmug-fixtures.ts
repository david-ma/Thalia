/**
 * Helpers to load deterministic SmugMug JSON fixtures under `tests/fixtures/smugmug/`.
 */

import fs from 'fs'
import path from 'path'
import type { SmugMugUploadAck } from '../../server/images/smugmug/save-image-map.js'
import { buildSmugMugNewImageInsert } from '../../server/images/smugmug/save-image-map.js'

export type OAuthSignatureFixture = {
  method: string
  targetUrl: string
  tokens: {
    consumer_key: string
    consumer_secret: string
    oauth_token: string
    oauth_token_secret: string
  }
  mockRandom: number
  mockDateNowMs: number
  expectedNonce: string
  expectedTimestamp: string
  signatureBaseString: string
  expectedOAuthSignature: string
}

export type UploadVerbosityFixture = {
  uploadAck: SmugMugUploadAck
  albumImageFromVerbosityApi: Record<string, unknown>
}

export function loadSmugmugOAuthSignatureFixture(): OAuthSignatureFixture {
  const fp = path.join(import.meta.dirname, '../fixtures/smugmug/oauth-signature-vector.json')
  const raw = JSON.parse(fs.readFileSync(fp, 'utf8')) as OAuthSignatureFixture & { _comment?: string }
  return raw
}

export function loadUploadAndVerbosityFixture(): UploadVerbosityFixture {
  const fp = path.join(import.meta.dirname, '../fixtures/smugmug/upload-and-verbosity-sample.json')
  return JSON.parse(fs.readFileSync(fp, 'utf8')) as UploadVerbosityFixture
}

/** Drizzle-ready row derived from fixture (useful seeding MariaDB fixtures). */
export function sampleSmugImageInsertRow() {
  const { uploadAck, albumImageFromVerbosityApi } = loadUploadAndVerbosityFixture()
  return buildSmugMugNewImageInsert(uploadAck, albumImageFromVerbosityApi)
}
