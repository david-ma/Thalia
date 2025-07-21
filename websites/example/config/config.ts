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
  mailAuthPath,
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



import { albums, images } from '../models/drizzle-schema.js'
const AlbumMachine = new CrudFactory(albums)
const ImageMachine = new CrudFactory(images)

const smugmugConfig: RawWebsiteConfig = {
  controllers: {
    albums: AlbumMachine.controller.bind(AlbumMachine),
    images: ImageMachine.controller.bind(ImageMachine),
  },
  database: {
    schemas: {
      albums,
      images,
    },
    machines: {
      albums: AlbumMachine,
      images: ImageMachine,
    },
  },
}


export const config: RawWebsiteConfig = recursiveObjectMerge(roleBasedSecurityConfig, smugmugConfig)
