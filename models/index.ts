/**
 * Models for Thalia framework using Drizzle ORM
 * 
 * This file exports all models and their types, providing a central point
 * for accessing database models throughout the application.
 */

// Import models
import { users, sessions, audits, type User, type NewUser, type Session, type NewSession, type Audit, type NewAudit } from './security-models.js'
import { albums, images, type Album, type NewAlbum, type Image, type NewImage } from './smugmug.js'

// Export types
export type { User, NewUser, Session, NewSession, Audit, NewAudit }
export type { Album, NewAlbum, Image, NewImage }

// Export model tables
export const models = {
  users,
  sessions,
  audits,
  albums,
  images
}

// Export factory functions
export { UserFactory, SessionFactory, AuditFactory } from './security-models.js'
export { AlbumFactory, ImageFactory } from './smugmug.js'

// Export all from security
// export * from './security.js'
import * as security from './security-models.js'
export { security }

// Export all from util
import * as util from './util.js'
export { util }
