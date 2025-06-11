import { users } from 'thalia/server';
// import { cred } from './cred.js'
const securityOptions = {
    websiteName: 'default',
    mailFrom: 'Thalia <thalia@david-ma.net>',
    mailAuth: {
        user: 'user@david-ma.net',
        pass: 'password',
    },
};
export const config = {
    domains: [],
    data: false,
    dist: false,
    controllers: {
        ...users(securityOptions),
    },
};
//# sourceMappingURL=config.js.map