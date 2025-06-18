/**
 * This file is the entrypoint for websites to enable a database connection.
 * 
 * The Thalia framework uses drizzle-orm for database connections.
 * The Thalia framework provides table schemas in Thalia/models.
 * These schemas define the structure of tables that websites can use.
 * Websites can import these schemas to create their own tables in their database.
 * 
 * Each website can have its own SQLite database in its models directory.
 * Websites can provide extra schemas in their models directory.
 * The database file will be created at websites/example/models/sqlite.db by default.
 * 
 * The database connection is then provided to the website's controllers.
 * In Thalia/server/controllers.ts, we will provide a CRUD factory,
 * which will provide easy to use functions for CRUD operations.
 */

import { drizzle } from 'drizzle-orm/libsql';
import { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm'
import path from 'path'
import { type LibSQLDatabase } from 'drizzle-orm/libsql';
import { Website } from './website.js'
import * as libsql from '@libsql/client'
import { Machine } from './controllers.js'

export class ThaliaDatabase {
  private website: Website
  private url: string
  private sqlite: libsql.Client
  public drizzle: LibSQLDatabase
  public schemas: { [key: string]: SQLiteTableWithColumns<any> } = {}
  public machines: { [key: string]: Machine } = {}

  constructor(website: Website) {
    console.log("Creating database connection for", website.rootPath)

    this.website = website

    // Create database connection
    this.url = "file:" + path.join(website.rootPath, 'models', 'sqlite.db')
    this.sqlite = libsql.createClient({ url: this.url })
    this.drizzle = drizzle(this.sqlite)

    this.schemas = website.config.database?.schemas || {}
    this.machines = website.config.database?.machines || {}
  }

  /**
   * Connect to the database
   * Check all schemas exist and are correct
   */
  public async connect(): Promise<ThaliaDatabase> {
    try {
      await this.drizzle.run(sql`SELECT 1`)
      console.log(`Database connection for ${this.website.name} established successfully`)

      return Promise.all(Object.entries(this.schemas).map(async ([name, schema]) => {
        return this.drizzle.select({ [name]: sql<number>`count(*)` }).from(schema)
      })).catch((error) => {
        console.error(`Error getting data from the ${this.website.name} database:`, error)
        throw error
      }).then((results) => {

        const counts: Counts = results.reduce((acc, result) => {
          const [name, count] = Object.entries(result[0])[0] as [string, number]
          acc[name] = count
          return acc
        }, {} as Counts)

        console.log(`Counts from the ${this.website.name} Database:`, counts)
        return this
      }).then(() => {
        // Check that the machines have the same columns as their schemas
        Object.entries(this.machines).forEach(([name, machine]) => {
          machine.init(this.website, this.drizzle, this.sqlite, name)
          console.log("Looking at machine", name)
          // console.log(Object.keys(machine.table))
        })

        // TODO: Check that the models have the same columns as their schemas

        // Object.entries(this.schemas).forEach(([name, schema]) => {
        //   console.log("Looking at schema", name)
        //   console.log(Object.keys(schema))          
        // })

        return this
      })
    } catch (error) {
      console.error(`Unable to connect to the ${this.website.name} database:`, error)
      throw error
    }
  }

  public async close(): Promise<void> {
    try {
      // Close the SQLite connection
      this.sqlite.close()
      console.log(`Database connection for ${this.website.name} closed`)
    } catch (error) {
      console.error(`Error closing database connection for ${this.website.name}:`, error)
      throw error
    }
  }
}

type Counts = {
  [key: string]: number
}
