/**
 * Models for Thalia framework using Drizzle ORM
 *
 * This file exports all models and their types, providing a central point
 * for accessing database models throughout the application.
 */
import { type User, type NewUser, type Session, type NewSession, type Audit, type NewAudit } from './security-models.js';
import { type Album, type NewAlbum, type Image, type NewImage } from './smugmug.js';
export type { User, NewUser, Session, NewSession, Audit, NewAudit };
export type { Album, NewAlbum, Image, NewImage };
export declare const models: {
    users: import("drizzle-orm/mysql-core").MySqlTableWithColumns<any>;
    sessions: import("drizzle-orm/mysql-core").MySqlTableWithColumns<any>;
    audits: import("drizzle-orm/mysql-core").MySqlTableWithColumns<any>;
    albums: import("drizzle-orm/mysql-core").MySqlTableWithColumns<any>;
    images: import("drizzle-orm/mysql-core").MySqlTableWithColumns<any>;
};
export { UserFactory, SessionFactory, AuditFactory } from './security-models.js';
export { AlbumFactory, ImageFactory } from './smugmug.js';
import * as security from './security-models.js';
export { security };
import * as util from './util.js';
export { util };
//# sourceMappingURL=index.d.ts.map