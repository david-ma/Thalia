// Minimal config for example-src website
import { IncomingMessage, ServerResponse } from 'http'
import { RawWebsiteConfig } from 'thalia/types'
import { Website } from '../../../server/website'
import { latestData } from 'thalia/controllers'

export const config: RawWebsiteConfig = {
  // Empty config - just use defaults

  controllers: {
    fruit: (res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: any) => {
      const shortname = requestInfo.action;
      if (!shortname) {
          res.statusCode = 301;
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

