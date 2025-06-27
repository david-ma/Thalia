import { mysqlTable, text, int, varchar } from 'drizzle-orm/mysql-core'
import { MySqlTableWithColumns } from 'drizzle-orm/mysql-core'
import { vc, baseTableConfig } from './util.js'

// Album Model
export const albums: MySqlTableWithColumns<any> = mysqlTable('albums', {
  ...baseTableConfig,
  description: text('description'),
  name: vc('name').notNull(),
  privacy: vc('privacy').notNull(),
  url: vc('url').notNull(),
  password: vc('password').notNull()
})

export type Album = typeof albums.$inferSelect
export type NewAlbum = typeof albums.$inferInsert

// Image Model
export const images: MySqlTableWithColumns<any> = mysqlTable('images', {
  ...baseTableConfig,
  caption: text('caption'),
  albumId: int('album_id').notNull().references(() => albums.id),
  filename: vc('filename').notNull(),
  url: vc('url').notNull(),
  originalSize: int('original_size').notNull(),
  originalWidth: int('original_width').notNull(),
  originalHeight: int('original_height').notNull(),
  thumbnailUrl: vc('thumbnail_url').notNull(),
  archivedUri: vc('archived_uri').notNull(),
  archivedSize: int('archived_size').notNull(),
  archivedMD5: vc('archived_md5').notNull(),
  imageKey: vc('image_key').notNull(),
  preferredDisplayFileExtension: vc('preferred_display_file_extension').notNull(),
  uri: vc('uri').notNull()
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
