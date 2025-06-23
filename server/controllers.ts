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
import { eq, isNull } from 'drizzle-orm'
import { type SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core'
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
    const logs = fs
      .readdirSync(logDirectory)
      .filter((filename) => !filename.startsWith('.'))
      .slice(-10)

    if (logs.length === 0) {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('No logs found')
      return
    }

    // Get stats for all logs
    const stats = await Promise.all(logs.map((log) => fs.promises.stat(path.join(logDirectory, log))))

    // Prepare data for template
    const data = {
      stats: logs.map((log, i) => ({
        filename: log,
        size: stats[i]?.size ?? 0,
        created: stats[i]?.birthtime?.toLocaleString() ?? 'Unknown',
        lastModified: stats[i]?.mtime?.toLocaleString() ?? 'Unknown',
      })),
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

// import { blob } from "./blob.js";
// import { customType } from "./custom.js";
// import { integer } from "./integer.js";
// import { numeric } from "./numeric.js";
// import { real } from "./real.js";
// import { text } from "./text.js";
// export declare function getSQLiteColumnBuilders(): {
//     blob: typeof blob;
//     customType: typeof customType;
//     integer: typeof integer;
//     numeric: typeof numeric;
//     real: typeof real;
//     text: typeof text;
// };
// export type SQLiteColumnBuilders = ReturnType<typeof getSQLiteColumnBuilders>;

// const SQLiteColumnTypes = {
//   blob: 'blob',
//   customType: 'customType',
//   integer: 'integer',
//   numeric: 'numeric',
//   real: 'real',
//   text: 'text',
// }

// Map Drizzle<SQLiteColumnBuilders> to DataTables.net types
// const SQLiteColumnTypes = {
//   blob: 'blob',
//   customType: 'customType',
//   integer: 'integer',
//   numeric: 'numeric',
//   real: 'real',
//   text: 'text',
// }

type CrudRelationship = {
  foreignTable: string
  foreignColumn: string
  localColumn: string
}

type CrudOptions = {
  relationships?: CrudRelationship[]
}

import { type LibSQLDatabase } from 'drizzle-orm/libsql'

export type Machine = {
  init: (website: Website, db: LibSQLDatabase, sqlite: libsql.Client, name: string) => void
  controller: Controller
  table: SQLiteTableWithColumns<any>
}

/**
 * The CrudFactory is a class that generates a CRUD controller for a given table.
 * CrudFactory is a Machine, which means it has an init method, and provides a controller method.
 *
 * The views are mainly in src/views/scaffold, and can be overwritten by the website's views.
 * Custom views can also be passed in to the CrudFactory constructor. (TODO)
 *
 * Currently very tightly coupled with SQLite, but should be extended to work with MariaDB. (TODO)
 *
 * Uses DataTables.net for the list view.
 */
export class CrudFactory implements Machine {
  public name!: string
  public table: SQLiteTableWithColumns<any>
  private website!: Website
  private db!: LibSQLDatabase
  private sqlite!: libsql.Client
  private static blacklist = ['createdAt', 'updatedAt', 'deletedAt'] // Filter 'id' as well?

  constructor(table: SQLiteTableWithColumns<any>, options?: CrudOptions | any) {
    this.table = table
  }

  public init(website: Website, db: LibSQLDatabase, sqlite: libsql.Client, name: string) {
    this.name = name
    this.website = website
    this.db = db
    this.sqlite = sqlite

    db.select()
      .from(this.table)
      .then((records) => {
        console.debug('CrudFactory', this.name, 'initialised, it has', records.length, 'records')

        // console.log("Found", records.length, "records in", this.name)
      })
  }

  /**
   * Generate a CRUD controller for a given table.
   * We want:
   * - default: GET /tableName (shows the list of records by default, but can be overridden)
   * - list: GET /tableName/list (shows the list of records)
   * - new: GET /tableName/new (shows creation form)
   * - create: POST /tableName/create (receives form data, and inserts a new record into the database)
   * - read: GET /tableName/<id> (shows a single record)
   * - edit: GET /tableName/<id>/edit (shows the edit form)
   * - update: PUT /tableName/<id> (receives form data, and updates the record)
   * - delete: DELETE /tableName/<id> (deletes the record)
   * - columns: GET /tableName/columns (returns the columns for DataTables.net)
   * - json: GET /tableName/json (returns the data for DataTables.net)
   * - testdata: GET /tableName/testdata (generates test data, NODE_ENV=development only)
   */
  public controller(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const target = requestInfo.action || 'list'

    switch (target) {
      case 'columns':
        this.columns(res, req, website, requestInfo)
        break
      case 'list':
        this.list(res, req, website, requestInfo)
        break
      case 'json':
        this.json(res, req, website, requestInfo)
        break
      case 'new':
        this.new(res, req, website, requestInfo)
        break
      case 'create':
        this.create(res, req, website, requestInfo)
        break
      case 'testdata':
        this.testdata(res, req, website, requestInfo)
        break
      case 'edit':
        this.edit(res, req, website, requestInfo)
        break
      case 'update':
        this.update(res, req, website, requestInfo)
        break
      case 'delete':
        this.delete(res, req, website, requestInfo)
        break
      case 'restore':
        this.restore(res, req, website, requestInfo)
        break
      default:
        this.show(res, req, website, requestInfo)
    }
  }

  private testdata(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    if (process.env.NODE_ENV !== 'development') {
      return this.reportError(res, new Error('Test data can only be generated in development mode'))
    }

    this.generateTestData(10).then(
      () => {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('Test data generated')
      },
      (error) => {
        this.reportError(res, new Error(`Error generating test data: ${error}`))
      },
    )
  }

  public async generateTestData(amount: number = 10): Promise<any> {
    if (process.env.NODE_ENV !== 'development') {
      throw new Error('Test data can only be generated in development mode')
    }

    const records = []

    for (let i = 0; i < amount; i++) {
      const fields = this.filteredAttributes().reduce(
        (acc, attribute) => {
          var value: any = 'Random String'
          if (attribute.type === 'date') {
            value = new Date().toISOString()
          } else if (attribute.type === 'num') {
            value = Math.random() * 100
          } else if (attribute.type === 'bool') {
            value = Math.random() < 0.5
          }

          acc[attribute.name] = value
          return acc
        },
        {} as Record<string, string>,
      )

      records.push(fields)
    }

    return Promise.all(
      records.map((record) => {
        return this.db.insert(this.table).values(record)
      }),
    )
  }

  /**
   * Takes DELETE requests to the /delete endpoint.
   * Does not actually delete the record, but adds a deletedAt timestamp.
   * Adds a deletedAt timestamp to the record, and redirects to the list page.
   */
  private delete(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const id = requestInfo.slug
    if (!id) {
      return this.reportError(res, new Error('No ID provided'))
    }
    if (!this.table.deletedAt) {
      this.reportError(res, new Error('No deletedAt column found, cannot delete record'))
      return
    }

    this.db
      .update(this.table)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(this.table.id, id))
      .then((result) => {
        this.reportSuccess(res, 'Record deleted', `/${this.name}`)
      })
  }

  private restore(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const id = requestInfo.slug
    if (!id) {
      this.reportError(res, new Error('No ID provided'))
      return
    }

    this.db
      .update(this.table)
      .set({ deletedAt: null })
      .where(eq(this.table.id, id))
      .then((result) => {
        this.reportSuccess(res, 'Record restored', `/${this.name}`)
      })
  }

  /**
   * Update an existing record
   *
   * Needs security checks.
   */
  private update(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const id = requestInfo.slug
    if (!id) {
      return this.reportError(res, new Error('No ID provided'))
    }

    try {
      parseForm(res, req).then(({ fields }) => {
        fields = Object.fromEntries(
          Object.entries(fields).filter(([key]) => !CrudFactory.blacklist.concat(['id']).includes(key)),
        )

        this.db
          .update(this.table)
          .set(fields)
          .where(eq(this.table.id, id))
          .then((result) => {
            this.reportSuccess(res, 'Record updated', `/${this.name}/show/${id}`)
          })
      })
    } catch (error) {
      this.reportError(res, new Error(`Error in ${website.name}/${this.name}/update: ${error}`))
    }
  }

  private edit(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const id = requestInfo.slug
    if (!id) {
      return this.reportError(res, new Error('No ID provided'))
    }
    this.db
      .select(this.table)
      .from(this.table)
      .where(eq(this.table.id, id))
      .then((records) => {
        if (records.length === 0) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Record not found' }))
          return
        } else if (records.length > 1) {
          // throw new Error('Multiple records found for ID')
          console.error('Multiple records found for ID', id)
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Multiple records found for ID' }))
          return
        }

        const record = records[0]
        const isNotDeleted = record.deletedAt === null

        const data = {
          controllerName: this.name,
          id,
          record,
          isNotDeleted,
          json: JSON.stringify(record),
          tableName: this.name,
          primaryKey: 'id',
          links: [],
        }

        const html = website.getContentHtml('edit')(data)
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(html)
      })
  }

  private show(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const id = requestInfo.slug
    if (!id) {
      return this.reportError(res, new Error('No ID provided'))
    }
    // select distinct id, name from table?
    this.db
      .select(this.table)
      .from(this.table)
      .where(eq(this.table.id, id))
      .then((records) => {
        if (records.length === 0) {
          return this.reportError(res, new Error('Record not found'))
        } else if (records.length > 1) {
          return this.reportError(res, new Error('Multiple records found for ID'))
        }

        const record = records[0]

        const data = {
          controllerName: this.name,
          id,
          record,
          json: JSON.stringify(record),
          tableName: this.name,
          primaryKey: 'id',
          links: [],
        }

        const html = website.getContentHtml('show')(data)
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(html)
      })
  }

  /**
   * Takes POST requests with form data from /new, and inserts a new record into the database
   */
  private create(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    try {
      parseForm(res, req).then(({ fields }) => {
        this.db
          .insert(this.table)
          .values(fields)
          .then(
            (result) => {
              this.reportSuccess(res, 'Record created' + JSON.stringify(result), `/${this.name}`)
            },
            (error) => {
              this.reportError(res, new Error(`Error inserting record: ${error}`))
            },
          )
      })
    } catch (error) {
      this.reportError(res, new Error(`Error in ${website.name}/${this.name}/create: ${error}`))
    }
  }

  /**
   * Takes GET requests to the /new endpoint, and renders the new form
   */
  private new(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const removeList = ['id', 'createdAt', 'updatedAt', 'deletedAt', 'locked', 'verified', 'role']
    const fields = this.filteredAttributes().filter((field) => !removeList.includes(field.name))

    const data = {
      title: this.name,
      controllerName: this.name,
      fields,
    }

    const html = website.getContentHtml('new')(data)

    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(html)
  }

  private list(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const data = {
      controllerName: this.name,
      tableName: this.name,
      primaryKey: 'id',
      links: [],
    }
    const html = website.getContentHtml('list')(data)

    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(html)
  }

  /**
   * Serve the data in DataTables.net json format
   * The frontend uses /columns to get the columns, and then asks for /json to get the data.
   */
  private json(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const query = url.parse(requestInfo.url, true).query

    const parsedQuery = CrudFactory.parseDTquery(query)

    // const columns = this.filteredAttributes().map(this.mapColumns)

    const offset = parseInt(parsedQuery.start)
    const limit = parseInt(parsedQuery.length)

    const drizzleQuery = this.db.select().from(this.table)

    if (this.table.deletedAt) {
      drizzleQuery.where(isNull(this.table.deletedAt))
    }

    drizzleQuery
      .limit(limit)
      .offset(offset)
      .then((records) => {
        // console.log("Found", records.length, "records in", this.name)

        const blob = {
          draw: parsedQuery.draw,
          recordsTotal: records.length,
          recordsFiltered: records.length,
          data: records,
          // columns: columns,
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(blob))
      })
  }

  /**
   * Get the list of columns and their attributes, for use with DataTables.net
   *
   * Other attributes:
   * { "keys": ["name", "keyAsName", "primary", "notNull", "default", "defaultFn", "onUpdateFn", "hasDefault", "isUnique", "uniqueName", "uniqueType", "dataType", "columnType", "enumValues", "generated", "generatedIdentity", "config", "table", "length"] }
   */
  private attributes(): Attribute[] {
    const typeMapping: Record<string, string> = {
      createdAt: 'date',
      updatedAt: 'date',
      deletedAt: 'date',
    }

    return this.cols().map((column) => {
      var data: Attribute = {
        name: column,
        type: this.table[column].columnType,
        default: this.table[column].default,
        required: this.table[column].notNull,
        unique: this.table[column].unique,
        primaryKey: this.table[column].primaryKey,
        foreignKey: this.table[column].foreignKey,
        references: this.table[column].references,
      }

      if (typeMapping[column]) {
        data.type = typeMapping[column]
      }

      data.all = JSON.stringify(data)

      return data
    })
  }
  private filteredAttributes() {
    return this.attributes().filter((attribute) => !CrudFactory.blacklist.includes(attribute.name))
  }

  private cols() {
    return Object.keys(this.table)
  }

  private colsFiltered() {
    return this.cols().filter((key) => !CrudFactory.blacklist.includes(key))
  }

  /**
   * For the /columns endpoint
   * Used with DataTables.net
   */
  private columns(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const columns = this.filteredAttributes().map(this.mapColumns)
    // TODO: Get the types/attributes?

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(columns))
  }

  // TODO: Get the types from the drizzle table?
  private mapColumns(attribute: Attribute) {
    // const type = SequelizeDataTableTypes[value.type.key]
    const type = attribute.type

    const allowedTypes = ['string', 'num', 'date', 'bool']
    const orderable = allowedTypes.includes(type)
    const searchable = allowedTypes.includes(type)

    var blob = {
      name: attribute.name,
      title: attribute.name,
      data: attribute.name,
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
      },
    }

    Object.entries(queryString)
      .filter(([key, value]) => {
        return key.startsWith('order')
      })
      .forEach(([key, value]) => {
        const regex = /order\[(\d+)\]\[(.*)\]/
        const match = key.match(regex)
        if (match) {
          const index = match[1]
          const column = match[2]

          // Get the order for this index, or create it if it doesn't exist
          const order = result.order[index] || ({} as Record<string, string>)
          // Set the value for the column
          order[column] = value as string
          // Set the order for this index
          result.order[index] = order
        }
      })

    return result as any
  }

  private reportSuccess(res: ServerResponse, message: string, redirect: string) {
    const html = this.website.getContentHtml('message')({
      state: 'Success',
      message,
      redirect,
    })
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(html)
  }

  /**
   * Pass an error back to the user.
   * Handy place to add logging for the webmaster.
   * Or add extra debugging information for the developer.
   */
  private reportError(res: ServerResponse, error: Error) {
    // TODO: Add a way to log errors for the webmaster

    console.error(error)

    const html = this.website.getContentHtml('message')({
      state: 'Error',
      message: error instanceof Error ? error.message : 'Unknown error',
      redirect: `/${this.name}`,
    })
    res.writeHead(500, { 'Content-Type': 'text/html' })
    res.end(html)
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

type Attribute = {
  name: string
  type: string
  default: any
  required: boolean
  unique: boolean
  primaryKey: boolean
  foreignKey: boolean
  references: string
  all?: string
}

import formidable from 'formidable'
type ParsedForm = {
  fields: Record<string, string>
  files: formidable.Files<string>
}

function parseForm(res: ServerResponse, req: IncomingMessage): Promise<ParsedForm> {
  return new Promise((resolve, reject) => {
    const methods = ['POST', 'PUT', 'PATCH', 'DELETE']
    if (!methods.includes(req.method ?? '')) {
      res.writeHead(405, { 'Content-Type': 'text/html' })
      res.end('Method not allowed')
      reject(new Error('Method not allowed'))
      return
    }

    const form = formidable({ multiples: false })
    form.parse(req, (err, fields, files) => {
      if (err) {
        console.error('Error', err)
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end('Invalid form data')
        reject(err)
        return
      }

      resolve({ fields: parseFields(fields), files })
    })
  })

  // I don't know why Formidable needs us to parse the fields like this
  function parseFields(fields: formidable.Fields<string>): Record<string, string> {
    return Object.entries(fields).reduce(
      (obj, [key, value]) => {
        if (Array.isArray(value)) {
          obj[key] = value[0] ?? ''
        } else {
          obj[key] = value ?? ''
        }
        return obj
      },
      {} as Record<string, string>,
    )
  }
}
