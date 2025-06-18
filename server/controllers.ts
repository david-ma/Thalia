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

import { type LibSQLDatabase } from 'drizzle-orm/libsql'

export type Machine = {
  init: (website: Website, db: LibSQLDatabase, sqlite: libsql.Client, name: string) => void
  controller: Controller
}

export class CrudFactory implements Machine {
  public name!: string
  private table: SQLiteTableWithColumns<any>
  private website!: Website
  private db!: LibSQLDatabase
  private sqlite!: libsql.Client
  private static blacklist = ['id', 'createdAt', 'updatedAt', 'deletedAt']

  constructor(table: SQLiteTableWithColumns<any>) {
    this.table = table
  }

  public init(website: Website, db: LibSQLDatabase, sqlite: libsql.Client, name: string) {
    this.name = name
    console.log(`We are initialising the CrudFactory ${this.name} on ${website.name}`)

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
  public controller(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const pathname = url.parse(requestInfo.url, true).pathname ?? ''
    const target = pathname.split('/')[2] || 'list'

    if (target === 'columns') {
      this.columns(res, req, website, requestInfo)
    } else if (target === 'list') {
      this.list(res, req, website, requestInfo)
    } else if (target === 'json') {
      this.fetchDataTableJson(res, req, website, requestInfo)
    } else if (target === 'new') {
      this.new(res, req, website, requestInfo)
    } else if (target === 'create') {
      this.create(res, req, website, requestInfo)
    } else if (target === 'testdata') {
      this.testdata(res, req, website, requestInfo)
    } else if (target === 'edit') {
      this.edit(res, req, website, requestInfo)
    } else if (target === 'update') {
      this.update(res, req, website, requestInfo)
    } else if (target === 'delete') {
      this.delete(res, req, website, requestInfo)
    }






    else {
      this.show(res, req, website, requestInfo)
    }

  }

  private testdata(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const data = [
      {
        name: 'apple',
        color: 'red',
        taste: 'sweet'
      },
      {
        name: 'banana',
        color: 'yellow',
        taste: 'sweet'
      },
      {
        name: 'orange',
        color: 'orange',
        taste: 'sour'
      },
      {
        name: 'pear',
        color: 'green',
        taste: 'sweet'
      },
      {
        name: 'pineapple',
        color: 'yellow',
        taste: 'sweet'
      }
    ]

    data.forEach((item) => {
      this.db.insert(this.table).values(item).then((result) => {
        console.log("Result:", result)
      })
    })

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
  }

  private delete(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const id = requestInfo.url.split('/').pop()
    if (!id) {
      throw new Error('No ID provided')
    }

    this.db.update(this.table)
      // .set({ deletedAt: sql`CURRENT_TIMESTAMP` })
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(this.table.id, id))
      // this.db.delete(this.table).where(eq(this.table.id, id))
      .then((result) => {
        // console.log("Result:", result)
        // res.writeHead(200, { 'Content-Type': 'application/json' })
        // res.end(JSON.stringify(result))
        // show delete success, or just the list page
        // res.writeHead(200, { 'Content-Type': 'text/html' })
        // res.end('Record deleted')

        const html = this.website.show('deleteSuccess')(result)
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(html)
      })
  }

  private update(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const id = requestInfo.url.split('/').pop()
    if (!id) {
      throw new Error('No ID provided')
    }

    try {
      parseForm(res, req).then(({ fields }) => {
        fields = Object.fromEntries(Object.entries(fields).filter(([key]) => !CrudFactory.blacklist.includes(key)))

        this.db.update(this.table).set(fields).where(eq(this.table.id, id)).then((result) => {
          console.log("Result:", result)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(result))
        })
      })
    } catch (error) {
      console.error('Error in ${website.name}/${tableName}/update:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }))
    }

  }


  private edit(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const id = requestInfo.url.split('/').pop()
    if (!id) {
      throw new Error('No ID provided')
    }
    this.db.select(this.table).from(this.table)
      .where(eq(this.table.id, id))
      .then((record) => {
        if (!record.length) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Record not found' }))
          return
        }

        const data = {
          controllerName: this.name,
          id: id,
          record: record[0],
          json: JSON.stringify(record),
          tableName: this.name,
          primaryKey: 'id',
          links: []
        }

        const html = website.show('edit')(data)
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(html)
      })

  }
  private show(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const id = requestInfo.url.split('/').pop()
    if (!id) {
      throw new Error('No ID provided')
    }
    this.db.select(this.table).from(this.table)
      .where(eq(this.table.id, id))
      .then((record) => {
        if (!record.length) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Record not found' }))
          return
        }

        const data = {
          controllerName: this.name,
          id: id,
          record: record[0],
          json: JSON.stringify(record),
          tableName: this.name,
          primaryKey: 'id',
          links: []
        }

        const html = website.show('show')(data)
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(html)
      })

  }

  private create(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    try {
      parseForm(res, req).then(({ fields }) => {
        this.db.insert(this.table).values(fields).then((result) => {
          // console.log("Result:", result)
          // res.writeHead(200, { 'Content-Type': 'application/json' })
          // res.end(JSON.stringify(result))

          const html = website.show('list')(result)
          res.writeHead(302, { 'Location': `/${this.name}` })
          res.end()



        }, (error) => {
          console.error('Error inserting record:', error)
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }))
        })
      })
    } catch (error) {
      console.error('Error in ${website.name}/${tableName}/create:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }))
    }
  }

  private new(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {

    const data = {
      title: this.name,
      controllerName: this.name,
      fields: this.filteredAttributes()
    }


    const html = website.show('create')(data)

    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(html)
  }

  public list(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    website.db.drizzle.select({ id: this.table.id, name: this.table.name }).from(this.table).then((records) => {
      const data = {
        // primaryKey: 'id',
        controllerName: this.name,
        records,
        tableName: this.name,
        primaryKey: 'id',
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

    const parsedQuery = CrudFactory.parseDTquery(query)

    // const columns = this.filteredAttributes().map(this.mapColumns)

    const offset = parseInt(parsedQuery.start)
    const limit = parseInt(parsedQuery.length)

    this.db.select().from(this.table).limit(limit).offset(offset).then((records) => {
      console.log("Found", records.length, "records in", this.name)

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
  private attributes() : Attribute[] {
    const typeMapping: Record<string, string> = {
      'createdAt': 'date',
      'updatedAt': 'date',
      'deletedAt': 'date',
    }

    return this.cols().map((column) => {
      var data :Attribute = {
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

    console.log("Type:", attribute.type)



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
    return Object.entries(fields).reduce((obj, [key, value]) => {
      if (Array.isArray(value)) {
        obj[key] = value[0] ?? ''
      } else {
        obj[key] = value ?? ''
      }
      return obj
    }, {} as Record<string, string>)
  }
}





