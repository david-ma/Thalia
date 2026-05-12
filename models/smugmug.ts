import { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { customType, mysqlTable, text, int } from 'drizzle-orm/mysql-core'
import { vc, baseTableConfig } from './util'

/** Arbitrary JSON-compatible document stored as UTF-8 in `images.notes_blob` (no schema churn for new keys). */
export type ImageNotesBlob = Record<string, unknown>

const imageNotesBlobColumn = customType<{
  data: ImageNotesBlob | null
  driverData: Buffer | null
}>({
  dataType() {
    return 'longblob'
  },
  toDriver(value) {
    if (value == null) return null
    if (typeof value === 'string') {
      const s = value.trim()
      if (!s) return null
      return Buffer.from(s, 'utf8')
    }
    return Buffer.from(JSON.stringify(value), 'utf8')
  },
  fromDriver(value) {
    if (value == null) return null
    const buf = Buffer.isBuffer(value) ? value : Buffer.from(value as Uint8Array)
    if (buf.length === 0) return null
    try {
      const parsed: unknown = JSON.parse(buf.toString('utf8'))
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as ImageNotesBlob
      }
      return null
    } catch {
      return null
    }
  },
})

// Album Model. Keys/URLs match SmugMug API: albumKey (e.g. jHhcL7), uri (API path), webUri (public gallery URL).
export const albums = mysqlTable('albums', {
  ...baseTableConfig,
  albumKey: vc('album_key'),
  description: text('description'),
  name: vc('name'),
  privacy: vc('privacy'),
  url: vc('url'),
  urlName: vc('url_name'),
  uri: vc('uri'),
  webUri: vc('web_uri'),
  dateAdded: vc('date_added'),
  dateModified: vc('date_modified'),
  password: vc('password')
})

export type Album = InferSelectModel<typeof albums>
export type NewAlbum = InferInsertModel<typeof albums>

// Image Model
export const images = mysqlTable('images', {
  ...baseTableConfig,
  albumKey: vc('album_key'),
  /** Site-local JSON document as UTF-8 bytes (Thalia DB); distinct from SmugMug `caption`. */
  notesBlob: imageNotesBlobColumn('notes_blob'),
  caption: text('caption'),
  albumId: int('album_id').references(() => albums.id),
  filename: vc('filename'),
  url: vc('url'),
  originalSize: int('original_size'),
  originalWidth: int('original_width'),
  originalHeight: int('original_height'),
  thumbnailUrl: vc('thumbnail_url'),
  archivedUri: vc('archived_uri'),
  archivedSize: int('archived_size'),
  archivedMD5: vc('archived_md5'),
  imageKey: vc('image_key').notNull(),
  preferredDisplayFileExtension: vc('preferred_display_file_extension'),
  uri: vc('uri')
})

export type Image = InferSelectModel<typeof images>
export type NewImage = InferInsertModel<typeof images>

// Factory functions (reserved for per-site table config; currently returns shared schema tables.)
export function AlbumFactory(_config: typeof baseTableConfig) {
  return albums
}

export function ImageFactory(_config: typeof baseTableConfig) {
  return images
}
