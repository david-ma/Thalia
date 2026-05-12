import { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { customType, mysqlTable, text, int } from 'drizzle-orm/mysql-core'
import { vc, baseTableConfig } from './util'

/**
 * Arbitrary JSON **object** stored as UTF-8 bytes in `images.notes_blob` (LONGBLOB).
 * At runtime, inserts may also pass a **string** (already JSON object text, e.g. from a form); from TypeScript
 * use {@link notesBlobToBuffer} or cast to {@link ImageNotesBlobInput} for `toDriver`. Empty / whitespace-only strings become SQL NULL.
 */
export type ImageNotesBlob = Record<string, unknown>

/** Wider write-side input (Drizzle `toDriver` accepts this at runtime; column `data` stays object|null for selects). */
export type ImageNotesBlobInput = ImageNotesBlob | string | null

function bufferLikeToBuffer(raw: Buffer | Uint8Array): Buffer {
  return Buffer.isBuffer(raw) ? raw : Buffer.from(raw)
}

/** Serialise a notes value for `images.notes_blob` (UTF-8 bytes; SQL NULL for empty / whitespace-only string). */
export function notesBlobToBuffer(value: ImageNotesBlobInput): Buffer | null {
  if (value == null) return null
  if (typeof value === 'string') {
    const t = value.trim()
    if (t.length === 0) return null
    return Buffer.from(t, 'utf8')
  }
  return Buffer.from(JSON.stringify(value), 'utf8')
}

const imageNotesBlobColumn = customType<{
  data: ImageNotesBlob | null
  driverData: Buffer | Uint8Array | null
}>({
  dataType() {
    return 'longblob'
  },
  toDriver(value: ImageNotesBlob | null) {
    return notesBlobToBuffer(value as ImageNotesBlobInput)
  },
  fromDriver(raw: Buffer | Uint8Array | null): ImageNotesBlob | null {
    if (raw == null) return null
    const buf = bufferLikeToBuffer(raw)
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
  /** SmugMug image key — null for non-SmugMug adapters (UploadThing, local-disk). */
  imageKey: vc('image_key'),
  preferredDisplayFileExtension: vc('preferred_display_file_extension'),
  uri: vc('uri'),
  /** Which adapter stored this image: 'smugmug' | 'uploadthing' | 'local-disk'. */
  adapterName: vc('adapter_name', 64),
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
