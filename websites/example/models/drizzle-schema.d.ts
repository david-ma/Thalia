/**
 * Usage:
 * - Add your model schemas here
 * - pnpm drizzle-kit generate
 * - pnpm drizzle-kit push
 */
import { MySqlTableWithColumns } from 'drizzle-orm/mysql-core';
declare const users: MySqlTableWithColumns<any>;
declare const sessions: MySqlTableWithColumns<any>;
declare const audits: MySqlTableWithColumns<any>;
declare const albums: MySqlTableWithColumns<any>;
declare const images: MySqlTableWithColumns<any>;
declare const mail: MySqlTableWithColumns<any>;
import { fruit } from './fruit.js';
export { users, sessions, audits, albums, images, fruit, mail };
