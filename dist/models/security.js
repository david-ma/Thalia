import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { baseTableConfig } from './util.js';
export const users = sqliteTable('users', {
    ...baseTableConfig,
    name: text('name').notNull(),
    email: text('email').notNull(),
    password: text('password').notNull(),
    photo: text('photo'),
    role: text('role').notNull().default('user'),
    locked: integer('locked', { mode: 'boolean' }).notNull().default(false),
    verified: integer('verified', { mode: 'boolean' }).notNull().default(false)
});
export const sessions = sqliteTable('sessions', {
    sid: text('sid').primaryKey().notNull(),
    expires: text('expires').notNull(),
    data: text('data', { mode: 'json' }),
    userId: text('user_id').references(() => users.id),
    loggedOut: integer('logged_out', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull().default(sql `CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql `CURRENT_TIMESTAMP`)
});
export const audits = sqliteTable('audits', {
    ...baseTableConfig,
    userId: text('user_id').references(() => users.id),
    ip: text('ip').notNull(),
    sessionId: text('session_id').references(() => sessions.sid),
    action: text('action').notNull(),
    blob: text('blob', { mode: 'json' }),
    timestamp: text('timestamp').notNull().default(sql `CURRENT_TIMESTAMP`)
});
export function UserFactory(config) {
    return users;
}
export function SessionFactory(config) {
    return sessions;
}
export function AuditFactory(config) {
    return audits;
}
//# sourceMappingURL=security.js.map