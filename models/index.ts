/**
 * Models for Thalia framework using Drizzle ORM
 * 
 * This file exports all models and their types, providing a central point
 * for accessing database models throughout the application.
 */

import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { type SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core'

// Import models
import { users, sessions, audits, type User, type NewUser, type Session, type NewSession, type Audit, type NewAudit } from './security.js'
import { albums, images, type Album, type NewAlbum, type Image, type NewImage } from './smugmug.js'

// Export types
export type { User, NewUser, Session, NewSession, Audit, NewAudit }
export type { Album, NewAlbum, Image, NewImage }

// Export interfaces
export interface DatabaseConfig {
  url: string
  logging?: boolean
}

// Export model tables
export const models = {
  users,
  sessions,
  audits,
  albums,
  images
}

// Export factory functions
export { UserFactory, SessionFactory, AuditFactory } from './security.js'
export { AlbumFactory, ImageFactory } from './smugmug.js'

// Export all from security
export * from './security.js'
