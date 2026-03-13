/**
 * Usage:
 * - Add your model schemas here
 * - bun drizzle-kit generate
 * - bun drizzle-kit push
 *
 * Import from '../node_modules/thalia/...' so drizzle-kit (CJS) can resolve
 * without hitting package exports. See SmugMug models/master-schema.ts.
 */

import { models } from '../node_modules/thalia/models';
import type { MySqlTableWithColumns } from 'drizzle-orm/mysql-core';

const users = models.users;
const sessions = models.sessions;
const audits = models.audits;
const albums = models.albums;
const images = models.images;

import { mailTable } from '../node_modules/thalia/server/mail';
const mail = mailTable as MySqlTableWithColumns<any>;

import { fruit } from './fruit';
export { users, sessions, audits, albums, images, fruit, mail };