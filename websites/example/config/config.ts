import { users, SecurityOptions } from 'thalia'

const securityOptions: SecurityOptions = {
  websiteName: 'default',
  mailFrom: 'Thalia <thalia@david-ma.net>',
  mailAuth: {
    user: '',
    pass: '',
  },
}

securityOptions.mailAuth = require('./cred.js').mailAuth

exports.config = {
  domains: [],
  data: false,
  dist: false,
  controllers: {
    ...users(securityOptions),
  },
}
