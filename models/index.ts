import { Sequelize, Options } from '@sequelize/core'
import { MariaDbDialect } from '@sequelize/mariadb'
import { UserFactory, SessionFactory, AuditFactory } from './security'
import { AlbumFactory, ImageFactory } from './smugmug'
import { SeqObject } from './types'

export interface DatabaseConfig {
  dialect: 'mariadb'
  host: string
  port: number
  database: string
  user: string
  password: string
  logging?: false | ((sql: string, timing?: number) => void)
  pool?: {
    max?: number
    min?: number
    acquire?: number
    idle?: number
  }
}

export function securityFactory(config: DatabaseConfig): SeqObject {
  const options: Options<MariaDbDialect> = {
    dialect: 'mariadb',
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    logging: config.logging ?? false,
    pool: config.pool || {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      underscored: true,
      timestamps: true
    }
  }

  const sequelize = new Sequelize(options)
  const User = UserFactory(sequelize)
  const Session = SessionFactory(sequelize)
  const Audit = AuditFactory(sequelize)

  Session.belongsTo(User, { foreignKey: 'userId', targetKey: 'id' })
  User.hasMany(Session, { foreignKey: 'userId', sourceKey: 'id' })

  Audit.belongsTo(User, { foreignKey: 'userId', targetKey: 'id' })
  User.hasMany(Audit, { foreignKey: 'userId', sourceKey: 'id' })

  Audit.belongsTo(Session, { foreignKey: 'sessionId', targetKey: 'sid' })
  Session.hasMany(Audit, { foreignKey: 'sessionId', sourceKey: 'sid' })

  return {
    sequelize,
    models: {
      User,
      Session,
      Audit,
    }
  }
}

// Export all models
export * from './security'

export interface SmugmugConfig {
  dialect: 'sqlite3'
  storage: string
  logging?: false | ((sql: string, timing?: number) => void)
  pool?: {
    max?: number
    min?: number
    acquire?: number
    idle?: number
  }
}

export interface SmugmugObject extends SeqObject {
  Album: typeof AlbumFactory
  Image: typeof ImageFactory
}

export function smugmugFactory(config: DatabaseConfig): SeqObject {
  const options: Options<MariaDbDialect> = {
    dialect: 'mariadb',
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    logging: config.logging ?? false,
    pool: config.pool || {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      underscored: true,
      timestamps: true
    }
  }

  const sequelize = new Sequelize(options)
  const Album = AlbumFactory(sequelize)
  const Image = ImageFactory(sequelize)

  Album.hasMany(Image, { foreignKey: 'albumId', sourceKey: 'id' })
  Image.belongsTo(Album, { foreignKey: 'albumId', targetKey: 'id' })

  return {
    sequelize,
    models: {
      Album,
      Image,
    }
  }
}
