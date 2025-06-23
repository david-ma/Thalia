import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { type SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core'
import { users, sessions, audits } from './security-models.js'
import { albums, images } from './smugmug.js'

export interface SeqObject {
  db: BetterSQLite3Database
  models: {
    [key: string]: SQLiteTableWithColumns<any>
  }
}

export interface SecurityObject extends SeqObject {
  models: {
    User: typeof users
    Session: typeof sessions
    Audit: typeof audits
  }
}

export interface SmugmugObject extends SeqObject {
  models: {
    Album: typeof albums
    Image: typeof images
  }
}