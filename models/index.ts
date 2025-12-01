/**
 * Models for Thalia framework using Drizzle ORM
 * 
 * This file exports all models and their types, providing a central point
 * for accessing database models throughout the application.
 */

// Import models
import { users, sessions, audits, type User, type NewUser, type Session, type NewSession, type Audit, type NewAudit } from './security-models'
import { albums, images, type Album, type NewAlbum, type Image, type NewImage } from './smugmug'

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
export { UserFactory, SessionFactory, AuditFactory } from './security-models'
export { AlbumFactory, ImageFactory } from './smugmug'

// Export all from security
// export * from './security'
import * as security from './security-models'
export { security }

// Export all from util
import * as util from './util'
export { util }
