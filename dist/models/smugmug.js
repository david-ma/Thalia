import { mysqlTable, text, int } from 'drizzle-orm/mysql-core';
import { vc, baseTableConfig } from './util.js';
// Album Model
export const albums = mysqlTable('albums', {
    ...baseTableConfig,
    description: text('description'),
    name: vc('name').notNull(),
    privacy: vc('privacy').notNull(),
    url: vc('url').notNull(),
    password: vc('password').notNull()
});
// Image Model
export const images = mysqlTable('images', {
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
});
// Factory functions
export function AlbumFactory(config) {
    return albums;
}
export function ImageFactory(config) {
    return images;
}
//# sourceMappingURL=smugmug.js.map