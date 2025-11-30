/**
 * Usage:
 * - Add your model schemas here
 * - pnpm drizzle-kit generate
 * - pnpm drizzle-kit push
 */
import { models } from '../node_modules/thalia/dist/models/index.js';
const users = models.users;
const sessions = models.sessions;
const audits = models.audits;
const albums = models.albums;
const images = models.images;
import { mailTable } from '../node_modules/thalia/dist/server/mail.js';
const mail = mailTable;
// export { users, sessions, audits, albums, images }
import { fruit } from './fruit.js';
export { users, sessions, audits, albums, images, fruit, mail };
//# sourceMappingURL=drizzle-schema.js.map