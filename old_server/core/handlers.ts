import * as http from 'http'
import * as path from 'path'
import * as fs from 'fs'
import * as httpProxy from 'http-proxy'
import * as formidable from 'formidable'
import * as Handlebars from 'handlebars'
import { Thalia } from './types'
import { Website } from './website'

export class RequestHandlers {
  private readonly proxyServer: httpProxy

  constructor() {
    this.proxyServer = httpProxy.createProxyServer({
      ws: true,
      changeOrigin: true,
      followRedirects: true
    })
  }

  public async handleProxyRequest(
    proxy: Thalia.Proxy,
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    if (proxy.password) {
      const cookies = this.getCookies(req)
      if (cookies[`password${proxy.filter || ''}`] !== this.encode(proxy.password)) {
        await this.handleLoginPage(proxy, req, res)
        return
      }
    }

    const target = `http://${proxy.host || '127.0.0.1'}:${proxy.port || 80}`
    const message = proxy.message || 'Error, server is down.'

    return new Promise((resolve, reject) => {
      this.proxyServer.web(req, res, { target }, (err) => {
        if (err) {
          console.error('Proxy error:', err)
          res.writeHead(500)
          res.end(message)
        }
        resolve()
      })
    })
  }

  public async handleControllerRequest(
    controller: (controller: Thalia.Controller) => Promise<void> | void,
    website: Website,
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const controllerInstance: Thalia.Controller = {
      res: {
        getCookie: (name) => this.getCookies(req)[name] || '',
        setCookie: (cookie, expires) => {
          const cookieStr = Object.entries(cookie)
            .map(([key, value]) => `${key}=${value}`)
            .join('; ')
          res.setHeader('Set-Cookie', cookieStr)
        },
        deleteCookie: (name) => {
          res.setHeader('Set-Cookie', `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`)
        },
        end: (result) => {
          res.end(result)
        }
      },
      req,
      response: res,
      request: req,
      routeFile: (file) => {
        const filePath = path.join(website.rootPath, file)
        if (fs.existsSync(filePath)) {
          res.writeHead(200)
          res.end(fs.readFileSync(filePath))
        } else {
          res.writeHead(404)
          res.end('File not found')
        }
      },
      ip: req.socket.remoteAddress || '',
      db: website.config.seq || null,
      views: {},
      handlebars: Handlebars,
      workspacePath: website.config.workspacePath,
      readAllViews: (callback) => {
        // TODO: Implement view loading
      },
      name: website.name,
      path: req.url,
      query: new URL(req.url || '', `http://${req.headers.host}`).searchParams,
      cookies: this.getCookies(req)
    }

    await controller(controllerInstance)
  }

  public async handleServiceRequest(
    service: Thalia.Service,
    website: Website,
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const url = new URL(req.url || '', `http://${req.headers.host}`)
    const words = url.pathname.split('/').filter(Boolean)
    await service(res, req, website.config.seq || null, words)
  }

  public async handleStaticRequest(
    website: Website,
    pathname: string,
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const publicPath = website.config.folder || path.join(website.rootPath, 'public')
    const filePath = path.join(publicPath, pathname)

    try {
      const stats = await fs.promises.stat(filePath)
      if (stats.isDirectory()) {
        if (website.config.viewableFolders) {
          const files = await fs.promises.readdir(filePath)
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(this.generateDirectoryListing(pathname, files))
        } else {
          res.writeHead(403)
          res.end('Directory listing not allowed')
        }
        return
      }

      const stream = fs.createReadStream(filePath)
      stream.pipe(res)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        res.writeHead(404)
        res.end('File not found')
      } else {
        res.writeHead(500)
        res.end('Internal server error')
      }
    }
  }

  private async handleLoginPage(
    proxy: Thalia.Proxy,
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    if (req.url?.includes('login')) {
      const form = new formidable.IncomingForm()
      const [fields] = await form.parse(req)
      const password = Array.isArray(fields.password) ? fields.password[0] : fields.password
      
      if (password === proxy.password) {
        const encodedPassword = this.encode(proxy.password)
        res.setHeader('Set-Cookie', [
          `password${proxy.filter || ''}=${encodedPassword};path=/;max-age=${24 * 60 * 60}`
        ])
        const url = `//${req.headers.host}/${proxy.filter || ''}`
        res.writeHead(303, { 'Content-Type': 'text/html' })
        res.end(
          `<html><head><meta http-equiv="refresh" content="0;url='${url}'"></head>
<body>Login Successful, redirecting to: <a href='${url}'>${url}</a></body></html>`
        )
      } else {
        res.writeHead(401)
        res.end('Wrong password')
      }
    } else {
      res.writeHead(200)
      if (proxy.filter) {
        res.end(this.simpleLoginPage.replace('/login', `/${proxy.filter}/login`))
      } else {
        res.end(this.simpleLoginPage)
      }
    }
  }

  private getCookies(req: http.IncomingMessage): { [key: string]: string } {
    const cookies: { [key: string]: string } = {}
    if (req.headers.cookie) {
      req.headers.cookie.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=')
        cookies[name] = value
      })
    }
    return cookies
  }

  private encode(string: string): string {
    const salt = Math.floor(Math.random() * 999)
    const buff = Buffer.from(string)
    return buff.toString('base64') + salt
  }

  private generateDirectoryListing(pathname: string, files: string[]): string {
    const html = ['<html><head><title>Directory Listing</title></head><body>']
    html.push(`<h1>Directory Listing for ${pathname}</h1>`)
    html.push('<ul>')
    for (const file of files) {
      html.push(`<li><a href="${path.join(pathname, file)}">${file}</a></li>`)
    }
    html.push('</ul></body></html>')
    return html.join('\n')
  }

  private readonly simpleLoginPage = `<html>
<head>
  <title>Login</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    form { max-width: 300px; margin: 0 auto; }
    input { width: 100%; padding: 8px; margin: 8px 0; }
    button { width: 100%; padding: 8px; background: #4CAF50; color: white; border: none; }
  </style>
</head>
<body>
  <form action="/login" method="post">
    <h2>Login Required</h2>
    <input type="password" name="password" placeholder="Enter password">
    <button type="submit">Login</button>
  </form>
</body>
</html>`
} 