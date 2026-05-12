/**
 * Models for Thalia framework using Drizzle ORM
 * 
 * This file exports all models and their types, providing a central point
 * for accessing database models throughout the application.
 */

// Import models
import { users, sessions, audits, type User, type NewUser, type Session, type NewSession, type Audit, type NewAudit } from './security-models'
import { albums, images, type Album, type NewAlbum, type Image, type NewImage } from './images'

// Export types
export type { User, NewUser, Session, NewSession, Audit, NewAudit }
export type { Album, NewAlbum, Image, NewImage }
export type { SeqObject, SecurityObject, SmugmugObject } from './types'

// Export model tables
export const models = {
  users,
  sessions,
  audits,
  albums,
  images,
}

export type ModelsRegistry = typeof models

// Export factory functions
export { UserFactory, SessionFactory, AuditFactory } from './security-models'
export { AlbumFactory, ImageFactory } from './images'

import * as security from './security-models'
export { security }

// Export all from util
import * as util from './util'
export { util }
