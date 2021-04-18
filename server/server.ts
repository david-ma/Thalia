import { IncomingMessage, ServerResponse } from 'http'
import { socketInit } from './socket'
import { Thalia } from './thalia'

// server.ts
import http = require('http')
import url = require('url')
import httpProxy = require('http-proxy')
import socketIO = require('socket.io')
import formidable = require('formidable')

let blacklist: any = []
try {
  blacklist = require('../blacklist').blacklist
  console.log('This is the blacklist:', blacklist)
} catch (e) {}

// This part of the server starts the server on port 80 and logs stuff to the std.out
function start(router: Thalia.Router, handle: Thalia.Handle, port: string) {
  let server = null

  function onRequest(request: IncomingMessage, response: ServerResponse) {
    let spam = false

    const ip =
      request.headers['X-Real-IP'] ||
      request.headers['x-real-ip'] ||
      request.connection.remoteAddress

    if (ip) {
      blacklist.forEach(function (thing: any) {
        if (ip.includes(thing)) {
          spam = true
          // console.log(`Spam request from ${ip}`);

          response.writeHead(403)
          response.end('Go away')
        }
      })
    }

    if (!spam) {
      let host: string =
        (request.headers['x-host'] as string) || request.headers.host
      // let port = host.split(":")[1] ? parseInt(host.split(":")[1]) : 80
      host = host.split(':')[0]

      let proxyConfig: Thalia.Proxies = handle.proxies[host]

      const site = handle.getWebsite(host)
      const urlObject: url.UrlWithParsedQuery = url.parse(request.url, true)
      let filterWord = url.parse(request.url).pathname.split('/')[1]

      if (
        proxyConfig &&
        (proxyConfig['*'] || (filterWord && proxyConfig[filterWord]))
      ) {
        if (filterWord && proxyConfig[filterWord]) {
          if (!proxyConfig[filterWord].silent) log()
          webProxy(proxyConfig[filterWord])
        } else {
          if (!proxyConfig['*'].silent) log()
          webProxy(proxyConfig['*'])
        }
      } else {
        log()
        router(site, urlObject.pathname, response, request)
      }

      function log() {
        console.log()
        console.log(
          `Request for ${host}${urlObject.href} At ${getDateTime()} From ${ip}`
        )
      }
    }

    function webProxy(config: Thalia.Proxy) {
      if (config.password) {
        let decodedCookiePassword: any = false
        const cookies: any = {}
        if (request.headers.cookie) {
          request.headers.cookie.split(';').forEach(function (d: any) {
            cookies[d.split('=')[0].trim()] = d
              .substring(d.split('=')[0].length + 1)
              .trim()
          })

          decodedCookiePassword = decodeBase64(cookies.password)
        }
        if (decodedCookiePassword === config.password) {
          // console.log("Correct password has been stored in cookies")
        } else {
          loginPage(config.password, config.filter, config)
        }
      }

      const message = config.message || 'Error, server is down.'
      const target = `http://${config.host || '127.0.0.1'}:${config.port || 80}`
      const proxyServer = httpProxy.createProxyServer({
        // preserveHeaderKeyCase: true,
        // autoRewrite: true,
        // followRedirects: true,
        // protocolRewrite: "http",
        // changeOrigin: true,
        target: target,
      })

      proxyServer.on('error', function (err: any, req: any, res: any) {
        'use strict'
        console.log(err)
        try {
          res.writeHead(500)
          res.end(message)
        } catch (e) {
          console.log('Error doing proxy!', e)
        }
      })

      proxyServer.web(request, response)
    }

    function loginPage(password: string, filter: string, config: Thalia.Proxy) {
      if (request.url.indexOf('login') >= 0) {
        const form = new formidable.IncomingForm()
        form.parse(request, (err, fields) => {
          if (fields.password && fields.password === password) {
            const encodedPassword = encodeBase64(password)
            response.setHeader('Set-Cookie', [
              `password=${encodedPassword};path=/;expires=false`,
            ])
          } else {
            response.writeHead(401)
            response.end('Wrong password')
          }
        })
      } else {
        response.writeHead(200)

        if (filter) {
          response.end(simpleLoginPage.replace('/login', `/${filter}/login`))
        } else {
          response.end(simpleLoginPage)
        }
      }
    }
  }

  console.log('Server has started on port: ' + port)
  server = http.createServer(onRequest).listen(port)

  // const io = new socketIO.listen(server, {})
  const io = socketIO.listen(server, {})
  socketInit(io, handle)

  return server.on('upgrade', function (request: any, socket: any, head: any) {
    'use strict'

    let host: string =
      (request.headers['x-host'] as string) || request.headers.host
    // let port = host.split(":")[1] ? parseInt(host.split(":")[1]) : 80
    host = host.split(':')[0]

    const proxies: Thalia.Proxies = handle.proxies[host]
    let filterWord = url.parse(request.url).pathname.split('/')[1]

    if (proxies) {
      let proxyConfig: Thalia.Proxy = null
      if (filterWord) {
        proxyConfig = proxies[filterWord]
      } else {
        proxyConfig = proxies['*']
      }
      httpProxy
        .createProxyServer({
          ws: true,
          target: {
            host: proxyConfig.host || '127.0.0.1',
            port: proxyConfig.port || 80,
          },
        })
        .ws(request, socket, head)
    }
  })
}

// exports.start = start;
export { start }

function getDateTime() {
  //    var date = new Date();
  const date = new Date(Date.now() + 36000000)
  // add 10 hours... such a shitty way to make it australian time...

  let hour: any = date.getHours()
  hour = (hour < 10 ? '0' : '') + hour

  let min: any = date.getMinutes()
  min = (min < 10 ? '0' : '') + min

  const year = date.getFullYear()

  let month: any = date.getMonth() + 1
  month = (month < 10 ? '0' : '') + month

  let day: any = date.getDate()
  day = (day < 10 ? '0' : '') + day

  return year + ':' + month + ':' + day + ' ' + hour + ':' + min
}

function encodeBase64(string: string) {
  'use strict'
  // const buff = new Buffer(string)
  const buff = Buffer.from(string)
  return buff.toString('base64')
}

function decodeBase64(data: any) {
  'use strict'
  if (data) {
    // const buff = new Buffer(data, 'base64')
    const buff = Buffer.from(data, 'base64')
    return buff.toString('ascii')
  } else {
    return false
  }
}

const simpleLoginPage = `<html>
<head>
<title>Login</title>
<style>
div {
    text-align: center;
    width: 300px;
    margin: 200px auto;
    background: lightblue;
    padding: 10px 20px;
    border-radius: 15px;
}
</style>
</head>
<body>
<div>
    <h1>Enter Password</h1>
    <form action="/login" method="post">
        <input type="password" placeholder="Enter Password" name="password" autofocus required>
        <button type="submit">Login</button>
    </form>
</div>
</body>
</html>`
