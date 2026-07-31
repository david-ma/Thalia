import { describe, expect, test } from 'bun:test'
import { wrap } from '../../server/controllers.js'
import { claimAdminNamespace } from '../../server/security/claim-admin-namespace.js'
import { ThaliaSecurity } from '../../server/security/thalia-security.js'
import { recursiveObjectMerge } from '../../server/website.js'
import { config as exampleAuthConfig } from '../../websites/example-auth/config/config.js'

describe('claimAdminNamespace', () => {
  test('returns the map unchanged (readable takeover marker)', () => {
    const overview = wrap('admin_overview.hbs')
    const map = claimAdminNamespace({ overview })
    expect(map.overview).toBe(overview)
    expect(Object.keys(map)).toEqual(['overview'])
  })

  test('merging an admin object over securityConfig replaces the scaffold leaf', () => {
    const scaffold = new ThaliaSecurity().securityConfig()
    expect(typeof scaffold.controllers?.admin).toBe('function')

    const overview = () => {}
    const merged = recursiveObjectMerge(scaffold, {
      controllers: {
        admin: claimAdminNamespace({ overview }),
      },
    })

    expect(typeof merged.controllers?.admin).toBe('object')
    const admin = merged.controllers!.admin as Record<string, unknown>
    expect(admin.overview).toBe(overview)
    expect(typeof admin.overview).toBe('function')
  })

  test('example-auth config replaces scaffold with claimAdminNamespace map', () => {
    expect(exampleAuthConfig.controllers).toBeDefined()
    expect(typeof exampleAuthConfig.controllers?.admin).toBe('object')
    const admin = exampleAuthConfig.controllers!.admin as Record<string, unknown>
    expect(typeof admin.overview).toBe('function')
  })
})
