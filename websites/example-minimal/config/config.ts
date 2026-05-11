// Minimal config for example-minimal website
import { RawWebsiteConfig } from 'thalia/types'

export const config: RawWebsiteConfig = {
  routes: [
    // This route is protected by a simple password.
    // Anything below it is also protected by the same password.
    {
      path: '/protected-route',
      password: 'password123',
    }
  ]
}

