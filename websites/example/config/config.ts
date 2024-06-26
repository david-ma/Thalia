import { users, SecurityOptions } from '../../../server/helpers'

import { cred } from './cred'

const securityOptions: SecurityOptions = {
  websiteName: 'default',
  mailFrom: 'Thalia <thalia@david-ma.net>',
  mailAuth: cred.mailAuth,
}

exports.config = {
  domains: [],
  data: false,
  dist: false,
  controllers: {
    ...users(securityOptions),
  },
}
