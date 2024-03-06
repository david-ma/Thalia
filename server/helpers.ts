// Calling this file helpers.ts because util is reserved
import { ModelStatic, Op } from 'sequelize'
import { Thalia } from './thalia'
export { Thalia }
import { DataTypes } from 'sequelize'

const fs = require('fs')
const path = require('path')
import { Views, loadMustacheTemplate } from './requestHandlers'

import formidable = require('formidable')

export type SecurityMiddleware = (
  controller: Thalia.Controller,
  success: ([views, user]: [Views, User]) => void,
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
      const Handlebars = controller.handlebars
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
                loadViewsAsPartials(views, Handlebars)

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
              loadViewsAsPartials(views, Handlebars)

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
  success: ([views, user]: [Views, any]) => void,
  failure?: () => void
) {
  success([{}, null])
  // success([null, null])
}

// import sass = require('sass')
const sass = require('sass')

// Should we have a single funciton to:
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

import { Model, Sequelize } from 'sequelize'

interface seqObject {
  [key: string]: typeof Model | Sequelize
  sequelize: Sequelize
}

// Security stuff. Maybe put in another file..?
import { User, Session, Audit } from '../websites/example/models/security'
import { Album, Image } from '../websites/example/models/smugmug'
export { Album, Image }
import { securityFactory, smugmugFactory } from '../websites/example/models'
import { register } from 'module'
export { securityFactory, smugmugFactory, seqObject }

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
        'X-Real-IP': controller.req.headers['X-Real-IP'],
        remoteAddress: controller.req.connection.remoteAddress,
        ip: controller.req.ip,
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

function sendEmail(emailOptions, mailAuth) {
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

  return Promise.all([
    new Promise(controller.readAllViews).then((views: Views) => {
      loadViewsAsPartials(views, controller.handlebars)
      return views
    }),
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
  ]).then(success, function (err) {
    console.log('ERROR!', err)
    // Send the user to the logout page
    // So they logout
    // And then they get sent to the login page again
    controller.res.end('<meta http-equiv="refresh" content="0; url=/logout">')
  })
}

export function users(options: {}) {
  return {
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
    profile: function (controller: Thalia.Controller) {
      checkSession(controller, function ([views, user]) {
        const filter = ['id', 'role', 'createdAt', 'updatedAt']
        const data = {
          user: Object.entries(user.dataValues).reduce((obj, [key, value]) => {
            if (!filter.includes(key)) {
              obj[key] = value
            }
            return obj
          }, {}),
          admin: user.role === 'admin',
        }
        servePage(controller, 'profile', data)
      })
      return
    },
    logout: function (controller: Thalia.Controller) {
      const name = controller.name || 'thalia'
      controller.res.setCookie({ [`_${name}_login`]: '' }, new Date(0))
      controller.res.end('<meta http-equiv="refresh" content="0; url=/login">')
      return
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
            createSession(user.id, controller).then((session: any) => {
              // controller.res.end('successfully logged in')
              controller.res.end(
                `<meta http-equiv="refresh" content="0; url=/profile">`
              )
              return
            })
          }
        })
      })
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

function parseForm(
  controller
): Promise<[formidable.Fields<string>, formidable.Files<string>]> {
  return new Promise((resolve, reject) => {
    const form = new formidable.Formidable()
    form.parse(controller.req, (err, fields, files) => {
      if (err) {
        console.error('Error', err)
        reject(err)
        return
      }
      fields = parseFields(fields)

      resolve([fields, files])
    })
  })
}

// I don't know why Formidable needs us to parse the fields like this
function parseFields(fields: { [key: string]: string[] }) {
  return Object.entries(fields).reduce((obj, [key, value]) => {
    obj[key] = value[0]
    return obj
  }, {})
}

export default { crud }
export { crud, Views, Session, User, Audit }
