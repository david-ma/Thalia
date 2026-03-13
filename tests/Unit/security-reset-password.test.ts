/**
 * Unit tests for the reset password Handlebars template.
 * Template: src/views/security/resetPassword.hbs
 *
 * Run from Thalia root: bun test tests/Unit/security-reset-password.test.ts
 */

import { describe, test, expect } from 'bun:test'
import Handlebars from 'handlebars'
import path from 'path'
import fs from 'fs'

const THALIA_ROOT = path.join(import.meta.dirname, '..', '..')
const TEMPLATE_PATH = path.join(THALIA_ROOT, 'src', 'views', 'security', 'resetPassword.hbs')

function loadTemplate(): string {
  const fullPath = path.resolve(TEMPLATE_PATH)
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Template not found: ${fullPath}`)
  }
  return fs.readFileSync(fullPath, 'utf8')
}

function render(data: { token?: string; error?: string; forgotPasswordUrl?: string }): string {
  const template = loadTemplate()
  const compile = Handlebars.compile(template)
  return compile(data)
}

describe('resetPassword.hbs', () => {
  test('template file exists', () => {
    expect(fs.existsSync(path.resolve(TEMPLATE_PATH))).toBe(true)
  })

  test('valid token: shows form with hidden token and password fields', () => {
    const html = render({ token: 'abc123', forgotPasswordUrl: '/forgotPassword' })
    expect(html).toContain('name="token"')
    expect(html).toContain('value="abc123"')
    expect(html).toContain('name="password"')
    expect(html).toContain('name="confirmPassword"')
    expect(html).toContain('Set password')
    expect(html).toContain('Reset Password')
    expect(html).not.toContain('Link invalid or expired')
  })

  test('valid token: no fail-state alert', () => {
    const html = render({ token: 'xyz', forgotPasswordUrl: '/forgotPassword' })
    expect(html).not.toContain('alert-warning')
    expect(html).not.toContain('Link invalid or expired')
  })

  test('error and no token: shows fail state with alert and CTA', () => {
    const html = render({
      error: 'Invalid or expired reset link. Please request a new one.',
      forgotPasswordUrl: '/forgotPassword',
    })
    expect(html).toContain('Link invalid or expired')
    expect(html).toContain('Invalid or expired reset link')
    expect(html).toContain('alert-warning')
    expect(html).toContain('Request a new reset link')
    expect(html).toContain('href="/forgotPassword"')
    expect(html).toContain('btn btn-primary')
    expect(html).toContain('Links expire after one hour')
    expect(html).not.toContain('name="token"')
    expect(html).not.toContain('Set password')
  })

  test('error and no token, no forgotPasswordUrl: still shows message, no CTA link', () => {
    const html = render({
      error: 'Invalid or expired reset link.',
    })
    expect(html).toContain('Link invalid or expired')
    expect(html).toContain('Invalid or expired reset link')
    expect(html).not.toContain('Request a new reset link')
    expect(html).not.toContain('name="password"')
  })

  test('error with token (validation error): shows form and inline error', () => {
    const html = render({
      token: 'valid-token',
      error: 'Passwords do not match.',
      forgotPasswordUrl: '/forgotPassword',
    })
    expect(html).toContain('Passwords do not match')
    expect(html).toContain('alert-danger')
    expect(html).toContain('name="token"')
    expect(html).toContain('value="valid-token"')
    expect(html).toContain('Set password')
    expect(html).not.toContain('Link invalid or expired')
  })

  test('token only: form visible, no error', () => {
    const html = render({ token: 'only' })
    expect(html).toContain('name="token"')
    expect(html).toContain('New password')
    expect(html).toContain('Confirm new password')
    expect(html).not.toContain('alert-danger')
    expect(html).not.toContain('alert-warning')
  })

  test('empty context: shows heading only, no form and no fail-state CTA', () => {
    const html = render({})
    expect(html).toContain('Reset Password')
    expect(html).not.toContain('name="token"')
    expect(html).not.toContain('Set password')
    expect(html).not.toContain('Request a new reset link')
    expect(html).not.toContain('Link invalid or expired')
  })
})
