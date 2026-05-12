/**
 * LocalDiskAdapter — ImageStoreAdapter fallback for sites with no external storage keys.
 *
 * Writes image bytes to `<basePath>/<md5>.<ext>` (default: `/data/photos/`) and
 * stores the local serve URL in the `images` table. The base path must be
 * served by the webserver (e.g. via Thalia's `public/` static-file route or
 * a reverse-proxy alias).
 *
 * This is the last-resort tier — always available, zero external dependencies.
 */

import crypto from 'node:crypto'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import type { ImageMeta, ImageStoreAdapter, StoredImage } from './adapters.js'
import type { Website } from '../website.js'
import { images } from '../../models/images.js'
import { mysqlInsertIdFromDrizzleMysql2Result } from './mysql-insert-result.js'

export class LocalDiskAdapter implements ImageStoreAdapter {
  readonly name = 'local-disk'

  /**
   * @param website  Thalia website context (drizzle DB, logging).
   * @param basePath Absolute filesystem path where image files are written.
   *                 Defaults to `/data/photos`. Must be writable by the server process.
   * @param baseUrl  URL prefix used to build `images.url`.
   *                 Defaults to `/data/photos` (relative to the site root).
   */
  constructor(
    private website: Website,
    private basePath = '/data/photos',
    private baseUrl = '/data/photos',
  ) {}

  async store(bytes: Buffer, meta: ImageMeta): Promise<StoredImage> {
    const md5sum = crypto.createHash('md5').update(bytes).digest('hex')
    const existing = await this.findByMd5(md5sum)
    if (existing) return existing

    const ext = path.extname(meta.filename) || '.bin'
    const diskFilename = `${md5sum}${ext}`
    const filepath = path.join(this.basePath, diskFilename)

    await fsp.mkdir(this.basePath, { recursive: true })
    await fsp.writeFile(filepath, bytes)

    const url = `${this.baseUrl}/${diskFilename}`
    const drizzle = this.website.db.drizzle
    const insertResult = await drizzle.insert(images).values({
      url,
      filename: meta.filename,
      archivedMD5: md5sum,
      adapterName: 'local-disk',
    })

    const insertId = mysqlInsertIdFromDrizzleMysql2Result(insertResult)
    if (insertId === undefined) throw new Error('LocalDisk image insert returned no insertId')

    const rows = await drizzle.select().from(images).where(eq(images.id, insertId))
    const row = rows[0]
    if (!row) throw new Error('LocalDisk image row missing after insert')

    return {
      url: row.url ?? '',
      filename: row.filename ?? '',
      md5: row.archivedMD5,
      adapterName: 'local-disk',
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
      adapterName: 'local-disk',
    }
  }
}
