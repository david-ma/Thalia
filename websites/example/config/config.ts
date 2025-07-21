import { fruit } from '../models/fruit.js'

import { RawWebsiteConfig } from 'thalia/types'
import { CrudFactory } from 'thalia/controllers'
import { ThaliaSecurity } from 'thalia/security'
import { recursiveObjectMerge } from 'thalia/website'

const FruitMachine = new CrudFactory(fruit)

const fruitConfig: RawWebsiteConfig = {
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
}

import path from 'path'
const mailAuthPath = path.join(import.meta.dirname, 'mailAuth.js')

const security = new ThaliaSecurity({
  mailAuthPath: mailAuthPath,
})

const roleBasedSecurityConfig: RawWebsiteConfig = recursiveObjectMerge(
  recursiveObjectMerge(security.securityConfig(), fruitConfig),
  {
    routes: [
      {
        path: '/fruit',
        permissions: {
          admin: ['read', 'update', 'delete', 'create'],
          user: ['read'],
          guest: ['read'],
        },
      },
    ],
  },
)
export const config: RawWebsiteConfig = roleBasedSecurityConfig
