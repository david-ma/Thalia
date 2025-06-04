import { IncomingMessage, ServerResponse } from 'http'
import { socketInit } from './socket'
import { Thalia } from './thalia'

// server.ts
import http = require('http')
import url = require('url')
import httpProxy = require('http-proxy')
// import httpsProxy = require('https-proxy-agent')

import { Server as SocketIoServer } from 'socket.io'
const socketIO = new SocketIoServer({
  /* options */
})

import formidable = require('formidable')

let blacklist: string[] = []
try {
  blacklist = require('../blacklist').blacklist
  // console.log('This is the blacklist:', blacklist)
} catch (e) {}

// This part of the server starts the server on port 80 and logs stuff to the std.out
function start(router: Thalia.Router, handle: Thalia.Handle, port: string) {
  let server = null

  function onRequest(request: IncomingMessage, response: ServerResponse) {
    const host: string = (request.headers['x-host'] as string) || request.headers.host

    const ip =
      request.headers['X-Real-IP'] ||
      request.headers['x-real-ip'] ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress

    if (!ip || !host || blacklist.some((thing) => ip.includes(thing))) {
      // console.debug('Blocked request from:', ip, 'to', host)

      response.writeHead(403)
      response.end('Go away')
      return
    }

    // let port = host.split(":")[1] ? parseInt(host.split(":")[1]) : 80
    const hostname = host.split(':')[0]

    const site = handle.getWebsite(hostname)
    const urlObject: url.UrlWithParsedQuery = url.parse(request.url, true)

    const proxies: Thalia.Proxies = handle.proxies[hostname]
    const filterWord = url.parse(request.url).pathname.split('/')[1]
    const proxy: Thalia.Proxy = proxies ? proxies[filterWord] || proxies['*'] || null : null

    if (proxy) {
      if (!proxy.silent) log()
      webProxy(proxy)
    } else {
      log()
      router(site, urlObject.pathname, response, request)
    }

    function log() {
      console.log()
      console.log(`Request for ${host}${urlObject.href} At ${getDateTime()} From ${ip}`)
    }

    function webProxy(config: Thalia.Proxy) {
      console.log('Proxy found, trying to proxy', config)

      if (config.password) {
        const cookies: Cookies = getCookies(request)
        if (cookies[`password${config.filter || ''}`] !== encode(config.password)) {
          loginPage(config.password, config.filter)
          return
        }

        if (config.host === '127.0.0.1' && config.port === 80 && !config.filter) {
          log()
          router(site, urlObject.pathname, response, request)
          return
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

    function loginPage(password: string, filter: string) {
      if (request.url.indexOf('login') >= 0) {
        const form = new formidable.IncomingForm()
        form.parse(request, (err: any, fields: any) => {
          console.log('Fields is:', fields)
          if ((fields.password && fields.password === password) || fields.password[0] === password) {
            const encodedPassword = encode(password)
            response.setHeader('Set-Cookie', [
              `password${filter || ''}=${encodedPassword};path=/;max-age=${24 * 60 * 60}`,
            ])
            const url = `//${host}/${filter || ''}`

            response.writeHead(303, { 'Content-Type': 'text/html' })
            response.end(
              `<html><head><meta http-equiv="refresh" content="0;url='${url}'"></head>
<body>Login Successful, redirecting to: <a href='${url}'>${url}</a></body></html>`
            )
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

  server.on('error', function (e: any) {
    console.log('Server error', e)
  })

  server.on('upgrade', function (request: any, socket: any, head: any) {
    'use strict'

    let host: string = (request.headers['x-host'] as string) || request.headers.host
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

      // HTTP Proxy options
      // https://github.com/http-party/node-http-proxy/blob/HEAD/lib/http-proxy.js#L26-L42
      const proxyServer = httpProxy.createProxyServer({
        ws: true,
        target: {
          host: proxyConfig && proxyConfig.host ? proxyConfig.host : '127.0.0.1',
          port: proxyConfig && proxyConfig.port ? proxyConfig.port : 80,
        },
      })

      proxyServer.on('error', function (err: any, req: any, res: any) {
        'use strict'
        console.log(err)
        try {
          res.writeHead(500)
          res.end(proxyConfig.message)
        } catch (e) {
          console.log('Error doing upgraded proxy!', e)
        }
      })

      proxyServer.ws(request, socket, head)
    }
  })

  return server
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

type Cookies = {
  [key: string]: string
}

function getCookies(request: IncomingMessage) {
  const cookies: Cookies = {}
  if (request.headers.cookie) {
    request.headers.cookie.split(';').forEach(function (d: any) {
      cookies[d.split('=')[0].trim()] = d.substring(d.split('=')[0].length + 1).trim()
    })
  }
  return cookies
}

const salt = Math.floor(Math.random() * 999)
function encode(string: string) {
  'use strict'
  // const buff = new Buffer(string)
  const buff = Buffer.from(string)
  return buff.toString('base64') + salt
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
