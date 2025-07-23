import { mysqlTable, text, int, varchar } from 'drizzle-orm/mysql-core'
import { MySqlTableWithColumns } from 'drizzle-orm/mysql-core'
import { vc, baseTableConfig } from './util.js'

// Album Model
export const albums: MySqlTableWithColumns<any> = mysqlTable('albums', {
  ...baseTableConfig,
  description: text('description'),
  name: vc('name'),
  privacy: vc('privacy'),
  url: vc('url'),
  password: vc('password')
})

export type Album = typeof albums.$inferSelect
export type NewAlbum = typeof albums.$inferInsert

// Image Model
export const images: MySqlTableWithColumns<any> = mysqlTable('images', {
  ...baseTableConfig,
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

export type Image = typeof images.$inferSelect
export type NewImage = typeof images.$inferInsert

// Factory functions
export function AlbumFactory(config: typeof baseTableConfig) {
  return albums
}

export function ImageFactory(config: typeof baseTableConfig) {
  return images
}
