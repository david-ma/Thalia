import { IncomingMessage, ServerResponse } from 'http'
import { Thalia } from './thalia'

// router.ts
import fs = require('fs');
import mime = require('mime');
import zlib = require('zlib');

const router : Thalia.Router = function (website :Thalia.Website, pathname :string, response :ServerResponse, request :IncomingMessage) {
  response.setHeader('Access-Control-Allow-Origin', '*')

  const route = new Promise(function (resolve, reject) {
    try {
      const data :Thalia.RouteData = {
        cookies: {},
        words: []
      }

      if (request.headers.cookie) {
        request.headers.cookie.split(';').forEach(function (d) {
          data.cookies[d.split('=')[0].trim()] = d.substring(d.split('=')[0].length + 1).trim()
        })
      }

      data.words = pathname
        .split('/')
      // This should not be lowercase??? Keys are case sensitive!
      // .map(function(d){
      //     return d.toLowerCase();
      // });

      resolve(data)
    } catch (err) {
      console.log(err)
      reject(err)
    }
  })

  /**
     * The router should check what sort of route we're doing, and act appropriately.
     * Check:
     * - Security
     * - Redirects to outside websites
     * - Internal page alias
     * - Services / functions
     * - /data/ folder might have a file
     * - otherwise, we serve the file normally
     *
     * - When serving the file normally, we need to check the header to see if it can be zipped or should be zipped.
     */
  route.then(function (d : Thalia.RouteData) {
    if (typeof website.security !== 'undefined' && website.security.loginNeeded(pathname, d.cookies)) {
      website.services.login(response, request)
    } else {
      // If a page substitution exists, substitute it.
      if (typeof website.pages[d.words[1]] !== 'undefined') {
        pathname = website.pages[d.words[1]]
      }

      // If there's a redirect, go to it
      if (typeof website.redirects[pathname] !== 'undefined') {
        redirect(website.redirects[pathname])

        // if there's a service, use it
      } else if (typeof website.services[d.words[1]] === 'function') {
        website.services[d.words[1]](response, request, website.seq, d.words[2])

        // if there are controllers, call the right one
        // Note, this includes any top level mustache files, since they're loaded as generic, dataless controllers
      } else if (typeof website.controllers[d.words[1]] === 'function') {
        console.log('Hey, we have a controller here...')
        console.log('read all views:', website.readAllViews)
        console.log('read template:', website.readTemplate)

        website.controllers[d.words[1]]({
          res: {
            end: function (result :any) {
              const acceptedEncoding = request.headers['accept-encoding'] || ''
              const input = Buffer.from(result, 'utf8')
              response.setHeader('Content-Type', 'text/html')
              if (acceptedEncoding.indexOf('gzip') >= 0) {
                zlib.gzip(input, function (err :any, result :any) {
                  if (err) {
                    response.writeHead(503)
                    response.end(err)
                  } else {
                    response.writeHead(200, { 'Content-Encoding': 'gzip' })
                    response.end(result)
                  }
                })
              } else if (acceptedEncoding.indexOf('deflate') >= 0) {
                zlib.deflate(input, function (err :any, result :any) {
                  if (err) {
                    response.writeHead(503)
                    response.end(err)
                  } else {
                    response.writeHead(200, { 'Content-Encoding': 'deflate' })
                    response.end(result)
                  }
                })
              } else {
                response.end(result)
              }
            }
          },
          req: request,
          db: website.seq || null,
          views: website.views,
          readAllViews: website.readAllViews,
          readTemplate: website.readTemplate,
          path: d.words.slice(2)
        })

        // if there is a matching data file
      } else if (website.data &&
          fs.existsSync(website.data.concat(pathname)) &&
          fs.lstatSync(website.data.concat(pathname)).isFile()) {
        routeFile(website.data.concat(pathname))

        // if there is a matching .gz file in the data folder
      } else if (website.data &&
                        fs.existsSync(website.data.concat(pathname).concat('.gz'))) {
        response.setHeader('Content-Encoding', 'gzip')
        routeFile(website.data.concat(pathname, '.gz'))

        // if there is a matching compiled file
      } else if ((website.dist &&
                fs.existsSync(website.dist.concat(pathname)) &&
                fs.lstatSync(website.dist.concat(pathname)).isFile()) || (
        website.dist &&
                fs.existsSync(website.dist.concat(pathname, '/index.html')) &&
                fs.lstatSync(website.dist.concat(pathname, '/index.html')).isFile())
      ) {
        routeFile(website.dist.concat(pathname))
      } else {
        // Otherwise, route as normal to the public folder
        routeFile(website.folder.concat(pathname))
      }
    }
  }).catch(renderError)

  function renderError (d :any) {
    console.log('Error?', d)
    d = d
      ? {
          code: 500,
          message: JSON.stringify(d)
        }
      : {
          code: 500,
          message: '500 Server Error'
        }
    response.writeHead(d.code, {
      'Content-Type': 'text/html'
    })
    response.end(d.message)
  }

  function redirect (url :string) {
    if (typeof (url) === 'string') {
      console.log('Forwarding user to: ' + url)
      response.writeHead(303, { 'Content-Type': 'text/html' })
      response.end('<meta http-equiv="refresh" content="0; url=' + url + '">')
    } else {
      console.log('Error, url missing')
      response.writeHead(501, { 'Content-Type': 'text/plain' })
      response.end('501 URL Not Found\n')
    }
  }

  /**
     * Given a filename, serve it.
     *
     * Check that the file exists
     * Check the headers..?
     * zip/unzip if needed
     *
     * @param filename
     */
  function routeFile (filename :string) {
    fs.exists(filename, function (exists :any) {
      if (!exists) {
        console.log('No file found for ' + filename)
        response.writeHead(404, { 'Content-Type': 'text/plain' })
        response.end('404 Page Not Found\n')
        return
      }

      const acceptedEncoding = request.headers['accept-encoding'] || ''
      const filetype = mime.getType(filename)
      response.setHeader('Content-Type', filetype)

      let router = function (file :any) {
        response.writeHead(200)
        response.end(file)
      }

      fs.stat(filename, function (err :any, stats :any) {
        if (err) {
          response.writeHead(503)
          response.end(err)
        } else {
          response.setHeader('Cache-Control', 'no-cache')
          if (website.cache) {
            if (stats.size > 10240) { // cache files bigger than 10kb?
              response.setHeader('Cache-Control', 'public, max-age=31536000') // ex. 1 year in seconds
              response.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString()) // in ms.
            }
          }

          if (filetype && (filetype.slice(0, 4) === 'text' ||
                      filetype === 'application/json' ||
                      filetype === 'application/javascript')) {
            response.setHeader('Content-Type', `${filetype}; charset=UTF-8`)

            router = function (file) {
              if (acceptedEncoding.indexOf('gzip') >= 0) {
                zlib.gzip(file, function (err: any, result: any) {
                  if (err) {
                    response.writeHead(503)
                    response.end(err)
                  } else {
                    response.writeHead(200, { 'content-encoding': 'gzip' })
                    response.end(result)
                  }
                })
              } else if (acceptedEncoding.indexOf('deflate') >= 0) {
                zlib.deflate(file, function (err: any, result: any) {
                  if (err) {
                    response.writeHead(503)
                    response.end(err)
                  } else {
                    response.writeHead(200, { 'content-encoding': 'deflate' })
                    response.end(result)
                  }
                })
              } else {
                response.writeHead(200)
                response.end(file)
              }
            }
          }
        }
      })

      fs.readFile(filename, function (err :any, file :any) {
        if (err) {
          fs.readdir(filename, function (e :any, dir :any) {
            if (!e && dir && dir instanceof Array && dir.indexOf('index.html') >= 0) {
              if (filename.lastIndexOf('/') === filename.length - 1) {
                filename += 'index.html'
              } else {
                if (filename.indexOf('?') !== -1) {
                  filename = filename.split('?')[0] + '/index.html'
                } else {
                  filename += '/index.html'
                }
              }
              // Note we don't have content type, caching, or zipping!!!!
              fs.readFile(filename, (e :any, file :any) => router(file))
            } else {
              let base = request.url.split('?')[0]
              base = base.slice(-1) === '/' ? base : `${base}/`
              const slug = base.split('/').slice(-2).slice(0, 1)[0]

              if (website.viewableFolders
                ? website.viewableFolders instanceof Array
                    ? website.viewableFolders.indexOf(slug) !== -1
                    : true
                : false) {
                const links :any[] = []
                dir.forEach((file :string) => {
                  links.push(`<li><a href="${base + file}">${file}</a></li>`)
                })

                const result = `<h1>Links</h1>
<ul>
${links.join('\n')}
</ul>`
                response.writeHead(200, { 'Content-Type': 'text/html' })
                response.end(result)
              } else {
                console.log('Error 500, content protected? ' + filename)
                response.writeHead(500, { 'Content-Type': 'text/plain' })
                response.end('Error 500, content protected\n' + err)
              }
            }
          })
        } else {
          router(file)
        }
      })
    })
  }
}

// exports.router = router;
// exports.routeFile = routeFile;

export { router }
