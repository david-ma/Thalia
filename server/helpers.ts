// Calling this file helpers.ts because util is reserved
import { ModelStatic, Op, DataTypes, Sequelize } from 'sequelize'

import { Thalia } from './thalia'
export { Thalia }

const path = require('path')
import { Views, loadMustacheTemplate } from './requestHandlers'

import formidable = require('formidable')

export type SecurityMiddleware = (
  controller: Thalia.Controller,
  success: ([views, user]: [Views, User]) => void,
  failure?: () => void
) => Promise<void>

export function showWebpage(
  name: string,
  options?: {
    wrapper?: string
    variables?: object
  }
) {
  options = options || {}
  return function (router: Thalia.Controller) {
    router.readAllViews((views) => {
      const wrapper = options.wrapper || name
      const template = router.handlebars.compile(views[wrapper])
      loadViewsAsPartials(views, router.handlebars)
      setHandlebarsContent(views[name], router.handlebars).then(() => {
        try {
          const html = template(options.variables || {})
          router.res.end(html)
        } catch (error) {
          console.log('Error loading content', error)
          router.response.writeHead(500, { 'Content-Type': 'text/plain' })
          router.response.end('Error loading webpage: ' + error.message)
        }
      })
    })
  }
}

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
      const Handlebars = controller.handlebars
      const hideColumns = [...options.hideColumns, 'createdAt', 'deletedAt']

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
          case 'update': // receive an update POST
            parseForm(controller).then(function ([fields, files]) {
              table
                .update(fields, {
                  where: {
                    [primaryKey]: controller.path[1],
                  },
                })
                .then(
                  (result) => {
                    // Go to show page

                    controller.res.end(
                      `<script>window.location = '/${options.tableName.toLowerCase()}/${
                        controller.path[1]
                      }'</script>`
                    )

                    // controller.res.end('Updated')
                  },
                  (e) => {
                    console.log('Error updating item', e)
                    controller.res.end('Error updating item')
                  }
                )
            })
            break
          case 'edit': // Edit page
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
              if (views[`${options.tableName.toLowerCase()}Edit`]) {
                Handlebars.registerPartial(
                  'content',
                  views[`${options.tableName.toLowerCase()}Edit`]
                )
              } else {
                Handlebars.registerPartial('content', views.edit)
              }

              loadViewsAsPartials(views, Handlebars)

              table
                .findOne({
                  where: {
                    [primaryKey]: controller.path[1],
                  },
                })
                .then(
                  (item) => {
                    if (!item) {
                      controller.res.end('Item not found')
                      return
                    }
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
                      id: controller.path[1],
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
            break
          case 'delete':
            table
              .destroy({
                where: {
                  [primaryKey]: controller.path[1],
                },
              })
              .then(
                (result) => {
                  controller.res.end(
                    `<script>window.location = '/${options.tableName.toLowerCase()}'</script>`
                  )
                },
                (e) => {
                  console.log('Error deleting item', e)
                  controller.res.end('Error deleting item')
                }
              )

            break
          case 'create': // Create action
            parseForm(controller).then(function ([fields, files]) {
              // Make sure fields are not completely empty
              if (!Object.keys(fields).length) {
                controller.res.end('Error, No fields')
                return
              }

              table
                .create(fields)
                .then(
                  (result) => {
                    // Go to show page
                    controller.res.end(
                      `<script>window.location = '/${options.tableName.toLowerCase()}/${
                        result.dataValues[primaryKey]
                      }'</script>`
                    )
                  },
                  (e) => {
                    console.log('Error creating item', e)
                    controller.res.end('Error creating item')
                  }
                )
                .catch((e) => {
                  console.log('Error creating item', e)
                  controller.res.end('Error creating item')
                })
            })

            break
          case 'new': // Create page
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

              if (views[`${options.tableName.toLowerCase()}Create`]) {
                Handlebars.registerPartial(
                  'content',
                  views[`${options.tableName.toLowerCase()}Create`]
                )
              } else {
                Handlebars.registerPartial('content', views.create)
              }

              loadViewsAsPartials(views, Handlebars)

              // These attributes are not user-editable
              const filteredAttributes = [
                'id',
                'createdAt',
                'updatedAt',
                'deletedAt',
                ...hideColumns,
              ]

              const data = {
                title: options.tableName,
                controllerName: options.tableName.toLowerCase(),
                fields: Object.keys(table.getAttributes()).filter(
                  (key) => !filteredAttributes.includes(key)
                ),
              }

              const html = template(data)
              controller.res.end(html)
            })
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
              .then(
                ([views, loadedTemplate]) => {
                  const template = Handlebars.compile(loadedTemplate.content)
                  Handlebars.registerPartial('scripts', loadedTemplate.scripts)
                  Handlebars.registerPartial('styles', loadedTemplate.styles)

                  if (views[`${options.tableName.toLowerCase()}List`]) {
                    Handlebars.registerPartial(
                      'content',
                      views[`${options.tableName.toLowerCase()}List`]
                    )
                  } else {
                    Handlebars.registerPartial('content', views.list)
                  }

                  loadViewsAsPartials(views, Handlebars)

                  const attributes = table.getAttributes()

                  const primaryKey = Object.keys(attributes).filter((key) => {
                    return attributes[key].primaryKey
                  })

                  // This could probably be cleaner...
                  // Get the other tables that this table references?
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
                },
                (e) => {
                  console.log('Error rendering template??', e)
                  controller.res.end('Error rendering template')
                }
              )
              .catch((e) => {
                console.log('Error rendering template', e)
                controller.res.end('Error rendering template')
              })
            break
          // case 'delete':
          //   break
          case 'read':
          case 'show':
          default: // Show/Read page
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
              Handlebars.registerPartial('content', views.show)
              loadViewsAsPartials(views, Handlebars)

              table
                .findOne({
                  where: {
                    [primaryKey]: controller.path[0],
                  },
                })
                .then(
                  (item) => {
                    if (!item) {
                      controller.res.end('Item not found')
                      return
                    }
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
                      id: controller.path[0],
                      title: options.tableName,
                      controllerName: options.tableName.toLowerCase(),
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
  success: ([views, user]: [Views, any]) => void,
  failure?: () => void
) {
  success([{}, null])
  // success([null, null])
}

// import sass = require('sass')
const sass = require('sass')

// Should we have a single function to:
// Compile wrapper, load content and partials? All in one?
// function servePage(controller: Thalia.Controller, page: string, data?: object) {
//   controller.readAllViews(function (views) {
//     const template = controller.handlebars.compile(views[page])
//     const html = template(data || {})
//     controller.res.end(html)
//   })

//   const Handlebars = controller.handlebars
//   const template = Handlebars.compile(views.wrapper)
//   Handlebars.registerPartial('content', views.content)
//   const html = template({})
//   controller.res.end(html)
// }

// TODO: Handlebars validator.
// So we don't get errors and crash when we try to render a template with missing partials.
// Check Handlebars utility functions
// https://handlebarsjs.com/api-reference/utilities.html

export async function setHandlebarsContent(content: string, Handlebars) {
  const scriptEx = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/g
  const styleEx = /<style\b.*>([^<]*(?:(?!<\/style>)<[^<]*)*)<\/style>/g

  const scripts = [...content.matchAll(scriptEx)].map((d) => d[0])
  const styles = [...content.matchAll(styleEx)].map((d) => d[0])

  let styleData = styles.join('\n').replace(/<\/?style>/g, '')

  return sass.compileStringAsync(styleData).then(
    (result) => {
      styleData = result.css
      Handlebars.registerPartial('styles', `<style>${styleData}</style>`)
      Handlebars.registerPartial('scripts', scripts.join('\n'))
      Handlebars.registerPartial(
        'content',
        content.replace(scriptEx, '').replace(styleEx, '')
      )
    },
    () => {
      console.log('Error processing SASS!')
      Handlebars.registerPartial('styles', '')
      Handlebars.registerPartial('scripts', '')
      Handlebars.registerPartial('content', content)
    }
  )
}

export function loadViewsAsPartials(views: Views, Handlebars) {
  Object.entries(views).forEach(([key, value]) => {
    // console.log(`Loading partial ${key}`)
    Handlebars.registerPartial(key, value)
  })

  /**
   * Helper to get the value of a field from the blob or the root
   * Prioritises the root
   */
  Handlebars.registerHelper('getValue', function (field, options) {
    if (!options || !options.data || !options.data.root) {
      return ''
    }
    if (options.data.root[field]) {
      return options.data.root[field]
    }
    if (!options.data.root.blob) {
      return ''
    }
    return options.data.root.blob[field] || ''
  })

  /**
   * For the dropdown partial
   * Might be useful for radio buttons or checkboxes too
   */
  Handlebars.registerHelper('isSelected', function (field, value, options) {
    if (!options || !options.data || !options.data.root) {
      return ''
    }
    if (options.data.root[field] === value) {
      return 'selected'
    }
    if (options.data.root.blob && options.data.root.blob[field] === value) {
      return 'selected'
    }
    return ''
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
    .filter(([key, value]: any) => !hideColumns.includes(key))
    .map(mapColumns)

  controller.res.end(JSON.stringify(data))
}

function mapColumns([key, value]: any) {
  const type = SequelizeDataTableTypes[value.type.key]
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

type SeqObject = {
  sequelize: Sequelize
} & Omit<
  {
    [key: string]: ModelStatic<any>
  },
  'sequelize'
>
type seqObject = SeqObject

// Security stuff. Maybe put in another file..?
import { User, Session, Audit } from '../websites/example/models/security'
export {
  Album,
  Image,
  AlbumStatic,
  ImageStatic,
} from '../websites/example/models/smugmug'

import { securityFactory, smugmugFactory } from '../websites/example/models'
export { securityFactory, smugmugFactory, SeqObject, seqObject }

export async function createSession(
  userId: number,
  // controller: any, // Thalia.controller?
  controller: Thalia.Controller,
  noCookie?: boolean
) {
  const token = Math.random().toString(36).substring(2, 15)
  const data = controller.req
    ? {
        'x-forwarded-for': controller.req.headers['x-forwarded-for'],
        'x-real-ip': controller.req.headers['x-real-ip'],
        remoteAddress: controller.req.connection.remoteAddress,
        ip: controller.ip,
        userAgent: controller.req.headers['user-agent'],
      }
    : {}

  return controller.db.Session.create({
    sid: token,
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    data: data,
    loggedOut: false,
    userId,
  }).then((session: any) => {
    if (!noCookie) {
      const name = controller.name || 'thalia'
      controller.res.setCookie({ [`_${name}_login`]: token }, session.expires)
    }
    return session
  })
}

const nodemailer = require('nodemailer')

function sendEmail(emailOptions: EmailOptions, mailAuth) {
  console.log(`Sending email to ${emailOptions.to}`)

  const transporter = nodemailer.createTransport({
    pool: true,
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // use TLS
    auth: mailAuth,
    tls: { rejectUnauthorized: false },
  })

  transporter.verify(function (error) {
    if (error) {
      console.log('Nodemailer error')
      console.log(error)
    } else {
      console.log('Nodemailer: Server is ready to take our messages')
    }
  })

  transporter.sendMail(emailOptions, function (error, info) {
    if (error) {
      console.log(error)
    } else {
      console.log('Email sent: ' + info.response)
    }
  })
}

type emailNewAccountConfig = {
  email: string
  controller: Thalia.Controller
  mailAuth: {}
}

type EmailOptions = {
  from: string
  to: string
  subject: string
  html: string
}

export function checkEmail(controller: Thalia.Controller) {
  controller.readAllViews(function (views) {
    const template = controller.handlebars.compile(views.invite)
    const html = template({})
    controller.res.end(html)
  })
}

export async function emailNewAccount(config: emailNewAccountConfig) {
  // Check we can send emails.

  // Check if user exists
  // If not, create user
  // Create session
  // Send invite email
  const password = Math.random().toString(36).substring(2, 15)

  const User: any = config.controller.db.User

  return User.findOrCreate({
    where: {
      email: config.email,
    },
    defaults: {
      email: config.email,
      password,
    },
  }).then(([user, created]) => {
    return createSession(user.id, config.controller, true).then(
      (session: Session) => {
        // TODO: Find an elegant way to pass this info in
        let message = `You're invited to be an admin of Sabbatical Gallery.<br><a href="https://sabbatical.gallery/profile?session=${session.sid}">Click here set up your account</a>.<br>Then visit <a href="https://sabbatical.gallery/m">https://sabbatical.gallery/m</a> to manage the gallery.`

        if (!created) {
          message = `Here is a new login link for Sabbatical Gallery.<br><a href="https://sabbatical.gallery/profile?session=${session.sid}">Click here to log in</a>.`
        }

        const emailOptions: any = {
          from: '"Sabbatical Gallery" <7oclockco@gmail.com>',
          to: config.email,
          subject: 'Your Sabbatical Gallery admin invite',
          html: message,
        }

        sendEmail(emailOptions, config.mailAuth)
      }
    )
  })
}

export const checkSession: SecurityMiddleware = async function (
  controller: Thalia.Controller,
  success: ([views, user]: [Views, User]) => void,
  naive?: () => void
) {
  const name = controller.name || 'thalia'

  const cookies = controller.cookies || {}
  let login_token = cookies[`_${name}_login`] || null
  const query = controller.query

  if (query && query.session) {
    controller.res.setCookie(
      { [`_${name}_login`]: query.session },
      new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
    )
    login_token = query.session
  } else if (!login_token) {
    if (naive) {
      return naive()
    } else {
      controller.res.end(
        `<script>window.location = '/login?redirect=${controller.req.url}'</script>`
      )
      return
    }
  }

  try {
    return Promise.all([
      new Promise(controller.readAllViews).then(
        (views: Views) => {
          loadViewsAsPartials(views, controller.handlebars)
          return views
        },
        (err) => {
          console.log('Error loading views', err)
          return Promise.reject('Error loading views')
        }
      ),
      controller.db.Session.findOne({
        where: {
          sid: login_token,
        },
      }).then((session: Session) =>
        session
          ? controller.db.User.findOne({
              where: {
                id: session.userId,
              },
            })
          : Promise.reject('No session found. Please log in.')
      ),
    ]).then(
      function ([views, user]) {
        if (user.locked) {
          controller.res.end('Your account is locked. Please contact an admin.')
          return
        }
        success([views, user])
      },
      function (err) {
        // No session found
        console.log('ERROR!', err)
        // Send the user to the logout page
        // So they logout
        // And then they get sent to the login page again
        controller.res.end(
          '<meta http-equiv="refresh" content="0; url=/logout">'
        )
      }
    )
  } catch (error) {
    console.log('Error checking session', error)
    return Promise.reject('Error checking session')
  }
}

export type SecurityOptions = {
  websiteName: string
  mailFrom?: string
  mailAuth: {
    user: string
    pass: string
  }
}

/**
 * This is a user factory
 * It gives you a bunch of functions to manage users
 */
export function users(options: SecurityOptions) {
  return {
    profile: function (controller: Thalia.Controller) {
      checkSession(controller, function ([views, user]) {
        const filter = ['id', 'role', 'createdAt', 'updatedAt']
        const data: any = {
          user: Object.entries(user.dataValues).reduce((obj, [key, value]) => {
            if (!filter.includes(key)) {
              obj[key] = value
            }
            return obj
          }, {}),
          unverified: !user.verified,
          admin: user.role === 'admin',
        }
        user.getSessions().then((sessions: Session[]) => {
          data.sessions = sessions.map((session) => {
            return {
              sid: session.sid,
              expires: session.expires,
              data: JSON.stringify(session.data),
            }
          })
          servePage(controller, 'profile', data)
        })
      })
      return
    },
    login: function (controller: Thalia.Controller) {
      checkSession(
        controller,
        function ([Views, User]) {
          // Already logged in?
          // Redirect to profile?
          // controller.res.end('Already logged in')
          controller.res.end(
            '<meta http-equiv="refresh" content="0; url=/profile">'
          )
        },
        function () {
          servePage(controller, 'login')
        }
      )
    },
    logon: function (controller: Thalia.Controller) {
      // Receive login form as a POST
      // Check credentials
      // Create session
      // Redirect to profile

      parseForm(controller).then(function ([fields, files]) {
        if (!fields || !fields.Email || !fields.Password) {
          controller.res.end(
            '<meta http- equiv="refresh" content="0; url=/login">'
          )
          return
        }

        const Email = fields.Email
        const Password = fields.Password
        const Redirect = fields.Redirect || '/profile'

        controller.db.User.findOne({
          where: {
            email: Email,
            // password: Password,
          },
        }).then((user: any) => {
          if (!user) {
            controller.res.end('Invalid login, user not found')
            return
          } else if (Password !== user.password) {
            controller.res.end('Invalid login, password incorrect')
            return
          } else {
            createSession(user.id, controller).then((session: any) => {
              // controller.res.end('successfully logged in')
              controller.res.end(
                `<meta http-equiv="refresh" content="0; url=${Redirect}">`
              )
              return
            })
          }
        })
      })
    },
    logout: function (controller: Thalia.Controller) {
      const name = controller.name || 'thalia'
      controller.res.setCookie({ [`_${name}_login`]: '' }, new Date(0))
      checkSession(controller, function ([views, user]) {
        user.logout(controller.cookies[`_${name}_login`])
        controller.res.end(
          '<meta http-equiv="refresh" content="0; url=/login">'
        )
        return
      })
    },
    forgotPassword: function (controller: Thalia.Controller) {
      checkSession(
        controller,
        function ([views, user]) {
          controller.res.end(
            '<meta http-equiv="refresh" content="0; url=/profile">'
          )
        },
        function () {
          servePage(controller, 'forgotPassword')
        }
      )
    },
    recoverAccount: function (controller: Thalia.Controller) {
      console.log('Someone is trying to recoverAccount')

      // We should log this attempt
      var blah = controller.db.Audit.create({
        action: 'recoverAccount',
        ip: controller.ip,
        data: controller.req.headers,
      })

      // If account recovery is requested too many times, reject it
      controller.db.Audit.count({
        where: {
          action: 'recoverAccount',
          ip: controller.ip,
          createdAt: {
            [Op.gt]: new Date(Date.now() - 1000 * 60 * 60), // 1 hour
          },
        },
      }).then((count) => {
        if (count > 5) {
          controller.res.end('Too many account recovery attempts')
          return
        } else {
          parseForm(controller).then(function ([fields, files]) {
            if (!fields || !fields.Email) {
              controller.res.end(
                '<meta http-equiv="refresh" content="0; url=/forgotPassword">'
              )
              return
            }

            const Email = fields.Email

            controller.db.User.findOne({
              where: {
                email: Email,
              },
            }).then((user: any) => {
              if (!user) {
                controller.res.end('User with this email not found')
                return
              } else {
                createSession(user.id, controller).then((session: any) => {
                  // Send the user an email with the new password
                  const emailOptions: EmailOptions = {
                    from: options.mailFrom,
                    to: Email,
                    subject: `Account Recovery for ${options.websiteName}`,
                    html: `Hi ${user.name},<br>This is an account recovery email. If you have forgotten your password, you can log in using this link: <a href="https://${controller.req.headers.host}/profile?session=${session.sid}">Log in</a> and then reset your password<br>If you did not request this email, please ignore it.`,
                  }
                  sendEmail(emailOptions, options.mailAuth)
                  controller.res.end(
                    'Recovery email sent, please check your email'
                  )
                })
              }
            })
          })
        }
      })
    },
    newUser: function (controller: Thalia.Controller) {
      checkSession(
        controller,
        function ([views, user]) {
          // user is already logged in. Redirect to profile?
          controller.res.end('You already have an account.')
        },
        function () {
          servePage(controller, 'newUser')
        }
      )
    },
    createNewUser: function (controller: Thalia.Controller) {
      parseForm(controller).then(function ([fields, files]) {
        if (!fields || !fields.Email || !fields.Password || !fields.Captcha) {
          controller.res.end(
            '<meta http-equiv="refresh" content="0; url=/newUser">'
          )
          return
        }

        const Name = fields.Name
        const Email = fields.Email
        const Password = fields.Password

        controller.db.User.findOrCreate({
          where: {
            email: Email,
          },
          defaults: {
            name: Name,
            email: Email,
            password: Password,
          },
        }).then(([user, created]) => {
          if (!created) {
            controller.res.end('User with this email already exists')
            return
          } else {
            controller.readAllViews(function (views) {
              createSession(user.id, controller).then((session: any) => {
                loadViewsAsPartials(views, controller.handlebars)
                const template = controller.handlebars.compile(
                  views.newUserEmail
                )
                const data = {
                  websiteName: options.websiteName,
                  websiteURL: controller.req.headers.host,
                  session,
                }

                const emailOptions: EmailOptions = {
                  from:
                    options.mailFrom || '"7oclock Co" <7oclockco@gmail.com>',
                  to: Email,
                  subject: `New account for ${options.websiteName} created`,
                  html: template(data),
                }

                sendEmail(emailOptions, options.mailAuth)

                controller.res.end(
                  `<meta http-equiv="refresh" content="0; url=/profile">`
                )
                return
              })
            })
          }
        })
      })
    },
    verifyEmail: function (controller: Thalia.Controller) {
      const query = controller.query
      console.log('query', query)

      if (query && query.session) {
        controller.db.Session.findOne({
          where: {
            sid: query.session,
          },
        }).then((session: Session) => {
          if (session) {
            controller.db.User.update(
              { verified: true },
              { where: { id: session.userId } }
            ).then(() => {
              controller.res.end('Email verified')
            })
          } else {
            controller.res.end('Email not verified. No session found.')
          }
        })
      } else {
        checkSession(controller, function ([views, user]) {
          const name = controller.name || 'thalia'
          const emailOptions: EmailOptions = {
            from: options.mailFrom,
            to: user.email,
            subject: `Verify Email`,
            html: `Hi ${
              user.name
            },<br>Please verify your email address by clicking this link: <a href="https://${
              controller.req.headers.host
            }/verifyEmail?session=${
              controller.cookies[`_${name}_login`]
            }">Verify Email</a>`,
          }

          sendEmail(emailOptions, options.mailAuth)
          controller.res.end(
            'Verification email sent, please check your email.'
          )
        })
      }
    },
    invite: function (controller: Thalia.Controller) {
      checkSession(controller, function ([views, user]) {
        if (user.role !== 'admin') {
          controller.res.end('You are not an admin')
          return
        }

        parseForm(controller).then(function ([fields, files]) {
          console.log('fields', fields)
          console.log('files', files)

          controller.res.end('You are logged in: ' + JSON.stringify(user))
        })

        return
      })
    },
  }
}

function servePage(controller: Thalia.Controller, page: string, data?: object) {
  controller.readAllViews(function (views) {
    loadViewsAsPartials(views, controller.handlebars)
    const template = controller.handlebars.compile(views.wrapper)
    setHandlebarsContent(views[page], controller.handlebars).then(() => {
      const html = template(data || {})
      controller.res.end(html)
    })
  })
}

function parseForm(controller): Promise<
  [
    {
      [key: string]: string
    },
    formidable.Files<string>
  ]
> {
  return new Promise((resolve, reject) => {
    const form = new formidable.Formidable()
    form.parse(controller.req, (err, fields, files) => {
      if (err) {
        console.error('Error', err)
        reject(err)
        return
      }

      resolve([parseFields(fields), files])
    })
  })
}

// I don't know why Formidable needs us to parse the fields like this
function parseFields(fields: { [key: string]: string[] }): {
  [key: string]: string
} {
  return Object.entries(fields).reduce((obj, [key, value]) => {
    obj[key] = value[0]
    return obj
  }, {})
}

export default { crud }
export { crud, Views, Session, User, Audit }

// https://gist.github.com/elvuel/2348206#file-oauth-rb-L5
// '-._~0-9A-Za-z' # These are the only characters that should not be encoded.
const oauthDictionary = {
  '\\!': '%21',
  '\\*': '%2A',
  "'": '%27',
  '\\(': '%28',
  '\\)': '%29',
  ',': '%2C',
  ':': '%3A',
  ';': '%3B',
  '@': '%40',
  '\\$': '%24',
  '\\/': '%2F',
  '\\+': '%2B',
}

export function oauthEscape(string: string) {
  if (string === undefined) {
    return ''
  }
  if ((string as any) instanceof Array) {
    throw 'Array passed to _oauthEscape'
  }
  return encodeURIComponent(string).replace(
    new RegExp(Object.keys(oauthDictionary).join('|'), 'g'),
    function (match) {
      return oauthDictionary[match] || oauthDictionary[`\\${match}`]
    }
  )
}

const htmlDictionary = {
  '&': '&amp;',
  ';': '&semi;',
  '<': '&lt;',
  '>': '&gt;',
  '!': '&excl;',
  '=': '&equals;',
  '#': '&num;',
  '%': '&percnt;',
  '\\(': '&lpar;',
  '\\)': '&rpar;',
  '\\*': '&ast;',
  '\\+': '&plus;',
  ',': '&comma;',
  '\\.': '&period;',
  '@': '&commat;',
  '\\[': '&lsqb;',
  '\\': '&bsol;',
  '\\]': '&rsqb;',
  '\\^': '&Hat;',
  '{': '&lcub;',
  '\\|': '&verbar;',
  '}': '&rcub;',
  '~': '&tilde;',
  "'": '&apos;',
  '"': '&quot;',
  '`': '&grave;',
  '’': '&rsquo;',
  '‘': '&lsquo;',
  '“': '&ldquo;',
  '”': '&rdquo;',
  '–': '&ndash;',
  '—': '&mdash;',
  '…': '&hellip;',
  '©': '&copy;',
  '®': '&reg;',
  '™': '&trade;',
  '°': '&deg;',
  µ: '&micro;',
  '½': '&frac12;',
  '¼': '&frac14;',
  '¾': '&frac34;',
}

export function htmlEscape(string: string) {
  if (string === undefined) {
    return ''
  }
  if ((string as any) instanceof Array) {
    throw 'Array passed to escapeHtml'
  }
  return string.replace(
    new RegExp(Object.keys(htmlDictionary).join('|'), 'g'),
    function (match) {
      return htmlDictionary[match] || htmlDictionary[`\\${match}`]
    }
  )
}

import Handlebars = require('handlebars')
export function sortParams(object: object) {
  const keys = Object.keys(object).sort()
  const result = {}
  keys.forEach(function (key) {
    let value = object[key]
    if (typeof value === 'string') {
      // value = htmlEscape(value)
      console.log('Using Handlebars to escape the expression')
      value = Handlebars.escapeExpression(value)
    }
    result[key] = value
  })
  // console.log(result)
  return result
}
