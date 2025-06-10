import { Sequelize, Options } from '@sequelize/core'
import { MariaDbDialect } from '@sequelize/mariadb'
import { securityFactory } from '../models'
import { SeqObject } from '../models/types'

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

export class Database {
  private static instance: Database
  private sequelize: Sequelize
  private models: SeqObject

  private constructor(config: DatabaseConfig) {
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

    this.sequelize = new Sequelize(options)
    this.models = securityFactory(options)
  }

  public static getInstance(config?: DatabaseConfig): Database {
    if (!Database.instance) {
      if (!config) {
        throw new Error('Database configuration is required for initialization')
      }
      Database.instance = new Database(config)
    }
    return Database.instance
  }

  public async connect(): Promise<void> {
    try {
      await this.sequelize.authenticate()
      console.log('Database connection established successfully')
    } catch (error) {
      console.error('Unable to connect to the database:', error)
      throw error
    }
  }

  public async sync(options?: { force?: boolean; alter?: boolean }): Promise<void> {
    try {
      await this.sequelize.sync(options)
      console.log('Database synchronized successfully')
    } catch (error) {
      console.error('Error synchronizing database:', error)
      throw error
    }
  }

  public getModels(): SeqObject {
    return this.models
  }

  public getSequelize(): Sequelize {
    return this.sequelize
  }

  public async close(): Promise<void> {
    await this.sequelize.close()
  }
}
