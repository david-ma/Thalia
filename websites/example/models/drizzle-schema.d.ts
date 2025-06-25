/**
 * Usage:
 * - Add your model schemas here
 * - pnpm drizzle-kit generate
 * - pnpm drizzle-kit push
 */
import { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
declare const users: SQLiteTableWithColumns<any>;
declare const sessions: SQLiteTableWithColumns<any>;
declare const audits: SQLiteTableWithColumns<any>;
declare const albums: SQLiteTableWithColumns<any>;
declare const images: SQLiteTableWithColumns<any>;
declare const mail: SQLiteTableWithColumns<any>;
import { fruit } from './fruit.js';
export { users, sessions, audits, albums, images, fruit, mail };
