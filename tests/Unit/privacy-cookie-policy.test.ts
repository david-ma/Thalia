import { describe, expect, test } from 'bun:test'
import { ThaliaSecurity } from '../../server/security/thalia-security.js'
import {
  cookiePolicyRoute,
  privacyPolicyRoute,
  termsOfUseRoute,
} from '../../server/security/security-default-routes.js'
import type { RoleRouteRule } from '../../server/route-guard.js'
import { config as exampleAuthConfig } from '../../websites/example-auth/config/config.js'
import fs from 'fs'
import path from 'path'

const POLICY_PATHS = [
  privacyPolicyRoute.path,
  cookiePolicyRoute.path,
  termsOfUseRoute.path,
] as const

const srcRoot = path.join(import.meta.dirname, '../../src')

describe('privacy / cookie / terms defaults', () => {
  test('framework ships src/*.hbs fallthrough pages (no securityConfig controllers)', () => {
    const cfg = new ThaliaSecurity().securityConfig()
    const controllers = cfg.controllers as Record<string, unknown>
    for (const p of POLICY_PATHS) {
      const key = p.slice(1)
      expect(controllers[key]).toBeUndefined()
      expect(fs.existsSync(path.join(srcRoot, `${key}.hbs`))).toBe(true)
    }
  })

  test('securityConfig includes guest-readable RoleRouteRules', () => {
    const cfg = new ThaliaSecurity().securityConfig()
    const routes = (cfg.routes ?? []) as RoleRouteRule[]
    for (const pathName of POLICY_PATHS) {
      const rule = routes.find((r) => r.path === pathName)
      expect(rule?.permissions?.guest).toEqual(expect.arrayContaining(['read']))
      expect(rule?.permissions?.user).toEqual(expect.arrayContaining(['read']))
      expect(rule?.permissions?.admin).toEqual(expect.arrayContaining(['read']))
    }
  })

  test('example-auth does not claim policy paths with controllers', () => {
    const controllers = exampleAuthConfig.controllers as Record<string, unknown>
    for (const p of POLICY_PATHS) {
      expect(controllers[p.slice(1)]).toBeUndefined()
    }
  })

  test('default logon template links to all policy pages', () => {
    const loginPath = path.join(import.meta.dirname, '../../src/views/security/userLogin.hbs')
    const html = fs.readFileSync(loginPath, 'utf8')
    expect(html).toContain('{{> policy-links }}')
    const linksPath = path.join(import.meta.dirname, '../../src/views/partials/policy-links.hbs')
    const links = fs.readFileSync(linksPath, 'utf8')
    expect(links).toContain('/privacy-policy')
    expect(links).toContain('/cookie-policy')
    expect(links).toContain('/terms-of-use')
  })

  test('default privacy copy stays generic (no stack or cookie-name specifics)', () => {
    const privacy = fs.readFileSync(path.join(srcRoot, 'privacy-policy.hbs'), 'utf8')
    const cookies = fs.readFileSync(path.join(srcRoot, 'cookie-policy.hbs'), 'utf8')
    for (const text of [privacy, cookies]) {
      expect(text).not.toMatch(/sessionId|HttpOnly|thaliaAuth|password hash|SameSite/i)
      expect(text).not.toMatch(/Thalia security|Drizzle|MariaDB|Play Store|Chrome Web Store/i)
    }
  })
})
