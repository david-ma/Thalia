// import { RawWebsiteConfig } from 'thalia/types'
// import { users, sessions, audits } from 'thalia/models'
// import { users } from 'thalia/models'
import { fruit } from '../models/fruit.js';
const FruitMachine = new CrudFactory(fruit);
import { CrudFactory } from 'thalia/controllers';
import { securityConfig } from 'thalia/security';
import { recursiveObjectMerge } from 'thalia/website';
// recursiveObjectMerge(securityConfig, 
export const config = recursiveObjectMerge(securityConfig, {
    domains: ['example.com'],
    database: {
        schemas: {
            fruit,
        },
        machines: {
            fruit: FruitMachine,
        },
    },
    controllers: {
        fruit: FruitMachine.controller.bind(FruitMachine),
    },
});
//# sourceMappingURL=config.js.map