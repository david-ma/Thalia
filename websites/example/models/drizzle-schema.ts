/**
 * Usage:
 * - Add your model schemas here
 * - pnpm drizzle-kit generate
 * - pnpm drizzle-kit push
 */

import { models } from '../node_modules/thalia/dist/models/index.js'
// import { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core'
import { MySqlTableWithColumns } from 'drizzle-orm/mysql-core'

const users: MySqlTableWithColumns<any> = models.users
const sessions: MySqlTableWithColumns<any> = models.sessions
const audits: MySqlTableWithColumns<any> = models.audits
const albums: MySqlTableWithColumns<any> = models.albums
const images: MySqlTableWithColumns<any> = models.images

import { mailTable } from '../node_modules/thalia/dist/server/mail.js'
const mail: MySqlTableWithColumns<any> = mailTable


// export { users, sessions, audits, albums, images }

import { fruit } from './fruit.js'
export { users, sessions, audits, albums, images, fruit, mail }