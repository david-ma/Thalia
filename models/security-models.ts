import { sql } from 'drizzle-orm'
import { mysqlTable, text, int, tinyint, boolean, varchar, json, timestamp } from 'drizzle-orm/mysql-core'
import { MySqlTableWithColumns } from 'drizzle-orm/mysql-core'
import { vc, baseTableConfig } from './util.js'

// User Model
export const users: MySqlTableWithColumns<any> = mysqlTable('users', {
  ...baseTableConfig,
  name: vc('name').notNull(),
  // email: text('email').notNull().unique(), // Unique causing issues in SQLite3 with DrizzleKit
  email: vc('email').notNull().unique(),
  password: vc('password').notNull(),
  photo: text('photo'),
  role: vc('role').notNull().default('user'),
  locked: boolean('locked').notNull().default(false),
  verified: boolean('verified').notNull().default(false)
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

// Session Model
export const sessions: MySqlTableWithColumns<any> = mysqlTable('sessions', {
  sid: vc('sid').primaryKey().notNull(),
  expires: timestamp('expires'),
  data: json('data'),
  userId: int('user_id').references(() => users.id),
  loggedOut: boolean('logged_out').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow()
})

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert

// Audit Model
export const audits: MySqlTableWithColumns<any> = mysqlTable('audits', {
  ...baseTableConfig,
  userId: int('user_id').references(() => users.id),
  ip: vc('ip').notNull(),
  sessionId: vc('session_id').references(() => sessions.sid),
  action: vc('action').notNull(),
  blob: json('blob'),
  timestamp: timestamp('timestamp').notNull().defaultNow()
})

export type Audit = typeof audits.$inferSelect
export type NewAudit = typeof audits.$inferInsert

// Factory functions
export function UserFactory(config: typeof baseTableConfig) {
  return users
}

export function SessionFactory(config: typeof baseTableConfig) {
  return sessions
}

export function AuditFactory(config: typeof baseTableConfig) {
  return audits
}
