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
import { and, asc, desc, eq, getTableName, isNull, like, or, sql, type SQL } from 'drizzle-orm'
import { RequestInfo } from './server'
import url from 'url'
import { ParsedUrlQuery } from 'querystring'
import crypto from 'crypto'
import type { Machine } from './types.js'
import { parseForm } from './util.js'

export type { Machine } from './types.js'

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

// Go deeper, /data/<folder>/<datestamp_UUID_folder>/manifest.json
// If the slug is list, return a list of all folders.
export function latestDataFolder(
  folder: string,
  options: {
    shape?: RegExp
    target?: string
    sort?: 'name' | 'lastModified' | 'dateCreated'
  } = {},
): Controller {
  return (res, _req, website, requestInfo) => {
    const dir = path.join(website.rootPath, 'data', folder)
    fs.promises
      .readdir(dir, { withFileTypes: true })
      .then((entries) => {
        const subFolders = entries.filter((e) => e.isDirectory()).map((e) => e.name)
        const sortedSubFolders = subFolders
          .sort((a, b) => a.localeCompare(b))
          .filter((subFolder) => {
            if (options.shape) {
              return options.shape.test(subFolder)
            }
            return true
          })
          .map((subFolder) => path.join(subFolder, options.target ?? 'manifest.json'))

        if (requestInfo.slug === 'list') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(sortedSubFolders))
          return
        }

        const latestFolder = sortedSubFolders.pop()
        if (!latestFolder) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          console.error(`No subfolders in ${folder}`)
          res.end('404')
          return
        }
        res.writeHead(302, { Location: `/${folder}/${latestFolder}` })
        res.end()
      })
      .catch((err: NodeJS.ErrnoException) => {
        const status = err.code === 'ENOENT' ? 404 : 500
        res.writeHead(status, { 'Content-Type': 'text/plain' })
        console.error(`Error in ${website.name}/latestDataFolder: ${err.message}`)
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

/** DataTables list cell renderer id (`list.hbs` dispatches to JS helpers). */
export type CrudColumnRenderer = 'json' | 'date' | 'money' | 'number' | 'image' | 'boolean'

export type CrudOptions = {
  wrapperTemplate?: string
  relationships?: CrudRelationship[]
  /** Hide create/edit UI and reject write actions (list/json/columns/show only). */
  readOnly?: boolean
  /** Use Bootstrap `container-fluid` instead of fixed-width `container` (~1170px). */
  fullWidth?: boolean
  /** Show Download CSV on list view; GET …/csv exports rows matching current search/sort (capped). */
  downloadableCsv?: boolean
  /** Per-column renderer; overrides {@link crudInferColumnRenderer} for that column. */
  columnRenderers?: Partial<Record<string, CrudColumnRenderer>>
}

/** DataTables paging defaults for CrudFactory `GET …/json`. */
export const CRUD_DATATABLES_DEFAULT_DRAW = '1'
export const CRUD_DATATABLES_DEFAULT_START = 0
export const CRUD_DATATABLES_DEFAULT_LENGTH = 10
/** Upper bound on `length` to limit accidental large scans. */
export const CRUD_DATATABLES_MAX_LENGTH = 500
/** Max rows for GET …/csv exports (same filters/order as DataTables, no paging). */
export const CRUD_CSV_MAX_ROWS = 50_000

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
  const draw = drawRaw !== undefined && drawRaw !== '' ? drawRaw : CRUD_DATATABLES_DEFAULT_DRAW

  const startParsed = parseInt(parsed.start ?? String(CRUD_DATATABLES_DEFAULT_START), 10)
  const lengthParsed = parseInt(parsed.length ?? String(CRUD_DATATABLES_DEFAULT_LENGTH), 10)

  const offset =
    Number.isFinite(startParsed) && startParsed >= 0 ? Math.floor(startParsed) : CRUD_DATATABLES_DEFAULT_START

  let limit = Number.isFinite(lengthParsed) ? Math.floor(lengthParsed) : CRUD_DATATABLES_DEFAULT_LENGTH
  if (limit < 1) limit = CRUD_DATATABLES_DEFAULT_LENGTH
  limit = Math.min(CRUD_DATATABLES_MAX_LENGTH, limit)

  return { draw, offset, limit }
}

/** Escape `%`, `_`, and `\` for safe inclusion inside a MySQL `LIKE` pattern literal. */
export function escapeCrudDataTablesLikeTerm(term: string): string {
  return term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export type CrudJsonOrderSpec = {
  name: string
  dir: 'asc' | 'desc'
}

/** True when DataTables global search should narrow rows (and warrants recordsFiltered count). */
export function hasActiveCrudGlobalSearch(search: CrudParsedDataTablesSearch): boolean {
  return Boolean(search.value?.trim())
}

/** Sorted DataTables `order[n][…]` entries (column index, optional name, direction). */
export function getCrudDataTablesOrderEntries(
  order: CrudParsedDataTablesQuery['order'],
): Array<{ columnIndex?: number; name?: string; dir: 'asc' | 'desc' }> {
  return Object.keys(order)
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => {
      const entry = order[key] ?? {}
      const columnRaw = entry.column
      const columnIndex =
        columnRaw !== undefined && columnRaw !== '' ? parseInt(columnRaw, 10) : undefined
      const name = entry.name?.trim() || undefined
      const dir: 'asc' | 'desc' = entry.dir?.toLowerCase() === 'asc' ? 'asc' : 'desc'
      return {
        columnIndex: Number.isFinite(columnIndex) ? columnIndex : undefined,
        name,
        dir,
      }
    })
}

/**
 * Resolve DataTables order params to Drizzle column keys on the table.
 * Falls back to `defaultColumn` (typically PK or first column) when order is missing/invalid.
 */
export function resolveCrudJsonOrderColumnNames(
  parsed: CrudParsedDataTablesQuery,
  availableColumns: string[],
  defaultColumn: string,
): CrudJsonOrderSpec[] {
  const entries = getCrudDataTablesOrderEntries(parsed.order)
  const resolved: CrudJsonOrderSpec[] = []

  for (const entry of entries) {
    let name: string | undefined
    if (entry.name && availableColumns.includes(entry.name)) {
      name = entry.name
    } else if (entry.columnIndex !== undefined && availableColumns[entry.columnIndex]) {
      name = availableColumns[entry.columnIndex]
    }
    if (name) {
      resolved.push({ name, dir: entry.dir })
    }
  }

  if (resolved.length === 0) {
    const fallback =
      availableColumns.includes(defaultColumn) ? defaultColumn : (availableColumns[0] ?? defaultColumn)
    return [{ name: fallback, dir: 'desc' }]
  }

  return resolved
}

/** Drizzle/MySQL column types eligible for DataTables server-side ORDER BY. */
export function crudColumnSupportsDataTablesOrder(type: string): boolean {
  if (crudColumnSupportsDataTablesSearch(type)) return true
  return new Set([
    'num',
    'date',
    'bool',
    'MySqlInt',
    'MySqlTinyInt',
    'MySqlSmallInt',
    'MySqlMediumInt',
    'MySqlBigInt',
    'MySqlDouble',
    'MySqlFloat',
    'MySqlDecimal',
    'MySqlBoolean',
    'MySqlDate',
    'MySqlDateTime',
    'MySqlTimestamp',
    'MySqlTime',
    'MySqlYear',
  ]).has(type)
}

/** Drizzle/MySQL column types eligible for DataTables global search (`LIKE`). */
export function crudColumnSupportsDataTablesSearch(type: string): boolean {
  return new Set([
    'string',
    'MySqlVarChar',
    'MySqlChar',
    'MySqlText',
    'MySqlTinyText',
    'MySqlMediumText',
    'MySqlLongText',
    'MySqlEnum',
  ]).has(type)
}

/** Bootstrap main width for CRUD pages (`wrapper.hbs` → `wrapperMainClass`). */
export function crudWrapperMainClass(fullWidth: boolean): string | undefined {
  return fullWidth ? 'container-fluid page py-3 px-3' : undefined
}

/** Merge CRUD page data with optional full-width wrapper class for Handlebars layouts. */
export function crudWrapperPageData<T extends Record<string, unknown>>(
  data: T,
  options: { fullWidth?: boolean },
): T & { wrapperMainClass?: string } {
  const wrapperMainClass = crudWrapperMainClass(Boolean(options.fullWidth))
  if (!wrapperMainClass) return data
  return { ...data, wrapperMainClass }
}

export function crudCsvEscape(val: unknown): string {
  if (val == null) return ''
  const s = typeof val === 'object' ? JSON.stringify(val) : String(val)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function rowsToCrudCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const lines = [columns.join(',')]
  for (const row of rows) {
    lines.push(columns.map((col) => crudCsvEscape(row[col])).join(','))
  }
  return `${lines.join('\n')}\n`
}

export function sendCsv(res: ServerResponse, filename: string, body: string) {
  const safeName = filename.replace(/[^\w.\-]+/g, '_')
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`)
  res.end(body)
}

import { createRequire } from 'module'
import { dirname, join } from 'path'
import { Permission } from './route-guard'
import { is } from 'drizzle-orm'
import { MySqlTable, type MySqlTableWithColumns } from 'drizzle-orm/mysql-core'
import { getTableConfig as getMysqlTableConfig } from 'drizzle-orm/mysql-core/utils'
import { PgTable } from 'drizzle-orm/pg-core'
import { SQLiteTable } from 'drizzle-orm/sqlite-core'
import { getTableConfig as getSqliteTableConfig } from 'drizzle-orm/sqlite-core/utils'
import type { MySql2Database } from 'drizzle-orm/mysql2'

type CrudPrimaryKeyDef = { columns: unknown[] }

/** `drizzle-orm/pg-core/utils` resolves to a subfolder; load `utils.js` explicitly. */
function pgGetTableConfig(table: PgTable) {
  const require = createRequire(import.meta.url)
  const drizzleRoot = dirname(require.resolve('drizzle-orm/package.json'))
  const pgUtils = require(join(drizzleRoot, 'pg-core/utils.js')) as {
    getTableConfig: (t: PgTable) => { primaryKeys: CrudPrimaryKeyDef[] }
  }
  return pgUtils.getTableConfig(table)
}

function crudTablePrimaryKeyDefs(table: unknown): CrudPrimaryKeyDef[] {
  if (is(table, MySqlTable)) return getMysqlTableConfig(table).primaryKeys
  if (is(table, PgTable)) return pgGetTableConfig(table).primaryKeys
  if (is(table, SQLiteTable)) return getSqliteTableConfig(table).primaryKeys
  return []
}

/** Map a Drizzle column object to its property key on the table (`dbt_no`, not `DBT_NO`). */
function crudColumnPropertyKey(table: unknown, col: unknown): string | undefined {
  if (col == null || table == null || typeof table !== 'object') return undefined
  const tableObj = table as Record<string, unknown>
  const byRef = Object.keys(tableObj).find((k) => tableObj[k] === col)
  if (byRef) return byRef
  const sqlName =
    typeof col === 'object' && col !== null && 'name' in col && typeof (col as { name: unknown }).name === 'string'
      ? (col as { name: string }).name
      : undefined
  if (!sqlName) return undefined
  return Object.keys(tableObj).find((k) => {
    const v = tableObj[k]
    return (
      k === sqlName ||
      k.toLowerCase() === sqlName.toLowerCase() ||
      (typeof v === 'object' && v !== null && 'name' in v && (v as { name: string }).name === sqlName)
    )
  })
}

/** Drizzle PK property keys from `primaryKey({ columns: [...] })` (JS keys, not SQL names). */
export function crudPrimaryKeyColumnNames(table: unknown): string[] {
  try {
    const names: string[] = []
    for (const pk of crudTablePrimaryKeyDefs(table)) {
      for (const col of pk.columns) {
        const key = crudColumnPropertyKey(table, col)
        if (key) names.push(key)
      }
    }
    return names
  } catch {
    return []
  }
}

const CRUD_JSON_COLUMN_TYPES = new Set<string>([
  'json',
  'MySqlJson',
  'PgJson',
  'PgJsonb',
  'SQLiteTextJson',
  'SQLiteBlobJson',
])

const CRUD_DATE_COLUMN_TYPES = new Set<string>([
  'date',
  'MySqlDate',
  'MySqlDateTime',
  'MySqlTimestamp',
  'MySqlTime',
  'MySqlYear',
  'PgDate',
  'PgDateString',
  'PgTimestamp',
  'PgTimestampString',
  'SQLiteTimestamp',
  'SQLiteTimestampMillis',
  'SQLiteTimestampSeconds',
])

/** Infer cell renderer from Drizzle `columnType` / mapped type (no site-specific column names). */
export function crudInferColumnRenderer(attribute: { name: string; type: string }): CrudColumnRenderer | undefined {
  if (CRUD_JSON_COLUMN_TYPES.has(attribute.type)) return 'json'
  if (CRUD_DATE_COLUMN_TYPES.has(attribute.type)) return 'date'
  return undefined
}

/** Explicit `columnRenderers` win; else {@link crudInferColumnRenderer}. */
export function crudResolveColumnRenderer(
  attribute: { name: string; type: string },
  columnRenderers?: Partial<Record<string, CrudColumnRenderer>>,
): CrudColumnRenderer | undefined {
  const explicit = columnRenderers?.[attribute.name]
  if (explicit) return explicit
  return crudInferColumnRenderer(attribute)
}

/**
 * # CrudFactory — roadmap & design notes
 *
 * ## Implemented (2026-06)
 * - Server-side DataTables (`/json`, `/columns`, `/list`) with MySQL column typing
 * - `readOnly`, `fullWidth`, `downloadableCsv` options
 * - PK column detection via Drizzle `getTableConfig` (not only `column.primaryKey` flag)
 * - PK cells link to `/show/:id` when table has a **single** PK column
 * - `renderer: 'json'` — collapsible JSON blob toggle + hljs (`MySqlJson`, `PgJson`, …)
 * - Horizontal scroll on wide grids (`crud.scss` → `.dt-layout-full`) without moving layout bars
 *
 * ## Column renderers
 *
 * Sites declare per-column renderers on `CrudFactory` options; Thalia infers from Drizzle
 * `columnType` when not overridden (`crudInferColumnRenderer` — dialect-aware, no hard-coded names).
 *
 * | Renderer   | Use case |
 * |------------|----------|
 * | `json`     | JSON columns — toggle + highlighted `<pre>` |
 * | `date`     | Locale date/time instead of raw ISO strings |
 * | `money`    | Currency formatting (locale + decimals) |
 * | `number`   | Thousands separators; raw in CSV/sort |
 * | `image`    | Thumbnail + link to full asset |
 * | `boolean`  | Yes/No or icons |
 *
 * ```ts
 * new CrudFactory(table, {
 *   columnRenderers: { metadata: 'json', amount: 'money' },
 * })
 * ```
 * `/columns` echoes `renderer` on each column; `list.hbs` dispatches to shared JS helpers.
 *
 * ## Primary keys
 *
 * Drizzle schemas often declare PKs in `primaryKey({ columns: [...] })`, not on individual
 * columns — CrudFactory uses dialect `getTableConfig`, not `column.primaryKey` alone.
 *
 * - **Single PK:** list cell links to show; `fetchCrudRecordByIdOrRespond` uses that column.
 *   PK property keys come from the Drizzle table object (`dbt_no`), not SQL names (`DBT_NO`).
 *   Slug is `encodeURIComponent(pkValue)` — safe for numeric and most string keys.
 * - **Composite PK:** list shows values; show/edit URL encoding TBD (see Micronet dashboards doc).
 *
 * ## Row selection & bulk actions (future)
 *
 * - DataTables checkbox column + `layout.topStart` action buttons
 * - Tie actions to selected PKs (export subset, tag, delete) — needs write permissions + API
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
  private readOnly = false
  private fullWidth = false
  private downloadableCsv = false
  private columnRenderers: Partial<Record<string, CrudColumnRenderer>> = {}

  constructor(table: MySqlTableWithColumns<any>, options?: CrudOptions | any) {
    this.table = table
    this.wrapperTemplate = options?.wrapperTemplate || 'crud_wrapper'
    this.readOnly = Boolean(options?.readOnly)
    this.fullWidth = Boolean(options?.fullWidth)
    this.downloadableCsv = Boolean(options?.downloadableCsv)
    this.columnRenderers = options?.columnRenderers ?? {}
  }

  private pageData<T extends Record<string, unknown>>(data: T): T & { wrapperMainClass?: string } {
    return crudWrapperPageData(data, { fullWidth: this.fullWidth })
  }

  public init(website: Website, name: string) {
    this.name = name
    this.website = website
    this.db = website.db.drizzle

    console.debug('CrudFactory', this.name, 'ready for table', getTableName(this.table))
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
      case 'csv':
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
   * - csv: GET /tableName/csv (returns the data for DataTables.net as a CSV file, takes the same parameters as json)
   * - testdata: GET /tableName/testdata (generates test data, NODE_ENV=development only)
   * - summary: GET /tableName/summary (JSON summary of the table, quick estimate of rows, columns, size, primary keys, foreign keys, description, and schema, for LLM usage)
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
      case 'csv':
        this.csv(res, req, website, requestInfo)
        break
      case 'new':
        if (this.denyWriteWhenReadOnly(res)) break
        this.new(res, req, website, requestInfo)
        break
      case 'create':
        if (this.denyWriteWhenReadOnly(res)) break
        this.create(res, req, website, requestInfo)
        break
      case 'testdata':
        if (this.denyWriteWhenReadOnly(res)) break
        this.testdata(res, req, website, requestInfo)
        break
      case 'edit':
        if (this.denyWriteWhenReadOnly(res)) break
        this.edit(res, req, website, requestInfo)
        break
      case 'update':
        if (this.denyWriteWhenReadOnly(res)) break
        this.update(res, req, website, requestInfo)
        break
      case 'delete':
        if (this.denyWriteWhenReadOnly(res)) break
        this.delete(res, req, website, requestInfo)
        break
      case 'restore':
        if (this.denyWriteWhenReadOnly(res)) break
        this.restore(res, req, website, requestInfo)
        break
      default:
        this.show(res, req, website, requestInfo)
    }
  }

  private denyWriteWhenReadOnly(res: ServerResponse): boolean {
    if (!this.readOnly) return false
    this.reportError(res, new Error('This table is read-only.'), { status: 403 })
    return true
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
    const decodedId = decodeURIComponent(id)
    const pkCols = crudPrimaryKeyColumnNames(this.table)

    const runSelect = (where: ReturnType<typeof eq>) =>
      this.db
        .select()
        .from(this.table)
        .where(where)
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

    if (pkCols.length === 1) {
      const pk = pkCols[0]!
      const column = (this.table as Record<string, unknown>)[pk]
      if (column == null) {
        this.reportError(res, new Error('Primary key column is not configured.'), { status: 500 })
        return Promise.resolve(null)
      }
      return runSelect(eq(column as Parameters<typeof eq>[0], decodedId))
    }

    if ((this.table as Record<string, unknown>).id) {
      return runSelect(eq(this.table.id, decodedId))
    }

    this.reportError(
      res,
      new Error('Show and edit are not supported for composite primary keys yet.'),
      { status: 501 },
    )
    return Promise.resolve(null)
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

        const pkColumns = crudPrimaryKeyColumnNames(this.table)
        const data = {
          controllerName: this.name,
          id,
          record,
          isNotDeleted,
          json: JSON.stringify(record),
          tableName: this.name,
          primaryKey: pkColumns[0] ?? 'id',
          links: [],
        }

        const html = website.getContentHtml('edit', this.wrapperTemplate)(this.pageData(data))
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(html)
      })
      .catch((reason: unknown) => {
        if (res.writableEnded) return
        this.reportError(
          res,
          CrudFactory.asControllerError(reason) ??
            new Error('Could not load that record for editing. Please try again.'),
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

        const pkColumns = crudPrimaryKeyColumnNames(this.table)
        const data = {
          title: `Show ${this.name} ${id}`,
          controllerName: this.name,
          id,
          record,
          json: JSON.stringify(record),
          showRowsJson: JSON.stringify(this.crudShowFieldRows(record as Record<string, unknown>)),
          tableName: this.name,
          primaryKey: pkColumns[0] ?? 'id',
          readOnly: this.readOnly,
          links: [],
        }

        const html = website.getContentHtml('show', this.wrapperTemplate)(this.pageData(data))
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

    const html = website.getContentHtml('new', this.wrapperTemplate)(this.pageData(data))

    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(html)
  }

  private list(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const pkColumns = crudPrimaryKeyColumnNames(this.table)
    const primaryKey = pkColumns[0] ?? this.filteredAttributes().find((a) => a.primaryKey)?.name ?? 'id'
    const data = {
      title: `List ${this.name}`,
      controllerName: this.name,
      tableName: this.name,
      primaryKey,
      primaryKeyLinkEnabled: pkColumns.length === 1,
      readOnly: this.readOnly,
      downloadableCsv: this.downloadableCsv,
      links: [],
    }
    const html = website.getContentHtml('list', this.wrapperTemplate)(this.pageData(data))

    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(html)
  }

  /** Default sort column for `/json` when the client sends no order (PK, else first column). */
  private crudJsonDefaultOrderColumnName(): string {
    const cols = this.colsFiltered()
    const pkCols = crudPrimaryKeyColumnNames(this.table)
    if (pkCols.length === 1 && cols.includes(pkCols[0]!)) return pkCols[0]!
    const pk = this.filteredAttributes().find((attribute) => attribute.primaryKey)?.name
    if (pk && cols.includes(pk)) return pk
    return cols[0] ?? 'id'
  }

  /** Build Drizzle `orderBy` terms from DataTables `order[n][…]` query params. */
  private crudJsonBuildOrderBy(parsed: CrudParsedDataTablesQuery) {
    const available = this.colsFiltered()
    const specs = resolveCrudJsonOrderColumnNames(
      parsed,
      available,
      this.crudJsonDefaultOrderColumnName(),
    )
    const clauses: ReturnType<typeof asc>[] = []
    for (const spec of specs) {
      const column = (this.table as Record<string, unknown>)[spec.name]
      if (column == null) continue
      clauses.push(spec.dir === 'asc' ? asc(column as Parameters<typeof asc>[0]) : desc(column as Parameters<typeof desc>[0]))
    }
    return clauses
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
    const base = this.db.select({ count: sql<number>`cast(count(*) as unsigned)`.mapWith(Number) }).from(this.table)
    const q = where !== undefined ? base.where(where) : base
    return q.then((rows) => rows[0]?.count ?? 0)
  }

  /** Shared SELECT for `/json` and `/csv` (filters, order; optional paging). */
  private crudJsonSelectQuery(
    parsed: CrudParsedDataTablesQuery,
    paging?: { limit: number; offset: number },
  ) {
    let dataQuery = this.db.select().from(this.table)
    const combinedWhere = this.crudJsonCombinedWhere(parsed)
    if (combinedWhere !== undefined) {
      dataQuery = dataQuery.where(combinedWhere) as typeof dataQuery
    }
    const orderBy = this.crudJsonBuildOrderBy(parsed)
    if (orderBy.length > 0) {
      dataQuery = dataQuery.orderBy(...orderBy) as typeof dataQuery
    }
    if (paging) {
      return dataQuery.limit(paging.limit).offset(paging.offset)
    }
    return dataQuery.limit(CRUD_CSV_MAX_ROWS)
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
    const hasSearch = hasActiveCrudGlobalSearch(parsedQuery.search)

    const countTotalPromise = this.crudJsonCountRows(visibilityWhere)
    const countFilteredPromise = hasSearch
      ? this.crudJsonCountRows(combinedWhere)
      : countTotalPromise

    const dataPromise = this.crudJsonSelectQuery(parsedQuery, { limit, offset })

    Promise.all([countTotalPromise, countFilteredPromise, dataPromise])
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
   * CSV export using the same search/order as DataTables (ignores page length/offset).
   * Enabled when `downloadableCsv` is set on the CrudFactory constructor.
   */
  private csv(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    if (!this.downloadableCsv) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('CSV export is not enabled for this table.')
      return
    }

    const query = url.parse(requestInfo.url, true).query
    const parsedQuery = parseCrudDataTablesQuery(query)
    const columnNames = this.colsFiltered()

    this.crudJsonSelectQuery(parsedQuery)
      .then((records) => {
        const body = rowsToCrudCsv(columnNames, records as Record<string, unknown>[])
        const stamp = new Date().toISOString().slice(0, 10)
        sendCsv(res, `${this.name}-${stamp}.csv`, body)
      })
      .catch((err: unknown) => {
        console.error('CrudFactory csv:', this.name, err)
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('Unable to export CSV.')
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
    const pkSet = new Set(crudPrimaryKeyColumnNames(this.table))

    return this.cols().map((column) => {
      var data: Attribute = {
        name: column,
        type: this.table[column].columnType,
        default: this.table[column].default,
        required: this.table[column].notNull,
        unique: this.table[column].unique,
        primaryKey: pkSet.has(column) || Boolean(this.table[column].primaryKey),
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
    const columns = this.filteredAttributes().map((attribute) => this.mapColumns(attribute))

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(columns))
  }

  private mapColumns(attribute: Attribute) {
    const type = attribute.type
    const orderable = crudColumnSupportsDataTablesOrder(type)
    const searchable = crudColumnSupportsDataTablesSearch(type)
    const renderer = crudResolveColumnRenderer(attribute, this.columnRenderers)

    var blob = {
      name: attribute.name,
      title: attribute.name,
      data: attribute.name,
      orderable,
      searchable,
      type,
      isPrimaryKey: attribute.primaryKey,
      ...(renderer ? { renderer } : {}),
    }

    return blob
  }

  /** Field metadata + values for the show template (same renderers as list /columns). */
  private crudShowFieldRows(record: Record<string, unknown>) {
    return this.filteredAttributes().map((attribute) => {
      const meta = this.mapColumns(attribute)
      return {
        name: meta.name,
        type: meta.type,
        isPrimaryKey: meta.isPrimaryKey,
        renderer: 'renderer' in meta ? (meta.renderer as CrudColumnRenderer) : undefined,
        value: record[meta.name] ?? null,
      }
    })
  }

  private reportSuccess(res: ServerResponse, message: string, redirect: string) {
    if (res.writableEnded) return
    const html = this.website.getContentHtml(
      'message',
      this.wrapperTemplate,
    )(this.pageData({
      state: 'Success',
      message,
      redirect,
    }))
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
    )(this.pageData({
      state: 'Error',
      message: this.crudHumanReadableError(error),
      redirect: `/${this.name}`,
    }))
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
    try {
      const compiled = website.getContentHtml(content_template, wrapper_template)
      const html = compiled({ content: content_template, wrapper: wrapper_template, ...data })
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
    } catch (error) {
      website.renderError(res, error as Error, {
        template: content_template,
        route: requestInfo.pathname,
      })
    }
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
    fs.promises
      .readFile(path.join(website.rootPath, 'src', filename), 'utf8')
      .then((content) => {
        try {
          website.handlebars.registerPartial('content', marked.parse(content, { async: false }))
          const templateFile = website.handlebars.partials[wrapper_template] ?? ''
          const compiled = website.handlebars.compile(templateFile)
          const html = compiled(data)
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(html)
        } catch (error) {
          website.renderError(res, error as Error, {
            template: filename,
            route: requestInfo.pathname,
          })
        }
      })
      .catch((error) => {
        website.renderError(res, error as Error, {
          template: filename,
          route: requestInfo.pathname,
        })
      })
  }
}

export {
  ThaliaImageUploader,
  readLimitedJsonObject,
  type ImageUploaderAdapterName,
  type ThaliaImageUploaderLocalDiskOptions,
  type ThaliaImageUploaderOptions,
} from './images/image-uploader.js'
export { parseForm, type ParsedForm } from './util.js'
