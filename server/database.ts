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
 */

import { drizzle } from 'drizzle-orm/better-sqlite3'
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { sql } from 'drizzle-orm'
import Database from 'better-sqlite3'
import { type DatabaseConfig } from './types.js'
import path from 'path'
import fs from 'fs'

export class ThaliaDatabase {
  private static instance: ThaliaDatabase
  private db: BetterSQLite3Database
  private sqlite: InstanceType<typeof Database>
  private config: DatabaseConfig
  private models: Map<string, any> = new Map()

  private constructor(config?: DatabaseConfig) {
    // Use default config if none provided
    this.config = config || {
      url: path.join(process.cwd(), 'data', 'thalia.db'),
      logging: true
    }
    const { db, sqlite } = this.createConnection()
    this.db = db
    this.sqlite = sqlite
  }

  private createConnection(): { db: BetterSQLite3Database; sqlite: InstanceType<typeof Database> } {
    try {
      // Ensure the data directory exists
      const dataDir = path.dirname(this.config.url)
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true })
      }

      const sqlite = new Database(this.config.url)
      
      // Enable foreign keys
      sqlite.pragma('foreign_keys = ON')
      
      // Enable WAL mode for better concurrency
      sqlite.pragma('journal_mode = WAL')
      
      return {
        db: drizzle(sqlite),
        sqlite
      }
    } catch (error) {
      console.error('Error creating database connection:', error)
      throw error
    }
  }

  public static getInstance(config?: DatabaseConfig): ThaliaDatabase {
    if (!ThaliaDatabase.instance) {
      ThaliaDatabase.instance = new ThaliaDatabase(config)
    }
    return ThaliaDatabase.instance
  }

  public async connect(): Promise<void> {
    try {
      // SQLite connections are established immediately when creating the database
      // We can verify the connection by running a simple query
      await this.db.run(sql`SELECT 1`)
      console.log('Database connection established successfully')
    } catch (error) {
      console.error('Unable to connect to the database:', error)
      throw error
    }
  }

  public async close(): Promise<void> {
    try {
      // Close the SQLite connection
      this.sqlite.close()
      console.log('Database connection closed')
    } catch (error) {
      console.error('Error closing database connection:', error)
      throw error
    }
  }

  public getDb(): BetterSQLite3Database {
    return this.db
  }

  public async getWebsiteDatabase(name: string, config: DatabaseConfig): Promise<BetterSQLite3Database> {
    // For now, we'll just return the main database
    // In the future, this could create a separate database for each website
    return this.db
  }

  public registerModel(name: string, model: any): void {
    this.models.set(name, model)
  }

  public getModel(name: string): any {
    return this.models.get(name)
  }

  public getAllModels(): Map<string, any> {
    return this.models
  }
}
