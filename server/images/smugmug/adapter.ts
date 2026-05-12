/**
 * SmugMugAdapter — ImageStoreAdapter implementation for SmugMug.
 *
 * Uploads image bytes to SmugMug via OAuth 1.0a multipart POST, then fetches
 * full metadata via the verbosity API and persists a row to the `images` table.
 * MD5-based deduplication is performed before uploading.
 */

import crypto from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { ImageMeta, ImageStoreAdapter, StoredImage } from '../adapters.js'
import type { Website } from '../../website.js'
import { images } from '../../../models/images.js'
import { normalizeSmugMugAlbumUri } from './album-uri.js'
import { requestHttpsUtf8 } from '../https-request.js'
import { mysqlInsertIdFromDrizzleMysql2Result } from '../mysql-insert-result.js'
import { parseSmugMugMultipartUploadResponse } from '../multipart-upload-response.js'
import { buildSmugMugNewImageInsert } from './save-image-map.js'
import { SmugMugClient, type SmugMugTokenSet } from './client.js'
import { smugmugBundleAuthorization } from './oauth.js'
import { parseSmugMugVerbosityAlbumImage } from '../verbosity-response.js'

export class SmugMugAdapter implements ImageStoreAdapter {
  readonly name = 'smugmug'

  constructor(
    private website: Website,
    private client: SmugMugClient,
    private tokens: SmugMugTokenSet,
    private album: string,
  ) {}

  async store(bytes: Buffer, meta: ImageMeta): Promise<StoredImage> {
    const md5sum = crypto.createHash('md5').update(bytes).digest('hex')
    const existing = await this.findByMd5(md5sum)
    if (existing) return existing

    const host = 'upload.smugmug.com'
    const uploadPath = '/'
    const targetUrl = `https://${host}${uploadPath}`
    const method = 'POST'
    const params = this.client.signRequest(method, targetUrl)
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substr(2, 8)
    const formData = SmugMugClient.createMultipartFormDataFromBytes(
      { buffer: bytes, originalFilename: meta.filename, mimetype: meta.mimeType },
      boundary,
    )

    const { statusCode, bodyUtf8 } = await requestHttpsUtf8({
      hostname: host,
      port: 443,
      path: uploadPath,
      method,
      headers: {
        Authorization: smugmugBundleAuthorization(targetUrl, params),
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': formData.length,
        'X-Smug-AlbumUri': normalizeSmugMugAlbumUri(this.album),
        'X-Smug-Caption': meta.caption ?? '',
        'X-Smug-FileName': meta.filename,
        'X-Smug-Keywords': meta.keywords ?? '',
        'X-Smug-ResponseType': 'JSON',
        'X-Smug-Title': meta.title ?? meta.filename,
        'X-Smug-Version': 'v2',
      },
      body: formData,
      log: {
        website: this.website.name,
        operation: 'upload_multipart',
        filename: meta.filename,
      },
    })

    const ack = parseSmugMugMultipartUploadResponse(statusCode, bodyUtf8)

    const AlbumImageUri = ack.Image.AlbumImageUri
    if (typeof AlbumImageUri !== 'string' || !AlbumImageUri.trim()) {
      throw new Error('SmugMug upload ack missing Image.AlbumImageUri')
    }

    const verbosityResponse = await this.client.smugmugApiCall(AlbumImageUri, 'GET', this.website.name)
    const ai = parseSmugMugVerbosityAlbumImage(verbosityResponse)
    const values = buildSmugMugNewImageInsert(ack, ai)

    const drizzle = this.website.db.drizzle
    const insertResult = await drizzle.insert(images).values(values)
    const insertId = mysqlInsertIdFromDrizzleMysql2Result(insertResult)
    if (insertId === undefined) throw new Error('SmugMug image insert returned no insertId')

    const rows = await drizzle.select().from(images).where(eq(images.id, insertId))
    const row = rows[0]
    if (!row) throw new Error('SmugMug image row missing after insert')

    return {
      url: row.url ?? '',
      thumbnailUrl: row.thumbnailUrl,
      md5: row.archivedMD5,
      filename: row.filename ?? '',
      imageKey: row.imageKey,
      albumKey: row.albumKey,
      adapterName: 'smugmug',
    }
  }

  async findByMd5(md5: string): Promise<StoredImage | null> {
    const drizzle = this.website.db.drizzle
    const rows = await drizzle.select().from(images).where(eq(images.archivedMD5, md5))
    if (!rows[0]) return null
    const row = rows[0]
    return {
      url: row.url ?? '',
      thumbnailUrl: row.thumbnailUrl,
      md5: row.archivedMD5,
      filename: row.filename ?? '',
      imageKey: row.imageKey,
      albumKey: row.albumKey,
      adapterName: 'smugmug',
    }
  }
}
