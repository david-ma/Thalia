import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { baseTableConfig } from './util.js';
// Album Model
export const albums = sqliteTable('albums', {
    ...baseTableConfig,
    description: text('description'),
    name: text('name').notNull(),
    privacy: text('privacy').notNull(),
    url: text('url').notNull(),
    password: text('password').notNull()
});
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
});
// Factory functions
export function AlbumFactory(config) {
    return albums;
}
export function ImageFactory(config) {
    return images;
}
//# sourceMappingURL=smugmug.js.map