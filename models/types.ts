import { Sequelize } from '@sequelize/core'
import { User } from './security'
import { Session } from './security'
import { Audit } from './security'
import { Album } from './smugmug'
import { Image } from './smugmug'

export interface SeqObject {
  sequelize: Sequelize
  User?: typeof User
  Session?: typeof Session
  Audit?: typeof Audit
  Album?: typeof Album
  Image?: typeof Image
} 