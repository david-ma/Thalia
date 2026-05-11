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
import { Website, type Controller } from './website'
import fs from 'fs'
import path from 'path'
import { and, eq, isNull, like, or, sql, type SQL } from 'drizzle-orm'
import { RequestInfo } from './server'
import url from 'url'
import { ParsedUrlQuery } from 'querystring'
import crypto from 'crypto'
import https from 'https'
import { SmugMugClient, type SmugMugTokenSet } from './smugmug/smugmug-client.js'
import {
  smugmugB64HmacSha1,
  smugmugBundleAuthorization,
  smugmugExpandParams,
  smugmugOauthEscape,
  smugmugSortParams,
} from './smugmug/smugmug-oauth.js'

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

/**
 * Redirects GET requests to the lexicographically-latest file in `data/<folder>` matching `.<type>`.
 * Files compressed with `.gz` are matched against their uncompressed name; Thalia's static handler
 * is expected to serve the `.gz` sibling transparently.
 *
 * The default options are json and sorted by name, so you write logs to /data/<foo>/<timestamp>.json and visiting /data/<foo> will redirect to the latest log.
 * Using 'lastModified' will sort by last modified time instead, this is slower because it has to read the file stats for each file. But useful if you don't have control over the file names.
 *
 * Responds 404 if the folder is missing or contains no matching file.
 *
 * If the slug is "list", it will return a list of all files in the folder.
 */
export function latestData(
  folder: string,
  options: {
    type?: string
    sort?: 'name' | 'lastModified' | 'dateCreated'
  } = {},
): Controller {
  const { type = 'json', sort = 'name' } = options
  return (res, _req, website, requestInfo) => {
    const dir = path.join(website.rootPath, 'data', folder)
    fs.promises
      .readdir(dir, { withFileTypes: true })
      .then((entries) => {
        const files = entries.filter((e) => e.isFile()).map((e) => e.name)

        let sortedFiles = files.map((name) => name.replace(/\.gz$/, '')).sort()

        if (sort === 'lastModified' || sort === 'dateCreated') {
          const fileStats = files.map((name) => {
            const stats = fs.statSync(path.join(dir, name))
            return {
              name: name.replace(/\.gz$/, ''),
              stats: stats,
            }
          })
          if (sort === 'dateCreated') {
            sortedFiles = fileStats
              .sort((a, b) => a.stats.birthtime.getTime() - b.stats.birthtime.getTime())
              .map((e) => e.name)
          } else if (sort === 'lastModified') {
            sortedFiles = fileStats.sort((a, b) => a.stats.mtime.getTime() - b.stats.mtime.getTime()).map((e) => e.name)
          }
        }

        const filteredFiles = sortedFiles.filter((name) => name.endsWith(`.${type}`))

        if (requestInfo.slug === 'list') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(filteredFiles))
          return
        }

        const latest = filteredFiles.pop()
        if (!latest) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          console.error(`No .${type} files in data/${folder}`)
          res.end('404')
          return
        }
        res.writeHead(302, { Location: `/${folder}/${latest}` })
        res.end()
      })
      .catch((err: NodeJS.ErrnoException) => {
        const status = err.code === 'ENOENT' ? 404 : 500
        res.writeHead(status, { 'Content-Type': 'text/plain' })
        console.error(`Error in ${website.name}/latestData: ${err.message}`)
        res.end('500')
      })
  }
}

export const version = async (res: ServerResponse, _req: IncomingMessage, website: Website) => {
  try {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(website.version))
  } catch (error) {
    console.error(`Error in ${website.name}/version: ${error instanceof Error ? error.message : 'Unknown error'}`)
    res.writeHead(500, { 'Content-Type': 'text/html' })
    res.end(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Dev placeholder image: GET /placeholder-image → 600×400 SVG; GET /placeholder-image/<w>/<h> → sized SVG.
 * Registered by default in Website (merge); sites can override `controllers['placeholder-image']` if needed.
 */
export const PLACEHOLDER_IMAGE_DEFAULT_WIDTH = 600
export const PLACEHOLDER_IMAGE_DEFAULT_HEIGHT = 400
export const PLACEHOLDER_IMAGE_MAX_DIMENSION = 4000

export function clampPlaceholderDimension(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(PLACEHOLDER_IMAGE_MAX_DIMENSION, Math.floor(n))
}

/** Normalised pathname: /placeholder-image or /placeholder-image/&lt;w&gt;/&lt;h&gt; */
export function parsePlaceholderDimensions(pathname: string): { width: number; height: number } {
  const segs = pathname.split('/').filter(Boolean)
  if (segs[0] !== 'placeholder-image') {
    return { width: PLACEHOLDER_IMAGE_DEFAULT_WIDTH, height: PLACEHOLDER_IMAGE_DEFAULT_HEIGHT }
  }
  if (segs.length >= 3) {
    const w = parseInt(segs[1], 10)
    const h = parseInt(segs[2], 10)
    if (!Number.isNaN(w) && !Number.isNaN(h)) {
      return { width: clampPlaceholderDimension(w), height: clampPlaceholderDimension(h) }
    }
  }
  return { width: PLACEHOLDER_IMAGE_DEFAULT_WIDTH, height: PLACEHOLDER_IMAGE_DEFAULT_HEIGHT }
}

function escapeSvgTextContent(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}

export function buildPlaceholderSvg(width: number, height: number): string {
  const label = `${width} × ${height}`
  const fs = Math.min(24, Math.max(12, Math.floor(Math.min(width, height) / 15)))
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n  <rect width="100%" height="100%" fill="#d4d4d4"/>\n  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${fs}" fill="#333333">${escapeSvgTextContent(label)}</text>\n</svg>\n`
}

export const placeholderImage = async (
  res: ServerResponse,
  _req: IncomingMessage,
  _website: Website,
  requestInfo: RequestInfo,
) => {
  try {
    const { width, height } = parsePlaceholderDimensions(requestInfo.pathname)
    const svg = buildPlaceholderSvg(width, height)
    res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8' })
    res.end(svg)
  } catch (error) {
    console.error(`placeholderImage: ${error instanceof Error ? error.message : 'Unknown error'}`)
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('Internal Server Error')
  }
}

type CrudRelationship = {
  foreignTable: string
  foreignColumn: string
  localColumn: string
}

type CrudOptions = {
  wrapperTemplate?: string
  relationships?: CrudRelationship[]
}

/** DataTables paging defaults for CrudFactory `GET …/json`. */
export const CRUD_DATATABLES_DEFAULT_DRAW = '1'
export const CRUD_DATATABLES_DEFAULT_START = 0
export const CRUD_DATATABLES_DEFAULT_LENGTH = 10
/** Upper bound on `length` to limit accidental large scans. */
export const CRUD_DATATABLES_MAX_LENGTH = 500

/** First scalar from a query-string value (`node` may use `string[]` for repeats). */
export function crudFirstQueryValue(raw: string | string[] | undefined): string | undefined {
  if (raw === undefined) return undefined
  const v = Array.isArray(raw) ? raw[0] : raw
  return v
}

export type CrudParsedDataTablesSearch = {
  value: string | undefined
  regex: boolean
}

export type CrudParsedDataTablesQuery = {
  draw: string | undefined
  start: string | undefined
  length: string | undefined
  order: Record<string, Record<string, string>>
  search: CrudParsedDataTablesSearch
}

/** Parse DataTables.ajax query parameters into a structured object (CrudFactory `json`). */
export function parseCrudDataTablesQuery(queryString: ParsedUrlQuery): CrudParsedDataTablesQuery {
  const result: CrudParsedDataTablesQuery = {
    draw: crudFirstQueryValue(queryString.draw),
    start: crudFirstQueryValue(queryString.start),
    length: crudFirstQueryValue(queryString.length),
    order: {},
    search: {
      value: crudFirstQueryValue(queryString['search[value]']),
      regex: crudFirstQueryValue(queryString['search[regex]']) === 'true',
    },
  }

  Object.entries(queryString)
    .filter(([key]) => key.startsWith('order'))
    .forEach(([key, value]) => {
      const regex = /order\[(\d+)\]\[(.*)\]/
      const match = key.match(regex)
      if (!match) return
      const index = match[1]
      const column = match[2]
      const scalar = crudFirstQueryValue(value as string | string[])
      if (scalar === undefined) return
      const order = result.order[index] ?? ({} as Record<string, string>)
      order[column] = scalar
      result.order[index] = order
    })

  return result
}

export type NormalisedCrudDataTablesPaging = {
  draw: string
  offset: number
  limit: number
}

/** Apply CrudFactory defaults and bounds to parsed DataTables paging fields. */
export function normaliseCrudDataTablesPaging(parsed: CrudParsedDataTablesQuery): NormalisedCrudDataTablesPaging {
  const drawRaw = parsed.draw
  const draw =
    drawRaw !== undefined && drawRaw !== '' ? drawRaw : CRUD_DATATABLES_DEFAULT_DRAW

  const startParsed = parseInt(parsed.start ?? String(CRUD_DATATABLES_DEFAULT_START), 10)
  const lengthParsed = parseInt(parsed.length ?? String(CRUD_DATATABLES_DEFAULT_LENGTH), 10)

  const offset =
    Number.isFinite(startParsed) && startParsed >= 0
      ? Math.floor(startParsed)
      : CRUD_DATATABLES_DEFAULT_START

  let limit = Number.isFinite(lengthParsed) ? Math.floor(lengthParsed) : CRUD_DATATABLES_DEFAULT_LENGTH
  if (limit < 1) limit = CRUD_DATATABLES_DEFAULT_LENGTH
  limit = Math.min(CRUD_DATATABLES_MAX_LENGTH, limit)

  return { draw, offset, limit }
}

/** Escape `%`, `_`, and `\` for safe inclusion inside a MySQL `LIKE` pattern literal. */
export function escapeCrudDataTablesLikeTerm(term: string): string {
  return term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

// import { type LibSQLDatabase } from 'drizzle-orm/libsql'
import { Permission } from './route-guard'
import { MySqlTableWithColumns } from 'drizzle-orm/mysql-core'
import type { MySql2Database } from 'drizzle-orm/mysql2'

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
  /** Drizzle client (`website.db.drizzle`), not a table. */
  private db!: MySql2Database<any>
  // private db!: LibSQLDatabase<Record<string, never>>
  // private sqlite!: libsql.Client
  private static blacklist = ['createdAt', 'updatedAt', 'deletedAt'] // Filter 'id' as well?
  /** Column `Attribute.type` / Drizzle `columnType` values eligible for global `LIKE` search. */
  private static globalLikeSearchTypes = new Set<string>([
    'string',
    'MySqlVarChar',
    'MySqlChar',
    'MySqlText',
    'MySqlTinyText',
    'MySqlMediumText',
    'MySqlLongText',
    'MySqlEnum',
  ])
  private wrapperTemplate = 'crud_wrapper'

  constructor(table: MySqlTableWithColumns<any>, options?: CrudOptions | any) {
    this.table = table
    this.wrapperTemplate = options?.wrapperTemplate || 'crud_wrapper'
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
      .catch((err: unknown) => {
        console.warn(
          'CrudFactory',
          this.name,
          'init query failed (schema drift? run drizzle-kit push):',
          err instanceof Error ? err.message : String(err),
        )
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
      return this.reportError(
        res,
        new Error('Test data can only be generated when the server is running in development mode.'),
      )
    }

    this.generateTestData(10)
      .then(() => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end('Test data was generated.')
      })
      .catch((reason: unknown) => {
        if (res.writableEnded) return
        const err =
          CrudFactory.asControllerError(reason) ?? new Error('Could not generate test data. Check the logs for detail.')
        this.reportError(res, err)
      })
  }

  /** Normalise rejection values for `.catch`; returns `undefined` when there is nothing useful to show. */
  private static asControllerError(reason: unknown): Error | undefined {
    if (reason instanceof Error) return reason
    if (typeof reason === 'string' && reason.trim()) return new Error(reason.trim())
    return undefined
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
      return this.reportError(res, new Error('No ID was provided.'), { status: 404 })
    }
    if (!this.table.deletedAt) {
      this.reportError(res, new Error('This table does not support archiving rows (there is no deleted_at column).'), {
        status: 500,
      })
      return
    }

    this.db
      .update(this.table)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(this.table.id, id))
      .then(() => {
        this.reportSuccess(res, 'The record was archived (soft-deleted).', `/${this.name}`)
      })
      .catch((reason: unknown) => {
        if (res.writableEnded) return
        this.reportError(
          res,
          CrudFactory.asControllerError(reason) ?? new Error('Could not archive that record. Please try again.'),
        )
      })
  }

  private restore(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const id = requestInfo.slug
    if (!id) {
      return this.reportError(res, new Error('No ID was provided.'), { status: 404 })
    }

    this.db
      .update(this.table)
      .set({ deletedAt: null })
      .where(eq(this.table.id, id))
      .then(() => {
        this.reportSuccess(res, 'The record was restored.', `/${this.name}`)
      })
      .catch((reason: unknown) => {
        if (res.writableEnded) return
        this.reportError(
          res,
          CrudFactory.asControllerError(reason) ?? new Error('Could not restore that record. Please try again.'),
        )
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
      return this.reportError(res, new Error('No ID was provided.'), { status: 404 })
    }

    parseForm(res, req)
      .then(({ fields }) => {
        const filtered = Object.fromEntries(
          Object.entries(fields).filter(([key]) => !CrudFactory.blacklist.concat(['id']).includes(key)),
        )
        return this.db.update(this.table).set(filtered).where(eq(this.table.id, id))
      })
      .then(() => {
        this.reportSuccess(res, 'The record was updated.', `/${this.name}/show/${id}`)
      })
      .catch((reason: unknown) => {
        if (res.writableEnded) return
        this.reportError(
          res,
          CrudFactory.asControllerError(reason) ?? new Error('Could not update that record. Please try again.'),
        )
      })
  }

  /**
   * Select by primary key for `show` / `edit`: one row, or `reportError` and `null`.
   */
  private fetchCrudRecordByIdOrRespond(res: ServerResponse, id: string): Promise<any | null> {
    return this.db
      .select(this.table)
      .from(this.table)
      .where(eq(this.table.id, id))
      .then((records: any[]) => {
        if (records.length === 0) {
          this.reportError(res, new Error('That record could not be found.'), { status: 404 })
          return null
        }
        if (records.length > 1) {
          console.error('CrudFactory fetch by id:', this.name, 'multiple rows for ID', id)
          this.reportError(
            res,
            new Error('More than one row matched that ID. Please raise this with your administrator.'),
            { status: 500 },
          )
          return null
        }
        return records[0]
      })
  }

  private edit(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const id = requestInfo.slug
    if (!id) {
      return this.reportError(res, new Error('No ID was provided.'), { status: 404 })
    }
    this.fetchCrudRecordByIdOrRespond(res, id)
      .then((record) => {
        if (record === null) return

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

        const html = website.getContentHtml('edit', this.wrapperTemplate)(data)
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(html)
      })
      .catch((reason: unknown) => {
        if (res.writableEnded) return
        this.reportError(
          res,
          CrudFactory.asControllerError(reason) ?? new Error('Could not load that record for editing. Please try again.'),
        )
      })
  }

  private show(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const id = requestInfo.slug
    if (!id) {
      return this.reportError(res, new Error('No ID was provided.'), { status: 404 })
    }
    this.fetchCrudRecordByIdOrRespond(res, id)
      .then((record) => {
        if (record === null) return

        const data = {
          title: `Show ${this.name} ${id}`,
          controllerName: this.name,
          id,
          record,
          json: JSON.stringify(record),
          tableName: this.name,
          primaryKey: 'id',
          links: [],
        }

        const html = website.getContentHtml('show', this.wrapperTemplate)(data)
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(html)
      })
      .catch((reason: unknown) => {
        if (res.writableEnded) return
        this.reportError(
          res,
          CrudFactory.asControllerError(reason) ?? new Error('Could not load that record. Please try again.'),
        )
      })
  }

  /**
   * Takes POST requests with form data from /new, and inserts a new record into the database
   */
  private create(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    parseForm(res, req)
      .then(({ fields }) => {
        const filtered = Object.fromEntries(
          Object.entries(fields).filter(([key]) => !CrudFactory.blacklist.concat(['id']).includes(key)),
        )
        return this.db.insert(this.table).values(filtered)
      })
      .then(() => {
        this.reportSuccess(res, 'The record was created.', `/${this.name}`)
      })
      .catch((reason: unknown) => {
        if (res.writableEnded) return
        this.reportError(
          res,
          CrudFactory.asControllerError(reason) ?? new Error('Could not create that record. Please try again.'),
        )
      })
  }

  /**
   * Takes GET requests to the /new endpoint, and renders the new form
   */
  private new(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const removeList = ['id', 'createdAt', 'updatedAt', 'deletedAt', 'locked', 'verified', 'role']
    const fields = this.filteredAttributes().filter((field) => !removeList.includes(field.name))

    const data = {
      title: `New ${this.name}`,
      controllerName: this.name,
      fields,
    }

    const html = website.getContentHtml('new', this.wrapperTemplate)(data)

    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(html)
  }

  private list(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const data = {
      title: `List ${this.name}`,
      controllerName: this.name,
      tableName: this.name,
      primaryKey: 'id',
      links: [],
    }
    const html = website.getContentHtml('list', this.wrapperTemplate)(data)

    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(html)
  }

  /** Rows visible to the list scaffold (exclude soft-deleted when `deletedAt` exists). */
  private crudJsonVisibilityWhere(): SQL | undefined {
    if (this.table.deletedAt) {
      return isNull(this.table.deletedAt)
    }
    return undefined
  }

  /** True if this column participates in `/json` global `search[value]` matching. */
  private attributeSupportsCrudGlobalLikeSearch(attribute: Attribute): boolean {
    return CrudFactory.globalLikeSearchTypes.has(attribute.type)
  }

  /**
   * DataTables global `search[value]` as SQL `LIKE '%term%'` across textual columns.
   * Regex mode from the client is ignored — server-side substring match only.
   */
  private crudJsonGlobalSearchWhere(search: CrudParsedDataTablesSearch): SQL | undefined {
    const term = search.value?.trim()
    if (!term) return undefined

    const pattern = `%${escapeCrudDataTablesLikeTerm(term)}%`
    const predicates: SQL[] = []
    for (const attribute of this.filteredAttributes()) {
      if (!this.attributeSupportsCrudGlobalLikeSearch(attribute)) continue
      const column = (this.table as Record<string, unknown>)[attribute.name]
      if (column == null) continue
      predicates.push(like(column as Parameters<typeof like>[0], pattern))
    }
    if (predicates.length === 0) return undefined
    if (predicates.length === 1) return predicates[0]
    return or(...predicates)
  }

  /** Visibility predicate plus optional DataTables global search. */
  private crudJsonCombinedWhere(parsed: CrudParsedDataTablesQuery): SQL | undefined {
    const visibility = this.crudJsonVisibilityWhere()
    const searchSql = this.crudJsonGlobalSearchWhere(parsed.search)
    if (visibility && searchSql) return and(visibility, searchSql)
    return visibility ?? searchSql
  }

  /** `COUNT(*)` with optional Drizzle WHERE (omit for full-table count). */
  private crudJsonCountRows(where?: SQL): Promise<number> {
    const base = this.db
      .select({ count: sql<number>`cast(count(*) as unsigned)`.mapWith(Number) })
      .from(this.table)
    const q = where !== undefined ? base.where(where) : base
    return q.then((rows) => rows[0]?.count ?? 0)
  }

  /**
   * Serve the data in DataTables.net json format
   * The frontend uses /columns to get the columns, and then asks for /json to get the data.
   */
  private json(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const query = url.parse(requestInfo.url, true).query

    const parsedQuery = parseCrudDataTablesQuery(query)
    const { draw, offset, limit } = normaliseCrudDataTablesPaging(parsedQuery)

    const visibilityWhere = this.crudJsonVisibilityWhere()
    const combinedWhere = this.crudJsonCombinedWhere(parsedQuery)

    Promise.all([
      this.crudJsonCountRows(visibilityWhere),
      this.crudJsonCountRows(combinedWhere),
      (() => {
        const base = this.db.select().from(this.table)
        const dataQuery =
          combinedWhere !== undefined ? base.where(combinedWhere) : base
        return dataQuery.limit(limit).offset(offset)
      })(),
    ])
      .then(([recordsTotal, recordsFiltered, records]) => {
        const blob = {
          draw,
          recordsTotal,
          recordsFiltered,
          data: records,
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(blob))
      })
      .catch((err: unknown) => {
        console.error('CrudFactory json:', this.name, err)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Unable to load table data.' }))
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

  private reportSuccess(res: ServerResponse, message: string, redirect: string) {
    if (res.writableEnded) return
    const html = this.website.getContentHtml(
      'message',
      this.wrapperTemplate,
    )({
      state: 'Success',
      message,
      redirect,
    })
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
  }

  /**
   * HTML message page for Crud failures. Full detail is logged; the template sees a sanitised sentence.
   */
  private reportError(res: ServerResponse, error: Error, options?: { status?: number }) {
    if (res.writableEnded || res.headersSent) return

    console.error(error)

    const html = this.website.getContentHtml(
      'message',
      this.wrapperTemplate,
    )({
      state: 'Error',
      message: this.crudHumanReadableError(error),
      redirect: `/${this.name}`,
    })
    const status = options?.status ?? 500
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
  }

  /** Safe copy for `<message>` templates — avoids leaking stacks or noisy driver dumps. */
  private crudHumanReadableError(error: Error): string {
    const raw = (error.message || '').trim()
    if (!raw) return 'Something went wrong. Please try again.'

    if (raw.length > 220 || /[\n\r]/.test(raw)) {
      return 'Something went wrong. Please try again. If this keeps happening, contact your administrator.'
    }

    if (/ at [\w$.]+ \(/.test(raw) || /\.ts:\d+:\d+/.test(raw)) {
      return 'Something went wrong. Please try again. If this keeps happening, contact your administrator.'
    }

    if (
      /\bECONNRESET\b|\bECONNREFUSED\b|deadlock|ER_\w+|syntax error|\berrno\b|\bSQL\b/i.test(raw) &&
      raw.length > 78
    ) {
      return 'Something went wrong while talking to the database. Please try again.'
    }

    return raw
  }
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
import { RawWebsiteConfig } from './types'
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
          obj[key] = String(value[0] ?? '')
        } else {
          obj[key] = String(value ?? '')
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
  /** Target album key; secrets `album` overrides env/config. */
  private album = ''
  private tokens: SmugMugTokenSet | null = null
  private client: SmugMugClient | null = null

  /** Resolved from `SMUGMUG_OAUTH_CALLBACK_URL`, `config.smugmug.oauthCallbackUrl`, or localhost default. */
  private oauthCallbackResolved = 'http://localhost:3000/oauthCallback'

  constructor() {}

  public init(website: Website, name: string): void {
    this.website = website
    this.name = name
    this.table = images

    const cfg = website.config.smugmug
    this.oauthCallbackResolved =
      process.env.SMUGMUG_OAUTH_CALLBACK_URL?.trim() ||
      cfg?.oauthCallbackUrl?.trim() ||
      this.oauthCallbackResolved

    const envAlbum = process.env.SMUGMUG_ALBUM?.trim()
    const cfgAlbum = cfg?.album?.trim()
    this.album = envAlbum || cfgAlbum || ''

    const secretsPath = path.join(this.website.rootPath, 'config', 'secrets.js')

    void import(secretsPath)
      .then((mod: { smugmug?: Partial<SmugMugTokenSet> & { album?: string } }) => {
        const smug = mod.smugmug
        if (!smug) {
          console.warn(`[${website.name}] SmugMug: config/secrets.js has no smugmug export; uploads disabled.`)
          return
        }

        this.tokens = {
          consumer_key: String(smug.consumer_key ?? ''),
          consumer_secret: String(smug.consumer_secret ?? ''),
          oauth_token: String(smug.oauth_token ?? ''),
          oauth_token_secret: String(smug.oauth_token_secret ?? ''),
        }

        const secretAlbum = typeof smug.album === 'string' ? smug.album.trim() : ''
        if (secretAlbum) {
          this.album = secretAlbum
        }

        if (!this.tokens.consumer_key || !this.tokens.consumer_secret) {
          console.warn(
            `[${website.name}] SmugMug: consumer_key/consumer_secret missing; uploads disabled.`,
          )
          this.client = null
          return
        }

        this.client = new SmugMugClient(this.tokens)

        if (this.tokens.oauth_token && this.tokens.oauth_token_secret) {
          return
        }

        const requestParams: Record<string, string> = {
          oauth_callback: 'oob',
          oauth_consumer_key: this.tokens.consumer_key,
          oauth_nonce: Math.random().toString().replace('0.', ''),
          oauth_signature_method: 'HMAC-SHA1',
          oauth_timestamp: String(Math.floor(Date.now() / 1000)),
          oauth_version: '1.0',
        }

        const sortedParams = smugmugSortParams(requestParams)
        const escapedParams = smugmugOauthEscape(smugmugExpandParams(sortedParams))
        const signatureBaseString = `GET&${smugmugOauthEscape(this.client.requestTokenUrl)}&${escapedParams}`

        requestParams.oauth_signature = smugmugB64HmacSha1(
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
              this.tokens!.oauth_token = response.oauth_token
              this.tokens!.oauth_token_secret = response.oauth_token_secret
              // Browser step: `${this.client.authorizeUrl}?oauth_token=…&oauth_callback=${this.oauthCallbackResolved}`
            } else {
              console.error(`[${website.name}] SmugMug: request token failed (see SmugMug response).`)
            }
          })
        })

        req.on('error', (e: unknown) => {
          console.error(`[${website.name}] SmugMug: request token HTTP error:`, e)
        })

        req.end()
      })
      .catch((error: unknown) => {
        if (SmugMugUploader.isMissingSecretsModule(error)) {
          console.warn(
            `[${website.name}] SmugMug: config/secrets.js not found or unreadable; uploads disabled.`,
          )
          return
        }
        console.error(`[${website.name}] SmugMug: error loading secrets:`, error)
      })
  }

  private static isMissingSecretsModule(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error)
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as NodeJS.ErrnoException).code)
        : ''
    return (
      code === 'ERR_MODULE_NOT_FOUND' ||
      code === 'ENOENT' ||
      msg.includes('Cannot find module') ||
      msg.includes('Module not found')
    )
  }

  private smugRespondJson(res: ServerResponse, statusCode: number, payload: Record<string, string>): void {
    res.statusCode = statusCode
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(payload))
  }

  /** Non-null upload path requires consumer OAuth, access token, album key, and a loaded client. */
  private uploadNotReadyReason(): string | null {
    if (!this.client || !this.tokens) {
      return 'SmugMug is not configured (secrets missing or incomplete).'
    }
    const t = this.tokens
    if (!t.consumer_key || !t.consumer_secret) {
      return 'SmugMug consumer credentials are missing.'
    }
    if (!t.oauth_token || !t.oauth_token_secret) {
      return 'SmugMug OAuth is incomplete (access token not stored); finish pairing in config/secrets.js.'
    }
    if (!this.album.trim()) {
      return 'SmugMug album is not set (secrets smugmug.album, SMUGMUG_ALBUM, or config.smugmug.album).'
    }
    return null
  }

  // https://oauth1.wp-api.org/docs/basics/Auth-Flow.html
  public oauthCallback(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    if (!this.client || !this.tokens?.consumer_secret || !this.tokens?.oauth_token_secret) {
      this.smugRespondJson(res, 503, {
        error: 'SmugMug OAuth is not configured (missing secrets or request-token secret).',
      })
      return
    }

    const persistTokens = this.tokens
    const smugClient = this.client

    const query = requestInfo.query
    const oauthVerifier = Array.isArray(query.oauth_verifier) ? query.oauth_verifier[0] : query.oauth_verifier
    const oauthTokenQuery = Array.isArray(query.oauth_token) ? query.oauth_token[0] : query.oauth_token

    if (typeof oauthVerifier !== 'string' || !oauthVerifier || typeof oauthTokenQuery !== 'string' || !oauthTokenQuery) {
      this.smugRespondJson(res, 400, { error: 'SmugMug OAuth callback missing oauth_verifier or oauth_token.' })
      return
    }

    const tokenExchangeParams: Record<string, string> = {
      oauth_consumer_key: persistTokens.consumer_key,
      oauth_token: oauthTokenQuery,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: String(Date.now()),
      oauth_nonce: Math.random().toString().replace('0.', ''),
      oauth_verifier: oauthVerifier,
    }

    const sorted = smugmugSortParams(tokenExchangeParams)

    const normalized = encodeURIComponent(
      Object.entries(sorted)
        .map(([key, value]) => `${key}=${value}`)
        .join('&'),
    )
    const method = 'POST'

    tokenExchangeParams.oauth_signature = smugmugB64HmacSha1(
      `${persistTokens.consumer_secret}&${persistTokens.oauth_token_secret}`,
      `${method}&${encodeURIComponent(smugClient.accessTokenUrl)}&${normalized}`,
    )

    // console.log('Token exchange url is', smugClient.accessTokenUrl + '?' + new URLSearchParams(tokenExchangeParams))

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
      // console.log('Token Exchange Response Status:', httpsResponse.statusCode)

      let data = ''
      httpsResponse.on('data', (chunk: any) => {
        data += chunk
      })

      httpsResponse.on('error', (e: any) => {
        console.error('Token Exchange Error:', e)
      })

      httpsResponse.on('end', () => {
        // console.log('Token Exchange Response:', data)

        const response = data.split('&').reduce(
          (acc, item) => {
            const [key, value] = item.split('=')
            acc[key] = value
            return acc
          },
          {} as Record<string, string>,
        )

        // console.log('Response is', response)

        persistTokens.oauth_token = response.oauth_token
        persistTokens.oauth_token_secret = response.oauth_token_secret

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
    // console.log("Hey we're running a controller called 'uploadPhoto'")

    if (method != 'POST') {
      res.end('This should be a post')
      return
    }

    const reason = this.uploadNotReadyReason()
    if (reason) {
      this.smugRespondJson(res, 503, { error: reason })
      return
    }

    parseForm(res, req)
      .then(this.uploadImageToSmugmug.bind(this))
      .then((data) => {
        // console.log('Finished uploading, with this data:', data)
        res.end(JSON.stringify(data))
      })
      .catch((err) => {
        console.error('Error uploading photo:', err)
        res.end('error')
      })
  }

  /**
   * Take a ParsedForm, and upload the image to SmugMug.
   * If the image already exists, return the existing image.
   * If the image doesn't exist, upload it to SmugMug, and return the new image.
   *
   * TODO:
   * - Tests
   * - Make it more efficient
   */
  private async uploadImageToSmugmug(form: ParsedForm) {
    const that = this
    const file = form.files.fileToUpload?.[0]
    const drizzle = this.website.db.drizzle
    const client = this.client

    if (!file) {
      return Promise.reject(new Error('No file provided'))
    }
    if (!client) {
      return Promise.reject(new Error('SmugMug client not initialised'))
    }

    const md5sum = crypto.createHash('md5').update(fs.readFileSync(file.filepath)).digest('hex')

    return drizzle
      .select()
      .from(images)
      .where(eq(images.archivedMD5, md5sum))
      .then((imageResults: Image[]) => {
        if (imageResults.length > 0) {
          return Promise.resolve(imageResults[0])
        } else {
          return new Promise((resolve, reject) => {
            const caption = form.fields.caption ?? ''
            const filename = form.fields.filename ?? file.originalFilename ?? ''
            const title = form.fields.title ?? filename ?? caption ?? ''
            const keywords = form.fields.keywords ?? title ?? caption ?? filename ?? this.website.name ?? ''

            const host = 'upload.smugmug.com'
            const path = '/'
            const targetUrl = `https://${host}${path}`
            const method = 'POST'

            // Sign the request (same OAuth process)
            const params = client.signRequest(method, targetUrl)

            // https://forum.uipath.com/t/unable-to-pass-binary-image-data-inside-http-request-body/849190/8
            // Create the multipart form data
            const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substr(2, 8)
            const formData = SmugMugClient.createMultipartFormData(file, boundary)

            const options = {
              host: host,
              port: 443,
              path: path,
              method: method,
              headers: {
                Authorization: smugmugBundleAuthorization(targetUrl, params),
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
                that
                  .saveImage(JSON.parse(data))
                  .then((insertResult) => {
                    const insertIdNum = SmugMugUploader.insertIdFromMysqlResult(insertResult)
                    if (insertIdNum === undefined) {
                      throw new Error('Image insert returned no insertId')
                    }
                    return drizzle.select().from(images).where(eq(images.id, insertIdNum))
                  })
                  .then((imageResults) => {
                    const row = (imageResults as Image[])[0]
                    if (row === undefined) {
                      reject(new Error('Image row missing after insert'))
                      return
                    }
                    resolve(row)
                  })
                  .catch((err: unknown) => {
                    reject(err)
                  })
              })
            })

            httpsRequest.on('error', function (e) {
              console.error('problem with request:')
              console.error(e)
              reject(e)
            })

            // httpsRequest.on('close', () => {
            //   console.log('httpRequest closed')
            // })

            httpsRequest.write(formData)
            httpsRequest.end()
          })
        }
      })
  }

  /** mysql2 `insertId` extraction from Drizzle `insert`/`execute` result shapes. */
  private static insertIdFromMysqlResult(result: unknown): number | undefined {
    if (result != null && typeof result === 'object' && 'insertId' in result) {
      const raw = (result as { insertId: number | bigint | undefined }).insertId
      if (raw === undefined) return undefined
      return typeof raw === 'bigint' ? Number(raw) : raw
    }
    return undefined
  }

  private saveImage(data: {
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
  }): Promise<unknown> {
    const AlbumImageUri = data.Image.AlbumImageUri
    const client = this.client
    if (!client) {
      return Promise.reject(new Error('SmugMug client not initialised'))
    }

    return client.smugmugApiCall(AlbumImageUri).then((response: string) => {
      const responseData = JSON.parse(response) as {
        Response?: { AlbumImage?: Record<string, any> }
      }
      const ai = responseData.Response?.AlbumImage
      const drizzle = this.website.db.drizzle

      const imageKey = ai?.ImageKey
      if (typeof imageKey !== 'string' || !imageKey) {
        throw new Error('SmugMug response missing AlbumImage.ImageKey')
      }

      return drizzle.insert(images).values({
        albumKey: typeof ai.AlbumKey === 'string' ? ai.AlbumKey : '',
        caption: typeof ai.Caption === 'string' ? ai.Caption : '',
        filename: typeof ai.FileName === 'string' ? ai.FileName : '',
        url: data.Image.URL,
        originalSize:
          typeof ai.OriginalSize === 'number'
            ? ai.OriginalSize
            : ai.OriginalSize != null
              ? Number(ai.OriginalSize)
              : null,
        originalWidth:
          typeof ai.OriginalWidth === 'number'
            ? ai.OriginalWidth
            : ai.OriginalWidth != null
              ? Number(ai.OriginalWidth)
              : null,
        originalHeight:
          typeof ai.OriginalHeight === 'number'
            ? ai.OriginalHeight
            : ai.OriginalHeight != null
              ? Number(ai.OriginalHeight)
              : null,
        thumbnailUrl: typeof ai.ThumbnailUrl === 'string' ? ai.ThumbnailUrl : '',
        archivedUri: typeof ai.ArchivedUri === 'string' ? ai.ArchivedUri : '',
        archivedSize:
          typeof ai.ArchivedSize === 'number'
            ? ai.ArchivedSize
            : ai.ArchivedSize != null
              ? Number(ai.ArchivedSize)
              : null,
        archivedMD5: typeof ai.ArchivedMD5 === 'string' ? ai.ArchivedMD5 : '',
        imageKey,
        preferredDisplayFileExtension:
          typeof ai.PreferredDisplayFileExtension === 'string'
            ? ai.PreferredDisplayFileExtension
            : '',
        uri: typeof ai.Uri === 'string' && ai.Uri ? ai.Uri : data.Image.ImageUri,
      })
    })
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

import { albums, images, type Image } from '../models/smugmug'
const AlbumMachine = new CrudFactory(albums)
const ImageMachine = new CrudFactory(images)

import { marked, options } from 'marked'

export class MarkdownViewerFactory {
  constructor(private folder: string) {}

  public controller(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo): void {
    const folder_path = path.join(website.rootPath, this.folder)
    const files = fs.readdirSync(folder_path)
    const data: any = {
      controller: requestInfo.controller,
      slug: requestInfo.slug,
      filename: requestInfo.slug.replace('.md', ''),
      files: files,
    }

    if (files.includes(requestInfo.slug)) {
      const content = fs.readFileSync(path.join(folder_path, requestInfo.slug), 'utf8')
      data.obsidian_html = marked.parse(content, { async: false })

      const html = website.getContentHtml('md_show', 'wrapper')
      res.end(html(data))
    } else {
      // console.log('Request info', requestInfo)

      const html = website.getContentHtml('md_list', 'wrapper')
      res.end(html(data))
    }
  }
}

/**
 * Why not just use getContentHtml?
 *
 * This controller serves a hbs or md file inside of a wrapper
 * @param filename - A hbs or md file to serve
 * @param data - Data to pass to the content template
 * @param wrapper_template - The wrapper template to use, default is 'wrapper'
 * @returns Controller function that serves the content inside of a wrapper
 */
export function wrap(filename: string, data: any = {}, wrapper_template: string = 'wrapper'): Controller {
  // TODO: Check that wrapper_template exists
  // Check that data is valid
  // Don't crash the server if this function crashes

  const ext = path.extname(filename).toLowerCase()
  if (ext === '.md') {
    return md_file(filename, data, wrapper_template)
  } else if (ext === '.hbs') {
    return hbs(filename.replace(ext, ''), data, wrapper_template)
  } else {
    return (res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) => {
      res.end('404 Not Found')
    }
  }
}

/**
 * This is a simple Handlebars wrapper server, that serves content instide of a wrapper
 * @param content_template - Put in the name of a handlebars template, that you want wrapped and served
 * @param data - Data to pass to the content template
 * @param wrapper_template - The wrapper template to use, default is 'wrapper'
 * @returns Controller function that serves the content inside of a wrapper
 */
export function hbs(content_template: string, data: any = {}, wrapper_template: string = 'wrapper'): Controller {
  return (res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) => {
    const html = website.getContentHtml(content_template, wrapper_template)
    res.end(html({ content: content_template, wrapper: wrapper_template, ...data }))
  }
}

/**
 * This controller serves a markdown file inside of a wrapper
 * @param filename - The filename of the markdown file to serve, <PROJECT>/src/$filename.md
 * @param data - Data to pass to the content template
 * @param wrapper_template - The wrapper template to use, default is 'wrapper'
 * @returns Controller function that serves the markdown file inside of a wrapper
 */
export function md_file(filename: string, data: any = {}, wrapper_template: string = 'wrapper'): Controller {
  return (res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) => {
    fs.promises.readFile(path.join(website.rootPath, 'src', filename), 'utf8').then((content) => {
      website.handlebars.registerPartial('content', marked.parse(content, { async: false }))
      const templateFile = website.handlebars.partials[wrapper_template] ?? ''
      const html = website.handlebars.compile(templateFile)
      res.end(html(data))
    })
  }
}
