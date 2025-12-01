// Minimal config for example-src website
import { IncomingMessage, ServerResponse } from 'http'
import { RawWebsiteConfig } from 'thalia/types'
import { Website } from '../../../server/website'

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
    }
  }
}

