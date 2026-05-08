/**
 * Usage:
 * - Add your model schemas here
 * - bun drizzle-kit generate
 * - bun drizzle-kit push
 *
 * Note: in the Thalia monorepo/dev checkout, we import via package exports
 * so tests and local server runs don't depend on a `node_modules/thalia` install.
 */

import { models } from 'thalia/models';
import type { MySqlTableWithColumns } from 'drizzle-orm/mysql-core';

const users = models.users;
const sessions = models.sessions;
const audits = models.audits;
const albums = models.albums;
const images = models.images;

import { mailTable } from 'thalia/mail';
const mail = mailTable as MySqlTableWithColumns<any>;

import { fruit } from './fruit';
export { users, sessions, audits, albums, images, fruit, mail };