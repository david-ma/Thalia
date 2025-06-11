// import { users, SecurityOptions } from 'thalia/server'
// // import { cred } from './cred.js'
// const securityOptions: SecurityOptions = {
//   websiteName: 'default',
//   mailFrom: 'Thalia <thalia@david-ma.net>',
//   mailAuth: {
//     user: 'user@david-ma.net',
//     pass: 'password',
//   },
// }
// export const config = {
//   domains: [],
//   data: false,
//   dist: false,
//   controllers: {
//     ...users(securityOptions),
//   },
// }
import { latestlogs } from 'thalia/website';
export const config = {
    domains: ['example.com'],
    controllers: {
        latestlogs
    }
};
//# sourceMappingURL=config.js.map