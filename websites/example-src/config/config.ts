// Minimal config for example-src website
import path from 'path'
import { IncomingMessage, ServerResponse } from 'http'
import { RawWebsiteConfig } from 'thalia/types'
import { Website } from 'thalia/website'
import { latestData, ThaliaImageUploader } from 'thalia/controllers'

const siteRoot = path.join(import.meta.dirname, '..')

const imageUploader = new ThaliaImageUploader({
  adapter: 'local-disk',
  persistToDatabase: false,
  localDisk: {
    basePath: path.join(siteRoot, 'public', 'uploads'),
    baseUrl: '/uploads',
  },
})

export const config: RawWebsiteConfig = {
  controllers: {
    uploadImage: imageUploader.controller.bind(imageUploader),

    fruit: (res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: any) => {
      const shortname = requestInfo.action
      if (!shortname) {
        res.statusCode = 302
        res.setHeader('Location', '/')
        res.end()
        return
      }
      const html = website.getContentHtml(shortname)({})
      res.end(html)
    },
    api: {
      'create-blog': (res: ServerResponse) => {
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/plain')
        res.setHeader('X-Nested-Controller', 'create-blog')
        res.end('create-blog')
      },
    },
    data: {
      logs: latestData('logs', { type: 'log' }),
    },
  },
}
