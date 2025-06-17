import { sql } from 'drizzle-orm'
import { 
  sqliteTable, 
  text, 
  integer, 
  primaryKey,
  type SQLiteTableWithColumns
} from 'drizzle-orm/sqlite-core'

// Base table configuration
const baseTableConfig = {
  id: text('id').primaryKey().notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}

// User Model
export const users = sqliteTable('users', {
  ...baseTableConfig,
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  photo: text('photo'),
  role: text('role').notNull().default('user'),
  locked: integer('locked', { mode: 'boolean' }).notNull().default(false),
  verified: integer('verified', { mode: 'boolean' }).notNull().default(false)
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

// Session Model
export const sessions = sqliteTable('sessions', {
  sid: text('sid').primaryKey().notNull(),
  expires: text('expires').notNull(),
  data: text('data', { mode: 'json' }),
  userId: text('user_id').references(() => users.id),
  loggedOut: integer('logged_out', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
})

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert

// Audit Model
export const audits = sqliteTable('audits', {
  ...baseTableConfig,
  userId: text('user_id').references(() => users.id),
  ip: text('ip').notNull(),
  sessionId: text('session_id').references(() => sessions.sid),
  action: text('action').notNull(),
  blob: text('blob', { mode: 'json' }),
  timestamp: text('timestamp').notNull().default(sql`CURRENT_TIMESTAMP`)
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
