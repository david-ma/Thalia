/**
 * UploadThingUrlAdapter — ImageStoreAdapter for sites using UploadThing without SmugMug.
 *
 * Expects the caller to supply `meta.sourceUrl` (the UploadThing CDN URL).
 * Computes an MD5 from the downloaded bytes for deduplication, then persists
 * the UT URL directly as `images.url` — no re-upload to a third-party service.
 */

import crypto from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { ImageMeta, ImageStoreAdapter, StoredImage } from './adapters.js'
import type { Website } from '../website.js'
import { images } from '../../models/smugmug.js'
import { mysqlInsertIdFromDrizzleMysql2Result } from './mysql-insert-result.js'

export class UploadThingUrlAdapter implements ImageStoreAdapter {
  readonly name = 'uploadthing'

  constructor(private website: Website) {}

  async store(bytes: Buffer, meta: ImageMeta): Promise<StoredImage> {
    const url = meta.sourceUrl
    if (!url) {
      throw new Error(
        'UploadThingUrlAdapter.store() requires meta.sourceUrl (the UploadThing CDN URL)',
      )
    }

    const md5sum = crypto.createHash('md5').update(bytes).digest('hex')
    const existing = await this.findByMd5(md5sum)
    if (existing) return existing

    const drizzle = this.website.db.drizzle
    const insertResult = await drizzle.insert(images).values({
      url,
      filename: meta.filename,
      archivedMD5: md5sum,
      adapterName: 'uploadthing',
    })

    const insertId = mysqlInsertIdFromDrizzleMysql2Result(insertResult)
    if (insertId === undefined) throw new Error('UploadThing image insert returned no insertId')

    const rows = await drizzle.select().from(images).where(eq(images.id, insertId))
    const row = rows[0]
    if (!row) throw new Error('UploadThing image row missing after insert')

    return {
      url: row.url ?? '',
      filename: row.filename ?? '',
      md5: row.archivedMD5,
      adapterName: 'uploadthing',
    }
  }

  async findByMd5(md5: string): Promise<StoredImage | null> {
    const drizzle = this.website.db.drizzle
    const rows = await drizzle.select().from(images).where(eq(images.archivedMD5, md5))
    if (!rows[0]) return null
    const row = rows[0]
    return {
      url: row.url ?? '',
      filename: row.filename ?? '',
      md5: row.archivedMD5,
      adapterName: 'uploadthing',
    }
  }
}
