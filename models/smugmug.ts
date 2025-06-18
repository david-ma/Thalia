import {
  sqliteTable,
  text,
  integer,
  type SQLiteTableWithColumns
} from 'drizzle-orm/sqlite-core'
import { baseTableConfig } from './util.js'

// Album Model
export const albums: SQLiteTableWithColumns<any> = sqliteTable('albums', {
  ...baseTableConfig,
  description: text('description'),
  name: text('name').notNull(),
  privacy: text('privacy').notNull(),
  url: text('url').notNull(),
  password: text('password').notNull()
})

export type Album = typeof albums.$inferSelect
export type NewAlbum = typeof albums.$inferInsert

// Image Model
export const images = sqliteTable('images', {
  ...baseTableConfig,
  caption: text('caption'),
  albumId: text('album_id').notNull().references(() => albums.id),
  filename: text('filename').notNull(),
  url: text('url').notNull(),
  originalSize: integer('original_size').notNull(),
  originalWidth: integer('original_width').notNull(),
  originalHeight: integer('original_height').notNull(),
  thumbnailUrl: text('thumbnail_url').notNull(),
  archivedUri: text('archived_uri').notNull(),
  archivedSize: integer('archived_size').notNull(),
  archivedMD5: text('archived_md5').notNull(),
  imageKey: text('image_key').notNull(),
  preferredDisplayFileExtension: text('preferred_display_file_extension').notNull(),
  uri: text('uri').notNull()
})

export type Image = typeof images.$inferSelect
export type NewImage = typeof images.$inferInsert

// Factory functions
export function AlbumFactory(config: typeof baseTableConfig) {
  return albums
}

export function ImageFactory(config: typeof baseTableConfig) {
  return images
}
