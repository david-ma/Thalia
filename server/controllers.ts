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
import { RequestInfo } from './server.js'
import url from 'url'
import { ParsedUrlQuery } from 'querystring'
import crypto from 'crypto'
import https from 'https'

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

type CrudRelationship = {
  foreignTable: string
  foreignColumn: string
  localColumn: string
}

type CrudOptions = {
  relationships?: CrudRelationship[]
}

// import { type LibSQLDatabase } from 'drizzle-orm/libsql'
import { Permission } from './route-guard.js'
import { MySqlDatabase, MySqlTableWithColumns } from 'drizzle-orm/mysql-core'

/**
 * A Machine is a singleton that needs to be initialised by Thalia.
 * They provide controllers.
 * CrudFactories are Machines.
 * MailService is a Machine.
 *
 */
export type Machine = {
  init: (website: Website, name: string) => void
  controller: Controller
  table: MySqlTableWithColumns<any>
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
  public table: MySqlTableWithColumns<any>
  private website!: Website
  private db!: MySqlTableWithColumns<any>
  // private db!: LibSQLDatabase<Record<string, never>>
  // private sqlite!: libsql.Client
  private static blacklist = ['createdAt', 'updatedAt', 'deletedAt'] // Filter 'id' as well?

  constructor(table: MySqlTableWithColumns<any>, options?: CrudOptions | any) {
    this.table = table
  }

  public init(website: Website, name: string) {
    this.name = name
    this.website = website
    this.db = website.db.drizzle
    // this.sqlite = sqlite

    this.db
      .select()
      .from(this.table)
      .then((records: any[]) => {
        console.debug('CrudFactory', this.name, 'initialised, it has', records.length, 'records')

        // console.log("Found", records.length, "records in", this.name)
      })
  }

  public static getAction(requestInfo: RequestInfo): Permission {
    const target = requestInfo.action || 'list'

    switch (target) {
      case 'columns':
        return 'read'
      case 'list':
        return 'read'
      case 'json':
        return 'read'
      case 'new':
        return 'create'
      case 'create':
        return 'create'
      case 'testdata':
        return 'create'
      case 'edit':
        return 'update'
      case 'update':
        return 'update'
      case 'delete':
        return 'delete'
      case 'restore':
        return 'update'
      default:
        return 'read'
    }
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

    const records: any[] = []

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
      .then((result: any) => {
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
      .then((result: any) => {
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
          .then((result: any) => {
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
      .then((records: any[]) => {
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
      .then((records: any[]) => {
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
            (result: any) => {
              this.reportSuccess(res, 'Record created' + JSON.stringify(result), `/${this.name}`)
            },
            (error: any) => {
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
      .then((records: any[]) => {
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
import { RawWebsiteConfig } from './types.js'
type ParsedForm = {
  fields: Record<string, string>
  files: formidable.Files<string>
}

export function parseForm(res: ServerResponse, req: IncomingMessage): Promise<ParsedForm> {
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

export class SmugMugUploader implements Machine {
  private website!: Website
  public name!: string
  public table!: MySqlTableWithColumns<any>
  private album!: string
  private tokens!: {
    consumer_key: string
    consumer_secret: string
    oauth_token: string
    oauth_token_secret: string
  }
  private BASE_URL = 'https://api.smugmug.com'
  private REQUEST_TOKEN_URL = `${this.BASE_URL}/services/oauth/1.0a/getRequestToken`
  private ACCESS_TOKEN_URL = `${this.BASE_URL}/services/oauth/1.0a/getAccessToken`
  private AUTHORIZE_URL = `${this.BASE_URL}/services/oauth/1.0a/authorize`

  // This should be a reachable domain?
  // Try using ngrok?
  private callbackUrl = 'http://localhost:3000/oauthCallback'

  constructor() {}

  public async init(website: Website, name: string) {
    this.website = website
    this.name = name

    import(path.join(this.website.rootPath, 'config', 'secrets.js'))
      .then(({ smugmug }) => {
        this.tokens = smugmug
        this.album = smugmug.album

        return smugmug
      })
      .then((smugmug) => {
        if (!smugmug.consumer_key || !smugmug.consumer_secret) {
          throw new Error('Consumer key and secret are required')
        }

        if (smugmug.oauth_token && smugmug.oauth_token_secret) {
          console.log('OAuth token and secret are already set')
          return smugmug
        }

        console.log('Getting a request token')

        // Get the request token
        const requestParams: any = {
          oauth_callback: 'oob',
          oauth_consumer_key: this.tokens.consumer_key,
          oauth_nonce: Math.random().toString().replace('0.', ''),
          oauth_signature_method: 'HMAC-SHA1',
          oauth_timestamp: Math.floor(Date.now() / 1000),
          oauth_version: '1.0',
        }

        const sortedParams = SmugMugUploader.sortParams(requestParams)
        const escapedParams = SmugMugUploader.oauthEscape(SmugMugUploader.expandParams(sortedParams))
        const signatureBaseString = `GET&${SmugMugUploader.oauthEscape(this.REQUEST_TOKEN_URL)}&${escapedParams}`

        requestParams.oauth_signature = SmugMugUploader.b64_hmac_sha1(
          `${this.tokens.consumer_secret}&`,
          signatureBaseString,
        )

        const requestOptions = {
          hostname: 'api.smugmug.com',
          port: 443,
          path: '/services/oauth/1.0a/getRequestToken?' + new URLSearchParams(requestParams).toString(),
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        }

        const req = https.request(requestOptions, (res: any) => {
          // console.log('Request Token Response Status:', res.statusCode)

          let data = ''
          res.on('data', (chunk: any) => {
            data += chunk
          })

          res.on('end', () => {
            const response = data.split('&').reduce(
              (acc, item) => {
                const [key, value] = item.split('=')
                acc[key] = value
                return acc
              },
              {} as Record<string, string>,
            )

            if (response && response.oauth_callback_confirmed == 'true') {
              this.tokens.oauth_token = response.oauth_token
              this.tokens.oauth_token_secret = response.oauth_token_secret

              // console.log("Request token is", this.tokens.oauth_token)
              // console.log("Request token secret is", this.tokens.oauth_token_secret)

              // Now we can get the authorization URL
              const authorizationUrl =
                this.AUTHORIZE_URL +
                '?' +
                new URLSearchParams({
                  oauth_token: this.tokens.oauth_token,
                  oauth_callback: this.callbackUrl,
                }).toString()

              console.log('Authorization URL is', authorizationUrl)
            } else {
              console.error('Request token failed')
            }
          })
        })

        req.on('error', (e: any) => {
          console.error('Request Token Error:', e)
        })

        req.end()
      })

      .catch((error) => {
        console.error('Error loading secrets:', error)
      })
  }

  // https://oauth1.wp-api.org/docs/basics/Auth-Flow.html
  public oauthCallback(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const query = requestInfo.query
    const tokenExchangeParams: any = {
      oauth_consumer_key: this.tokens.consumer_key,
      oauth_token: query.oauth_token,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Date.now(),
      oauth_nonce: Math.random().toString().replace('0.', ''),
      oauth_verifier: query.oauth_verifier,
    }

    const sorted = SmugMugUploader.sortParams(tokenExchangeParams)

    const normalized = encodeURIComponent(
      Object.entries(sorted)
        .map(([key, value]) => `${key}=${value}`)
        .join('&'),
    )
    const method = 'POST'

    tokenExchangeParams.oauth_signature = SmugMugUploader.b64_hmac_sha1(
      `${this.tokens.consumer_secret}&${this.tokens.oauth_token_secret}`,
      `${method}&${encodeURIComponent(this.ACCESS_TOKEN_URL)}&${normalized}`,
    )

    const url = this.ACCESS_TOKEN_URL + '?' + new URLSearchParams(tokenExchangeParams).toString()
    console.log('Token exchange url is', url)

    const options = {
      host: 'api.smugmug.com',
      port: 443,
      path: '/services/oauth/1.0a/getAccessToken?' + new URLSearchParams(tokenExchangeParams).toString(),
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
    }

    const httpsRequest = https.request(options, (httpsResponse: any) => {
      console.log('Token Exchange Response Status:', httpsResponse.statusCode)

      let data = ''
      httpsResponse.on('data', (chunk: any) => {
        data += chunk
      })

      httpsResponse.on('error', (e: any) => {
        console.error('Token Exchange Error:', e)
      })

      httpsResponse.on('end', () => {
        console.log('Token Exchange Response:', data)

        const response = data.split('&').reduce(
          (acc, item) => {
            const [key, value] = item.split('=')
            acc[key] = value
            return acc
          },
          {} as Record<string, string>,
        )

        console.log('Response is', response)

        this.tokens.oauth_token = response.oauth_token
        this.tokens.oauth_token_secret = response.oauth_token_secret

        res.end(JSON.stringify(response))
      })
    })

    httpsRequest.on('error', (e: any) => {
      console.error('Token Exchange Error:', e)
    })

    httpsRequest.end()
  }

  public controller(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const method = req.method ?? ''
    const that = this
    console.log("Hey we're running a controller called 'uploadPhoto'")

    if (method != 'POST') {
      res.end('This should be a post')
      return
    }

    parseForm(res, req)
      .then(({ fields, files }) => {
        const file = files.fileToUpload?.[0]

        if (!file) {
          res.end('File not uploaded')
          return
        }

        const caption = fields.caption ?? ''
        const filename = fields.filename ?? file.originalFilename ?? ''
        const title = fields.title ?? filename ?? caption ?? ''
        const keywords = fields.keywords ?? title ?? caption ?? filename ?? this.website.name ?? ''

        const host = 'upload.smugmug.com'
        const path = '/'
        const targetUrl = `https://${host}${path}`
        const method = 'POST'

        // Sign the request (same OAuth process)
        const params = this.signRequest(method, targetUrl)

        // https://forum.uipath.com/t/unable-to-pass-binary-image-data-inside-http-request-body/849190/8
        // Create the multipart form data
        const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substr(2, 8)
        const formData = SmugMugUploader.createMultipartFormData(file, boundary)

        const options = {
          host: host,
          port: 443,
          path: path,
          method: method,
          headers: {
            Authorization: SmugMugUploader.bundleAuthorization(targetUrl, params),
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': formData.length,
            'X-Smug-AlbumUri': `/api/v2/album/${this.album}`,
            'X-Smug-Caption': caption,
            'X-Smug-FileName': filename,
            'X-Smug-Keywords': keywords,
            'X-Smug-ResponseType': 'JSON',
            'X-Smug-Title': title,
            'X-Smug-Version': 'v2',
          },
        }

        const httpsRequest = https.request(options, function (httpsResponse: IncomingMessage) {
          let data: string = ''

          httpsResponse.setEncoding('utf8')
          httpsResponse.on('data', function (chunk) {
            data += chunk
          })

          httpsResponse.on('end', () => {
            that.saveImage(JSON.parse(data)).then(() => {
              res.end(JSON.stringify(data))
            })
          })
        })

        httpsRequest.on('error', function (e) {
          console.log('problem with request:')
          console.log(e)
        })

        httpsRequest.on('close', () => {
          console.log('httpRequest closed')
        })

        httpsRequest.write(formData)
        httpsRequest.end()
      })
      .catch((err) => {
        console.error('Error uploading photo:', err)
        res.end('error')
      })
  }

  // {"stat":"ok","method":"smugmug.images.upload","Image":{"StatusImageReplaceUri":"","ImageUri":"/api/v2/image/RvQ65Gm-0","AlbumImageUri":"/api/v2/album/jHhcL7/image/RvQ65Gm-0","URL":"https://photos.david-ma.net/Thalia/n-rXXjjD/My-Smug-Album/i-RvQ65Gm"},"Asset":{"AssetComponentUri":"/api/v2/library/asset/RvQ65Gm/component/i/RvQ65Gm","AssetUri":"/api/v2/library/asset/RvQ65Gm"}}

  private async saveImage(data: {
    stat: string
    method: string
    Image: {
      StatusImageReplaceUri: string
      ImageUri: string
      AlbumImageUri: string
      URL: string
    }
    Asset: {
      AssetComponentUri: string
      AssetUri: string
    }
  }) {
    console.log('Ok, we got the data from smugmug')
    console.log(data)
    console.log("Let's save it to the database")

    // AlbumImageUri
    const AlbumImageUri = data.Image.AlbumImageUri

    // fetch(`${this.BASE_URL}${AlbumImageUri}`)
    this.smugmugApiCall(AlbumImageUri)
      // .then(res => res.json())
      .then((data) => {
        console.log('Pulling more data from AlbumImageUri')
        console.log(data)
        // const drizzle = this.website.db.drizzle
        // drizzle.insert(images).values({
        //   imageUri: data.Image.ImageUri,
        //   albumUri: data.Image.AlbumImageUri,
        //   url: data.Image.URL,
        // })
      })
      .catch((err) => {
        console.error(err)
      })
  }

      // path=`${path}?_verbosity=1`
  private async smugmugApiCall(path: string, method: string = 'GET') {
    // path = `${path}?_verbosity=1`


    return new Promise((resolve, reject) => {
      // Send a signed request to the API
      // const targetUrl = `${this.BASE_URL}${path}?_verbosity=1`
      const targetUrl = `${this.BASE_URL}${path}`
      const params = this.signRequest(method, targetUrl)
      const options = {
        host: 'api.smugmug.com',
        port: 443,
        path,
        method,
        headers: {
          Authorization: SmugMugUploader.bundleAuthorization(targetUrl, params),
          Accept: 'application/json',
          'X-Smug-ResponseType': 'JSON',
        },
      }

      // Before making the GET request, add this:
      console.log('=== FAILING REQUEST DEBUG ===')
      console.log('Target URL:', targetUrl)
      console.log('Method:', method)
      console.log('Final OAuth Params:', JSON.stringify(params, null, 2))
      console.log('Authorization Header:', SmugMugUploader.bundleAuthorization(targetUrl, params))
      console.log('Final URL:', options.host + options.path)
      console.log('============================')


      const httpsRequest = https.request(options, (httpsResponse: IncomingMessage) => {
        let data = ''
        httpsResponse.on('data', (chunk: any) => {
          data += chunk
        })

        httpsResponse.on('end', () => {
          resolve(data)
        })
      })

      httpsRequest.on('error', (e: any) => {
        reject(e)
      })

      httpsRequest.end()
    })
  }

  private signRequest(method: string, targetUrl: string) {
    const params: any = {
      oauth_consumer_key: this.tokens.consumer_key,
      oauth_nonce: Math.random().toString().replace('0.', ''),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000),
      oauth_token: this.tokens.oauth_token,
      oauth_version: '1.0',
      _verbosity: '1',
    }

    const sortedParams = SmugMugUploader.sortParams(params)
    const escapedParams = SmugMugUploader.oauthEscape(SmugMugUploader.expandParams(sortedParams))

    console.log('=== OAuth Debug ===')
    console.log('Params (should NOT include oauth_token_secret):', JSON.stringify(params, null, 2))
    console.log('Sorted Params:', JSON.stringify(sortedParams, null, 2))
    console.log('Signature Base String:', `${method}&${SmugMugUploader.oauthEscape(targetUrl)}&${escapedParams}`)
    console.log('==================')

    params.oauth_signature = SmugMugUploader.b64_hmac_sha1(
      `${this.tokens.consumer_secret}&${this.tokens.oauth_token_secret}`,
      `${method}&${SmugMugUploader.oauthEscape(targetUrl)}&${escapedParams}`,
    )

    // It seems like smugmug doesn't like the + in the signature,
    // and I don't know how to escape it properly, so I'm just
    // going to regenerate the signature if it contains a + or /

    return params.oauth_signature.match(/[\+\/]/) ? this.signRequest(method, targetUrl) : params
  }

  private static b64_hmac_sha1(key: string, data: string) {
    return crypto.createHmac('sha1', key).update(data).digest('base64')
  }

  private static expandParams(params: any) {
    return Object.keys(params)
      .map((key) => `${key}=${params[key]}`)
      .join('&')
  }

  private static sortParams(object: object) {
    const keys = Object.keys(object).sort()
    const result = {}
    keys.forEach(function (key) {
      result[key] = object[key]
    })
    return result
  }

  private static oauthEscape(string: string) {
    if (string === undefined) {
      return ''
    }
    if ((string as any) instanceof Array) {
      throw new Error('Array passed to _oauthEscape')
    }
    return encodeURIComponent(string)
      .replace(/\!/g, '%21')
      .replace(/\*/g, '%2A')
      .replace(/'/g, '%27')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
  }

  private static bundleAuthorization(url: string, params: object) {
    const keys = Object.keys(params)

    // const authorization = `OAuth realm="${url}",${keys.map(key => `${key}="${encodeURIComponent(params[key])}"`).join(',')}`

    // const authorization = `OAuth realm="${url}",${keys.map((key) => `${key}="${params[key]}"`).join(',')}`

    const authorization = `OAuth realm="${url}",${keys
      .map((key) => {
        let value = params[key]
        // Double-encode the oauth_signature specifically
        if (key === 'oauth_signature') {
          value = encodeURIComponent(value)
        }
        return `${key}="${value}"`
      })
      .join(',')}`

    return authorization
  }

  private static createMultipartFormData(file: any, boundary: string): Buffer {
    const parts = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="' + file.originalFilename + '"',
      'Content-Type: ' + file.mimetype,
      '',
      fs.readFileSync(file.filepath),
      '', // Add empty line after file data
      `--${boundary}--`,
    ]

    return Buffer.concat(parts.map((part) => (typeof part === 'string' ? Buffer.from(part + '\r\n') : part)))
  }

  public smugmugConfig(): RawWebsiteConfig {
    return {
      database: {
        schemas: {
          albums,
          images,
        },
        machines: {
          albums: AlbumMachine,
          images: ImageMachine,
        },
      },
      controllers: {
        uploadPhoto: this.controller.bind(this),
        oauthCallback: this.oauthCallback.bind(this),
      },
    }
  }
}

import { albums, images } from '../models/smugmug.js'
const AlbumMachine = new CrudFactory(albums)
const ImageMachine = new CrudFactory(images)




import { marked } from 'marked'




export class MarkdownViewerFactory {
  constructor(private folder: string) {}

  public controller(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) : void {
    const folder_path = path.join(website.rootPath, this.folder)
    const files = fs.readdirSync(folder_path)
    const data : any = {
      controller: requestInfo.controller,
      slug: requestInfo.slug,
      filename: requestInfo.slug.replace('.md', ''),
      files: files
    }

    if (files.includes(requestInfo.slug)) {
      const content = fs.readFileSync(path.join(folder_path, requestInfo.slug), 'utf8')
      data.obsidian_html = marked.parse(content)

      const html = website.getContentHtml('md_show', 'wrapper')
      res.end(html(data))

    } else {
      console.log("Request info", requestInfo)

      const html = website.getContentHtml('md_list', 'wrapper')
      res.end(html(data))
    }
  }
}


