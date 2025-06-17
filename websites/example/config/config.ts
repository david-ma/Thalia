import { RawWebsiteConfig } from 'thalia'
import { users, sessions, audits } from 'thalia/models'


export const config: RawWebsiteConfig = {
  domains: ['example.com'],
  // database: {
  //   url: 'example.db',
  //   models: {
  //     users,
  //     sessions,
  //     audits
  //   }
  // }
}

// export default config