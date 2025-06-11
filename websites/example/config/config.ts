import { users, SecurityOptions } from 'thalia'

// import { cred } from './cred'

const securityOptions: SecurityOptions = {
  websiteName: 'default',
  mailFrom: 'Thalia <thalia@david-ma.net>',
  mailAuth: {
    user: 'user@david-ma.net',
    pass: 'password',
  },
}

exports.config = {
  domains: [],
  data: false,
  dist: false,
  controllers: {
    ...users(securityOptions),
  },
}
