// import { RawWebsiteConfig } from 'thalia/types'
// import { users, sessions, audits } from 'thalia/models'


// import { users } from 'thalia/models'

import { RawWebsiteConfig } from 'thalia/types'

import { users, sessions, audits, albums, images } from '../models/drizzle-schema.js'
import { fruit } from '../models/fruit.js'


export const config: RawWebsiteConfig = {
  domains: ['example.com'],
  database: {
    schemas: {
      users,
      sessions,
      audits,
      albums,
      images,
      fruit
    }
  }
}






