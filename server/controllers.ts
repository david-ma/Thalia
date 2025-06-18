/**
 * Controllers - Useful shared controller functions for handling requests
 * 
 * The controllers are useful functions you can call to do specific tasks on a http request. e.g.
 * 1. Handling requests
 * 2. Rendering templates
 * 3. Handling form submissions
 * 4. Handling file uploads
 */

import { IncomingMessage, ServerResponse } from 'http'
import { Website } from './website.js'
import fs from 'fs'
import path from 'path'
import { type Controller } from './website.js'
import { eq } from 'drizzle-orm'
import { type SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core'
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { RequestInfo } from './server.js'
import * as libsql from '@libsql/client'
import url from 'url'
import { ParsedUrlQuery } from 'querystring'

/**
 * Read the latest 10 logs from the log directory
 */
export const latestlogs = async (res: ServerResponse, _req: IncomingMessage, website: Website) => {
  try {
    const logDirectory = path.join(website.rootPath, 'public', 'log')
    if (!fs.existsSync(logDirectory)) {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('No logs found')
      return
    }

    // Get list of log files
    const logs = fs.readdirSync(logDirectory)
      .filter(filename => !filename.startsWith('.'))
      .slice(-10)

    if (logs.length === 0) {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('No logs found')
      return
    }

    // Get stats for all logs
    const stats = await Promise.all(
      logs.map(log => fs.promises.stat(path.join(logDirectory, log)))
    )

    // Prepare data for template
    const data = {
      stats: logs.map((log, i) => ({
        filename: log,
        size: stats[i]?.size ?? 0,
        created: stats[i]?.birthtime?.toLocaleString() ?? 'Unknown',
        lastModified: stats[i]?.mtime?.toLocaleString() ?? 'Unknown'
      }))
    }

    // Get and compile template
    const template = website.handlebars.partials['logs']
    if (!template) {
      throw new Error('logs template not found')
    }

    const html = website.handlebars.compile(template)(data)
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(html)

  } catch (error) {
    console.error(`Error in ${website.name}/latestlogs: ${error instanceof Error ? error.message : 'Unknown error'}`)
    res.writeHead(500, { 'Content-Type': 'text/html' })
    res.end(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

type CrudRelationship = {
  foreignTable: string
  foreignColumn: string
  localColumn: string
}

type CrudOptions = {
  website: Website
  table: SQLiteTableWithColumns<any>
  db: BetterSQLite3Database
  relationships?: CrudRelationship[]
  hideColumns?: string[]
  template?: string
}

type CrudController = {
  [key: string]: (res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) => void
}

/**
 * Generate a CRUD controller for a given table.
 * We want:
 * - list: GET /tableName
 * - create: POST /tableName
 * - read: GET /tableName/id
 * - edit: GET /tableName/id/edit
 * - update: PUT /tableName/id
 * - delete: DELETE /tableName/id
 */
export function crudFactory(options: CrudOptions): CrudController {
  const { website, table, db, relationships = [], hideColumns = [], template = 'crud' } = options
  const tableName = table.name

  return {
    // List all records
    list: async (res: ServerResponse, _req: IncomingMessage, website: Website, _requestInfo: RequestInfo) => {
      try {
        const records = await db.select().from(table)
        const data = { records, tableName }
        const html = website.handlebars.compile(template)(data)
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(html)
      } catch (error) {
        console.error(`Error in ${website.name}/${tableName}/list:`, error)
        res.writeHead(500, { 'Content-Type': 'text/html' })
        res.end(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    },

    // Create a new record
    create: async (res: ServerResponse, req: IncomingMessage, website: Website, _requestInfo: RequestInfo) => {
      try {
        const body = await parseBody(req)
        const result = await db.insert(table).values(body).returning()
        res.writeHead(201, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result[0]))
      } catch (error) {
        console.error(`Error in ${website.name}/${tableName}/create:`, error)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }))
      }
    },

    // Read a single record
    read: async (res: ServerResponse, _req: IncomingMessage, website: Website, requestInfo: RequestInfo) => {
      try {
        const id = requestInfo.url.split('/').pop()
        if (!id) {
          throw new Error('No ID provided')
        }

        const record = await db.select().from(table).where(eq(table.id, id))
        if (!record.length) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Record not found' }))
          return
        }

        const data = { record: record[0], tableName }
        const html = website.handlebars.compile(template)(data)
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(html)
      } catch (error) {
        console.error(`Error in ${website.name}/${tableName}/read:`, error)
        res.writeHead(500, { 'Content-Type': 'text/html' })
        res.end(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    },

    // Edit form for a record
    edit: async (res: ServerResponse, _req: IncomingMessage, website: Website, requestInfo: RequestInfo) => {
      try {
        const id = requestInfo.url.split('/').pop()
        if (!id) {
          throw new Error('No ID provided')
        }

        const record = await db.select().from(table).where(eq(table.id, id))
        if (!record.length) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Record not found' }))
          return
        }

        const data = { record: record[0], tableName }
        const html = website.handlebars.compile(`${template}-edit`)(data)
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(html)
      } catch (error) {
        console.error(`Error in ${website.name}/${tableName}/edit:`, error)
        res.writeHead(500, { 'Content-Type': 'text/html' })
        res.end(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    },

    // Update a record
    update: async (res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) => {
      try {
        const id = requestInfo.url.split('/').pop()
        if (!id) {
          throw new Error('No ID provided')
        }

        const body = await parseBody(req)
        const result = await db.update(table)
          .set(body)
          .where(eq(table.id, id))
          .returning()

        if (!result.length) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Record not found' }))
          return
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result[0]))
      } catch (error) {
        console.error(`Error in ${website.name}/${tableName}/update:`, error)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }))
      }
    },

    // Delete a record
    delete: async (res: ServerResponse, _req: IncomingMessage, website: Website, requestInfo: RequestInfo) => {
      try {
        const id = requestInfo.url.split('/').pop()
        if (!id) {
          throw new Error('No ID provided')
        }

        const result = await db.delete(table)
          .where(eq(table.id, id))
          .returning()

        if (!result.length) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Record not found' }))
          return
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
      } catch (error) {
        console.error(`Error in ${website.name}/${tableName}/delete:`, error)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }))
      }
    }
  }
}

// Helper function to parse request body
async function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk.toString()
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(body))
      } catch (error) {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}


import { type LibSQLDatabase } from 'drizzle-orm/libsql'

export class CrudMachine {
  public name!: string
  private table: SQLiteTableWithColumns<any>
  private website!: Website
  private db!: LibSQLDatabase
  private sqlite!: libsql.Client
  constructor(table: SQLiteTableWithColumns<any>) {
    this.table = table
  }

  public init(website: Website, db: LibSQLDatabase, sqlite: libsql.Client, name: string) {
    this.name = name
    console.log(`We are initialising the CrudMachine ${this.name} on ${website.name}`)

    this.website = website
    this.db = db
    this.sqlite = sqlite

    db.select().from(this.table).then((records) => {
      console.log("Found", records.length, "records in", this.name)
    })
  }

  /**
   * Generate a CRUD controller for a given table.
   * We want:
   * - list: GET /tableName
   * - create: POST /tableName
   * - read: GET /tableName/id
   * - edit: GET /tableName/id/edit
   * - update: PUT /tableName/id
   * - delete: DELETE /tableName/id
   */
  public entrypoint(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const pathname = url.parse(requestInfo.url, true).pathname ?? ''
    const target = pathname.split('/')[2]

    if (target === 'columns') {
      this.columns(res, req, website, requestInfo)
    } else if (target === 'list') {
      this.list(res, req, website, requestInfo)
    } else if (target === 'json') {
      this.fetchDataTableJson(res, req, website, requestInfo)
    }

    else {
      this.list(res, req, website, requestInfo)
    }

  }


  public list(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    website.db.drizzle.select({ id: this.table.id, name: this.table.name }).from(this.table).then((records) => {
      const data = {
        controllerName: this.name,
        records,
        tableName: this.name,
        primaryKey: this.table.id,
        links: []
      }
      const html = website.show('list')(data)

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(html)
    })
  }
  /**
   * Serve the data in DataTables.net json format
   */
  private fetchDataTableJson(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const query = url.parse(requestInfo.url, true).query

    const parsedQuery = CrudMachine.parseDTquery(query)

    const columns = Object.keys(this.table).map(this.mapColumns)

    const offset = parseInt(parsedQuery.start)
    const limit = parseInt(parsedQuery.length)

    this.db.select().from(this.table).limit(limit).offset(offset).then((records) => {
      console.log("Found", records.length, "records in", this.name)

      const blob = {
        draw: parsedQuery.draw,
        recordsTotal: records.length,
        recordsFiltered: records.length,
        data: records,
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(blob))
    })

  }







  private columns(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const columns = Object.keys(this.table).map(this.mapColumns)
    // TODO: Get the types

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(columns))
  }


  // TODO: Get the types from the drizzle table?
  private mapColumns(key: string) {
    // const type = SequelizeDataTableTypes[value.type.key]
    const type = 'string'
    const allowedTypes = ['string', 'num', 'date', 'bool']
    const orderable = allowedTypes.includes(type)
    const searchable = allowedTypes.includes(type)

    var blob = {
      name: key,
      title: key,
      data: key,
      orderable,
      searchable,
      type,
    }

    return blob
  }

  private static parseDTquery(queryString: ParsedUrlQuery): ParsedDTquery {
    const result = {
      draw: queryString.draw,
      start: queryString.start,
      length: queryString.length,
      order: {} as Record<string, Record<string, string>>,
      search: {
        value: queryString['search[value]'],
        regex: queryString['search[regex]'],
      }
    }

    Object.entries(queryString).filter(([key, value]) => {
      return key.startsWith('order')
    }).forEach(([key, value]) => {
      const regex = /order\[(\d+)\]\[(.*)\]/
      const match = key.match(regex)
      if (match) {
        const index = match[1]
        const column = match[2]

        // Get the order for this index, or create it if it doesn't exist
        const order = result.order[index] || {} as Record<string, string>
        // Set the value for the column
        order[column] = value as string
        // Set the order for this index
        result.order[index] = order
      }
    })

    return result as any
  }
}

type Search = {
  value: string
  regex: boolean
}

type ParsedDTquery = {
  draw: string
  start: string
  length: string
  order: Record<string, Record<string, string>>
  search: Search
}






