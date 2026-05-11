import { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { mysqlTable, text, int, boolean, json, timestamp } from 'drizzle-orm/mysql-core'
import { vc, baseTableConfig } from './util'

// User Model
export const users = mysqlTable('users', {
  ...baseTableConfig,
  name: vc('name').notNull(),
  // email: text('email').notNull().unique(), // Unique causing issues in SQLite3 with DrizzleKit
  email: vc('email').notNull().unique(),
  password: vc('password').notNull(),
  photo: text('photo'),
  role: vc('role').notNull().default('user'),
  locked: boolean('locked').notNull().default(false),
  verified: boolean('verified').notNull().default(false),
  passwordResetToken: vc('password_reset_token', 255),
  passwordResetExpires: timestamp('password_reset_expires'),
})

export type User = InferSelectModel<typeof users>
export type NewUser = InferInsertModel<typeof users>

// Session Model
export const sessions = mysqlTable('sessions', {
  sid: vc('sid').primaryKey().notNull(),
  expires: timestamp('expires'),
  data: json('data'),
  userId: int('user_id').references(() => users.id),
  loggedOut: boolean('logged_out').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow()
})

export type Session = InferSelectModel<typeof sessions>
export type NewSession = InferInsertModel<typeof sessions>

// Audit Model
export const audits = mysqlTable('audits', {
  ...baseTableConfig,
  userId: int('user_id').references(() => users.id),
  ip: vc('ip').notNull(),
  sessionId: vc('session_id').references(() => sessions.sid),
  action: vc('action').notNull(),
  blob: json('blob'),
  timestamp: timestamp('timestamp').notNull().defaultNow()
})

export type Audit = InferSelectModel<typeof audits>
export type NewAudit = InferInsertModel<typeof audits>

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
