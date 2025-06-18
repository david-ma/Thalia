import { users, sessions, audits, albums, images } from '../models/drizzle-schema.js';
import { fruit } from '../models/fruit.js';
export const config = {
    domains: ['example.com'],
    database: {
        schemas: {
            users,
            sessions,
            audits,
            albums,
            images,
            fruit
        }
    }
};
//# sourceMappingURL=config.js.map