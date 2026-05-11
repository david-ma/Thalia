import type { MySql2Database } from 'drizzle-orm/mysql2'
import type { MySqlTableWithColumns } from 'drizzle-orm/mysql-core'
import { users, sessions, audits } from './security-models'
import { albums, images } from './smugmug'

/** DB + schema tables (Thalia sites use Drizzle + mysql2). */
export interface SeqObject {
  db: MySql2Database<any>
  models: Record<string, MySqlTableWithColumns<any>>
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