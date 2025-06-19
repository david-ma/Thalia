/**
 * Models for Thalia framework using Drizzle ORM
 *
 * This file exports all models and their types, providing a central point
 * for accessing database models throughout the application.
 */
// Import models
import { users, sessions, audits } from './security.js';
import { albums, images } from './smugmug.js';
// Export model tables
export const models = {
    users,
    sessions,
    audits,
    albums,
    images
};
// Export factory functions
export { UserFactory, SessionFactory, AuditFactory } from './security.js';
export { AlbumFactory, ImageFactory } from './smugmug.js';
// Export all from security
// export * from './security.js'
import * as security from './security.js';
export { security };
// Export all from util
import * as util from './util.js';
export { util };
//# sourceMappingURL=index.js.map