import { RawWebsiteConfig } from 'thalia/types'
// import { users, sessions, audits } from 'thalia/models'


// import { users } from 'thalia/models'

import { users } from '../models/users.js'



export const config: RawWebsiteConfig = {
  domains: ['example.com'],
  database: {
    schemas: {
      users
    }
  }
}






