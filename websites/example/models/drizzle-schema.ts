import { models } from '../node_modules/thalia/dist/models/index.js'
import { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core'

const users: SQLiteTableWithColumns<any> = models.users
const sessions: SQLiteTableWithColumns<any> = models.sessions
const audits: SQLiteTableWithColumns<any> = models.audits
const albums: SQLiteTableWithColumns<any> = models.albums
const images: SQLiteTableWithColumns<any> = models.images



// export { users, sessions, audits, albums, images }

import { fruit } from './fruit.js'
export { users, sessions, audits, albums, images, fruit }