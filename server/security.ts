import { ServerResponse, IncomingMessage } from 'http'
import { Website } from './website'

export interface SecurityOptions {
  websiteName: string
  mailFrom: string
  mailAuth: {
    user: string
    pass: string
  }
}

export function users(_options: SecurityOptions) {
  return {
    login: (_res: ServerResponse, _req: IncomingMessage, _website: Website) => {
      // TODO: Implement login
    },
    logout: (_res: ServerResponse, _req: IncomingMessage, _website: Website) => {
      // TODO: Implement logout
    },
    register: (_res: ServerResponse, _req: IncomingMessage, _website: Website) => {
      // TODO: Implement registration
    }
  }
} 