import { MySqlTableWithColumns } from 'drizzle-orm/mysql-core';
import { baseTableConfig } from './util.js';
export declare const albums: MySqlTableWithColumns<any>;
export type Album = typeof albums.$inferSelect;
export type NewAlbum = typeof albums.$inferInsert;
export declare const images: MySqlTableWithColumns<any>;
export type Image = typeof images.$inferSelect;
export type NewImage = typeof images.$inferInsert;
export declare function AlbumFactory(config: typeof baseTableConfig): MySqlTableWithColumns<any>;
export declare function ImageFactory(config: typeof baseTableConfig): MySqlTableWithColumns<any>;
//# sourceMappingURL=smugmug.d.ts.map