import { users, sessions, audits, albums, images } from '../models/drizzle-schema.js';
import { fruit } from '../models/fruit.js';
import { CrudFactory } from 'thalia/controllers';
const FruitMachine = new CrudFactory(fruit);
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
        },
        machines: {
            fruit: FruitMachine
        }
    },
    controllers: {
        fruit: FruitMachine.entrypoint.bind(FruitMachine),
    }
};
//# sourceMappingURL=config.js.map