import path from 'path'

const drizzleConfig = await import(
  // @ts-ignore
  path.join(import.meta.dirname, '..', 'drizzle.config.ts')
)

import { SecurityService } from '../../../server/security'

const securityService = new SecurityService(drizzleConfig)

securityService.createUser({
  email: 'sabby@david-ma.net',
  password: 'password',
  name: 'sabby test',
  role: 'admin',
  locked: false,
  verified: true,
}).then((user) => {
  console.log('User created', user)
  process.exit(0)
})
