// import { RawWebsiteConfig } from 'thalia/types'
// import { users, sessions, audits } from 'thalia/models'
// import { users } from 'thalia/models'
import { fruit } from '../models/fruit.js';
const FruitMachine = new CrudFactory(fruit);
import { CrudFactory } from 'thalia/controllers';
import { securityConfig } from 'thalia/security';
import { recursiveObjectMerge } from 'thalia/website';
const fruitConfig = {
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
};
const basicSecurityConfig = recursiveObjectMerge({
    routes: [
        {
            path: '/fruit',
            password: 'hunter2',
        },
    ],
}, fruitConfig);
const roleBasedSecurityConfig = recursiveObjectMerge(recursiveObjectMerge(securityConfig, fruitConfig), {
    routes: [
        {
            path: '/fruit',
            permissions: {
                admin: ['view', 'edit', 'delete', 'create'],
                user: ['view'],
                guest: ['view'],
            },
        },
    ],
});
// export const config: RawWebsiteConfig = basicSecurityConfig
export const config = roleBasedSecurityConfig;
//# sourceMappingURL=config.js.map