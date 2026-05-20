/**
 * LocalDiskAdapter — ImageStoreAdapter fallback for sites with no external storage keys.
 *
 * Writes image bytes to `<basePath>/<md5>.<ext>` (default: `/data/photos/`) and optionally
 * stores metadata in the `images` table. The base path must be served by the webserver
 * (e.g. via Thalia's `public/` static-file route or a reverse-proxy alias).
 */

import crypto from 'node:crypto'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import type { ImageMeta, ImageStoreAdapter, StoredImage } from './adapters.js'
import type { Website } from '../website.js'
import { images } from '../../models/images.js'
import { mysqlInsertIdFromDrizzleMysql2Result } from '../../models/util.js'

export type LocalDiskAdapterOptions = {
  /** When `false`, only write files; skip Drizzle inserts (for DB-less sites). Default `true`. */
  persistToDatabase?: boolean
}

export class LocalDiskAdapter implements ImageStoreAdapter {
  readonly name = 'local-disk'
  private readonly persistToDatabase: boolean

  constructor(
    private website: Website,
    private basePath = '/data/photos',
    private baseUrl = '/data/photos',
    opts?: LocalDiskAdapterOptions,
  ) {
    this.persistToDatabase = opts?.persistToDatabase !== false
  }

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

    if (!this.persistToDatabase) {
      return {
        url,
        filename: meta.filename,
        md5: md5sum,
        adapterName: 'local-disk',
      }
    }

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
    if (this.persistToDatabase) {
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

    try {
      const files = await fsp.readdir(this.basePath)
      const match = files.find((f) => f.startsWith(`${md5}.`))
      if (!match) return null
      return {
        url: `${this.baseUrl}/${match}`,
        filename: match,
        md5,
        adapterName: 'local-disk',
      }
    } catch {
      return null
    }
  }
}
