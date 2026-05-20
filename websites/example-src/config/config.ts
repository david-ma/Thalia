// Minimal config for example-src website
import { IncomingMessage, ServerResponse } from 'http'
import { RawWebsiteConfig } from 'thalia/types'
import { Website } from 'thalia/website'
import { latestData } from 'thalia/controllers'

// import { ThaliaImageUploader } from 'thalia/controllers'
// const imageUploader = new ThaliaImageUploader({
//   adapter: 'local-disk', // or 'uploadthing' | 'smugmug'
//   uploadThingSecret: process.env.UPLOADTHING_SECRET, // only when adapter is uploadthing
//   localDisk: { basePath: 'data/photos', baseUrl: '/data/photos' },
// })
// controllers: { uploadImage: imageUploader.controller.bind(imageUploader) }
// Register in database.machines when using DB-backed adapters (example-auth).



export const config: RawWebsiteConfig = {
  // Empty config - just use defaults

  controllers: {
    // uploadImage



    fruit: (res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: any) => {
      const shortname = requestInfo.action;
      if (!shortname) {
          res.statusCode = 302;
          res.setHeader('Location', '/');
          res.end();
          return;
      }
      const html = website.getContentHtml(shortname)({});
      res.end(html);
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

