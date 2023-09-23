// Calling this file helpers.ts because util is reserved
import { ModelStatic, Op } from 'sequelize'
import { Thalia } from './thalia'
import { DataTypes } from 'sequelize'
// import * from 'handlebars'
// import fs from 'fs'
const Handlebars = require('handlebars')
// import Handlebars from 'handlebars'
// import Handlebars = require('handlebars')

const fs = require('fs')
const path = require('path')
import { Views, loadMustacheTemplate } from './requestHandlers'

//const thaliaPath = path.resolve(global.require.resolve('thalia'), '..', '..')

export type SecurityMiddleware = (
  controller: Thalia.Controller,
  success: ([Views, UserModel]: [any, any]) => void,
  failure?: () => void
) => Promise<void>

/**
 * Scaffold for CRUD operations
 * - Create
 * - Read
 * - Update
 * - Delete
 * - List
 *
 * Also consider:
 * Search, Sort, Filter, Paginate, Validate, Authorize, Audit, Log, Cache, Test, Mock, Deploy, Monitor, Alert, Notify, Backup, Restore, Migrate, Rollback, Upgrade, Downgrade, Seed, Import, Export, Publish, Subscribe, Unsubscribe
 *
 */
function crud(options: {
  tableName: string
  references?: string[]
  hideColumns?: string[]
  security?: SecurityMiddleware
}) {
  const references = options.references || []
  return {
    [options.tableName.toLowerCase()]: function (
      controller: Thalia.Controller
    ) {
      const hideColumns = options.hideColumns || []
      const security = options.security || noSecurity
      security(controller, function ([views, usermodel]) {
        const table: ModelStatic<any> = controller.db[options.tableName]
        const primaryKey = table.primaryKeyAttribute
        const uriPath = controller.path
        // Put some checks here to make sure these are valid
        // Check for security maybe?

        switch (uriPath[0] || '') {
          case 'columns': // Column definitions for DataTables.net
            columnDefinitions(controller, table, hideColumns)
            break
          case 'json': // JSON for DataTables.net list
            dataTableJson(controller, table, hideColumns, references)
            break
          case '': // List
            Promise.all([
              new Promise<Views>(controller.readAllViews),
              loadMustacheTemplate(
                path.join(
                  __dirname,
                  '..',
                  'src',
                  'views',
                  'partials',
                  'wrapper.hbs'
                )
              ),
            ])
              .catch((e) => {
                console.log('Error loading views')
                return Promise.reject(e)
              })
              .then(([views, loadedTemplate]) => {
                const template = Handlebars.compile(loadedTemplate.content)
                Handlebars.registerPartial('scripts', loadedTemplate.scripts)
                Handlebars.registerPartial('styles', loadedTemplate.styles)
                Handlebars.registerPartial('content', views.list)
                loadViewsAsPartials(views)

                const attributes = table.getAttributes()

                const primaryKey = Object.keys(attributes).filter((key) => {
                  return attributes[key].primaryKey
                })

                // This could probably be cleaner...
                const links = references
                  .map((reference) => {
                    const table = controller.db[reference]
                    const name = reference
                    const tableName = table.tableName
                    const attribute = Object.values(attributes).filter(
                      (attribute) => {
                        return (
                          attribute.references &&
                          typeof attribute.references === 'object' &&
                          attribute.references.model === tableName
                        )
                      }
                    )[0]

                    if (attribute) {
                      return JSON.stringify({
                        name,
                        tableName,
                        attribute,
                      })
                    } else {
                      return null
                    }
                  })
                  .filter((link) => link !== null)

                const data = {
                  title: options.tableName,
                  controllerName: options.tableName.toLowerCase(),
                  links,
                  primaryKey,
                }
                const html = template(data)
                controller.res.end(html)
              })
              .catch((e) => {
                console.log('Error rendering template', e)
                controller.res.end('Error rendering template')
              })
            break
          default: // Read page
            Promise.all([
              new Promise<Views>(controller.readAllViews),
              loadMustacheTemplate(
                path.join(
                  __dirname,
                  '..',
                  'src',
                  'views',
                  'partials',
                  'wrapper.hbs'
                )
              ),
            ]).then(([views, loadedTemplate]) => {
              const template = Handlebars.compile(loadedTemplate.content)
              Handlebars.registerPartial('scripts', loadedTemplate.scripts)
              Handlebars.registerPartial('styles', loadedTemplate.styles)
              Handlebars.registerPartial('content', views.read)
              loadViewsAsPartials(views)

              table
                .findOne({
                  where: {
                    [primaryKey]: controller.path[0],
                  },
                })
                .then(
                  (item) => {
                    const values = Object.entries(item.dataValues).reduce(
                      (obj, [key, value]) => {
                        if (!hideColumns.includes(key)) {
                          obj[key] = value
                        }
                        return obj
                      },
                      {}
                    )

                    const data = {
                      title: options.tableName,
                      controller: options.tableName.toLowerCase(),
                      values,
                      json: JSON.stringify(values),
                      attributes: Object.keys(values),
                    }

                    const html = template(data)
                    controller.res.end(html)
                  },
                  (e) => {
                    console.log('Error finding item', e)
                    controller.res.end(`Error finding item: ${uriPath[0]}`)
                  }
                )
            })
        }
      })
    },
  }
}
// SecurityMiddleware
const noSecurity: SecurityMiddleware = async function (
  controller: Thalia.Controller,
  success: ([Views, UserModel]: [any, any]) => void,
  failure?: () => void
) {
  success([{}, {}])
}

function loadViewsAsPartials(views: Views) {
  Object.entries(views).forEach(([key, value]) => {
    // console.log(`Loading partial ${key}`)
    Handlebars.registerPartial(key, value)
  })
}

/**
 * Get column definitions from Sequelize.org database
 * in DataTables.net format
 */
function columnDefinitions(
  controller: Thalia.Controller,
  table,
  hideColumns: string[] = []
) {
  const data = Object.entries(table.getAttributes())
    // .filter(([key, value]: any) => !value.references) // Dunno why I was filtering this out
    .filter(([key, value]: any) => !hideColumns.includes(key))
    .map(mapColumns)

  controller.res.end(JSON.stringify(data))
}

function mapColumns([key, value]: any) {
  const type = SequelizeDataTableTypes[value.type.key]
  const orderable = type === 'string' || type === 'num' || type === 'date'
  const searchable = type === 'string' || type === 'num' || type === 'date'

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

/**
 * Serve Sequelize.org data in DataTables.net format
 */
function dataTableJson(
  controller: Thalia.Controller,
  table: any,
  hideColumns: string[] = [],
  references: string[] = []
) {
  const [order, search] = parseDTquery(controller.query)

  const columns = Object.entries(table.getAttributes())
    .filter(([key, value]: any) => !value.references)
    .filter(([key, value]: any) => !hideColumns.includes(key))
    .map(mapColumns)

  const findOptions = {
    include: references.map((table) => {
      return controller.db[table]
    }),
    offset: controller.query.start || 0,
    limit: controller.query.length || 10,
    order: order.map((item) => {
      return [columns[item.column].data, item.dir.toUpperCase()]
    }),
  }

  if (search.value) {
    findOptions['where'] = {
      [Op.or]: columns
        // Note that we're only searching on Strings here.
        // We should implement searching on other types as well.
        .filter((column) => column.type === 'string')
        .map((column) => {
          return {
            [column.data]: {
              [Op.iLike]: `%${search.value}%`,
            },
          }
        }),
    }
  }

  Promise.all([
    table.findAll(findOptions),
    table.count(),
    table.count(findOptions),
  ]).then(([items, recordsTotal, recordsFiltered]) => {
    const blob = {
      draw: controller.query.draw || 1,
      recordsTotal,
      recordsFiltered,
      data: items.map((item) => item.dataValues),
    }
    controller.res.end(JSON.stringify(blob))
  })
}

type Column = {
  data: string
  name: string
  searchable: boolean
  orderable: boolean
  search: Search
}
type Order = {
  column: number
  dir: string
}
type Search = {
  value: string
  regex: boolean
}

function parseDTquery(queryStrings): [Order[], Search] {
  const columns: Column[] = []
  const order: any[] = []
  const search = {
    value: '',
    regex: false,
  }
  Object.entries(queryStrings).forEach(([key, value]) => {
    if (key.slice(0, 7) === 'columns') {
      const [_, index, column] = key.split(/[\[\]]+/)
      columns[index] = columns[index] || {}
      columns[index][column] = value
    }
    if (key.slice(0, 5) === 'order') {
      const [_, index, column] = key.split(/[\[\]]+/)
      order[index] = order[index] || {}
      order[index][column] = value
    }
    if (key.slice(0, 6) === 'search') {
      const [_, column] = key.split(/[\[\]]+/)
      search[column] = value
    }
  })
  columns.forEach((column) => {
    column.searchable = parseBoolean(column.searchable)
    column.orderable = parseBoolean(column.orderable)
  })
  order.forEach((item) => {
    item.column = parseInt(item.column)
  })
  search.regex = parseBoolean(search.regex)
  return [order, search]
}

function parseBoolean(string) {
  return string === 'true' || string === '1' || string === true
}

const SequelizeDataTableTypes = {
  STRING: 'string',
  TEXT: 'string',
  INTEGER: 'num',
  BIGINT: 'num',
  FLOAT: 'num',
  REAL: 'num',
  DOUBLE: 'num',
  DECIMAL: 'num',
  DATE: 'date',
  DATEONLY: 'date',
  BOOLEAN: 'bool',
  ENUM: 'string',
  ARRAY: 'string',
  JSON: 'object', // 'object',
  JSONB: 'object', // 'object',
  BLOB: 'object', // 'object',
}
// A better way of checking the type?
const checkSequelizeDataTableTypes = function (type) {
  switch (type) {
    case DataTypes.STRING:
      return 'string'
    case DataTypes.TEXT:
      return 'string'
    case DataTypes.INTEGER:
      return 'num'
    case DataTypes.BIGINT:
      return 'num'
    default:
      return 'string'
  }
}

export default { crud }
