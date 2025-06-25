import { fruit } from '../models/fruit.js'

const FruitMachine = new CrudFactory(fruit)

import { RawWebsiteConfig } from 'thalia/types'
import { CrudFactory } from 'thalia/controllers'
import { securityConfig } from 'thalia/security'
import { recursiveObjectMerge } from 'thalia/website'

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

import { MailService } from 'thalia/mail'
import path from 'path'
const mailAuthPath = path.join(import.meta.dirname, 'mailAuth.js')
const mailService = new MailService(mailAuthPath)

const roleBasedSecurityConfig: RawWebsiteConfig = recursiveObjectMerge(
  recursiveObjectMerge(securityConfig, fruitConfig),
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
    database: {
      schemas: {},
      machines: {
        mail: mailService,
      },
    },
  },
)
export const config: RawWebsiteConfig = roleBasedSecurityConfig
