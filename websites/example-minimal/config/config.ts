// Minimal config for example-minimal website
import { RawWebsiteConfig } from 'thalia/types'

export const config: RawWebsiteConfig = {
  routes: [
    // This route is protected by a simple password.
    // Anything below it is also protected by the same password.
    {
      node_env: 'production', // This route rule will only apply in production environment
      ip_whitelist: '192.168.0.0/24,::1', // This route rule will be skipped for ips in the range 192.168.0.0/24 or ::1
      path: '/protected-route', // This route rule will only apply to requests to /protected-route
      password: 'password123',
    }
  ]
}

