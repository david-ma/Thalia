import { Sequelize, Model, ModelStatic } from '@sequelize/core'
import { User } from './security'
import { Session } from './security'
import { Audit } from './security'
import { Album } from './smugmug'
import { Image } from './smugmug'

export interface SeqObject {
  sequelize: Sequelize
  models: {
    [key: string]: ModelStatic<Model>
  }
}

export interface SecurityObject extends SeqObject {
  models: {
    User: ModelStatic<User>
    Session: ModelStatic<Session>
    Audit: ModelStatic<Audit>
  }
}

export interface SmugmugObject extends SeqObject {
  models: {
    Album: ModelStatic<Album>
    Image: ModelStatic<Image>
  }
}