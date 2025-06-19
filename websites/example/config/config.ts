// import { RawWebsiteConfig } from 'thalia/types'
// import { users, sessions, audits } from 'thalia/models'

// import { users } from 'thalia/models'

import { RawWebsiteConfig } from 'thalia/types'

import { users, sessions, audits, albums, images } from '../models/drizzle-schema.js'
import { fruit } from '../models/fruit.js'

import { CrudFactory } from 'thalia/controllers'

const FruitMachine = new CrudFactory(fruit)
const AlbumMachine = new CrudFactory(albums)
const ImageMachine = new CrudFactory(images)

const UserMachine = new CrudFactory(users, {
  relationships: [
    {
      foreignTable: 'sessions',
      foreignColumn: 'userId',
      localColumn: 'id',
    },
  ],
})
const SessionMachine = new CrudFactory(sessions, {
  relationships: [
    {
      foreignTable: 'users',
      foreignColumn: 'id',
      localColumn: 'userId',
    },
  ],
})
const AuditMachine = new CrudFactory(audits, {
  relationships: [
    {
      foreignTable: 'users',
      foreignColumn: 'id',
      localColumn: 'userId',
    },
    {
      foreignTable: 'sessions',
      foreignColumn: 'sid',
      localColumn: 'sessionId',
    },
  ],
})

export const config: RawWebsiteConfig = {
  domains: ['example.com'],
  database: {
    schemas: {
      users,
      sessions,
      audits,
      albums,
      images,
      fruit,
    },
    machines: {
      fruit: FruitMachine,
      users: UserMachine,
      sessions: SessionMachine,
      audits: AuditMachine,
      albums: AlbumMachine,
      images: ImageMachine,
    },
  },
  controllers: {
    fruit: FruitMachine.controller.bind(FruitMachine),
    users: UserMachine.controller.bind(UserMachine),
    sessions: SessionMachine.controller.bind(SessionMachine),
    audits: AuditMachine.controller.bind(AuditMachine),
    albums: AlbumMachine.controller.bind(AlbumMachine),
    images: ImageMachine.controller.bind(ImageMachine),
  },
  routes: [
    {
      password: 'password',
    },
  ],
}
