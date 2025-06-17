/**
 * This file is the entrypoint for websites to enable a database connection.
 * 
 * The Thalia framework uses drizzle-orm for database connections.
 * The Thalia framework provides some generic models in Thalia/models.
 * Websites built on Thalia will have their own /models directory.
 * Websites built on Thalia will import the database connection from this file.
 * This file will read the models specified in the website's config/config.ts file, and then import them from the Thalia framework or the website's own models directory.
 * 
 * The database connection is then provided to the website's controllers.
 * In Thalia/server/controllers.ts, we will provide a CRUD factory, which will provide a lot of easy to use functions for CRUD operations.
 * In Thalia/src/views/scaffold, we will provide some base CRUD templates which can be easily overridden by the website.
 * 
 * TODO:
 * Rewrite this file to use drizzle-orm instead of sequelize.
 */


import { Sequelize, Options, Model, ModelStatic } from '@sequelize/core'
import { MariaDbDialect } from '@sequelize/mariadb'
import { SeqObject } from '../models/types.js'


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

export class Database implements SeqObject {
  private static instance: Database
  public sequelize: Sequelize
  public models: {
    [key: string]: ModelStatic<Model>
  } = {}

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
    return {
      sequelize: this.sequelize,
      models: this.models
    }
  }

  public getSequelize(): Sequelize {
    return this.sequelize
  }

  public async close(): Promise<void> {
    await this.sequelize.close()
  }
}
