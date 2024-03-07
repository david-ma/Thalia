import { users, SecurityOptions } from 'thalia'

const securityOptions: SecurityOptions = {
  websiteName: 'default',
  mailFrom: 'Thalia <thalia@david-ma.net>',
  mailAuth: {
    user: '',
    pass: '',
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
