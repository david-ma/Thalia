import { describe, expect, test } from 'bun:test'
import { parseProfileUpdatePayload } from '../../server/security/profile-controller-factory.js'

const fields = ['name', 'photo'] as const
const maxLen = 64

describe('parseProfileUpdatePayload', () => {
  test('accepts name only', () => {
    const r = parseProfileUpdatePayload({ name: '  Ada  ' }, fields, maxLen)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.patch).toEqual({ name: 'Ada' })
  })

  test('accepts photo null to clear', () => {
    const r = parseProfileUpdatePayload({ photo: null }, fields, maxLen)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.patch).toEqual({ photo: null })
  })

  test('accepts name and photo', () => {
    const r = parseProfileUpdatePayload({ name: 'Bob', photo: 'https://x/y.png' }, fields, maxLen)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.patch).toEqual({ name: 'Bob', photo: 'https://x/y.png' })
  })

  test('empty photo string becomes null', () => {
    const r = parseProfileUpdatePayload({ photo: '   ' }, fields, maxLen)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.patch).toEqual({ photo: null })
  })

  test('400 for non-object', () => {
    expect(parseProfileUpdatePayload(null, fields, maxLen).ok).toBe(false)
    expect(parseProfileUpdatePayload([], fields, maxLen)).toEqual({
      ok: false,
      status: 400,
      error: 'JSON body must be an object',
    })
  })

  test('422 for unknown field', () => {
    const r = parseProfileUpdatePayload({ name: 'a', extra: 1 }, fields, maxLen)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.status).toBe(422)
      expect(r.error).toContain('extra')
    }
  })

  test('422 for empty object', () => {
    const r = parseProfileUpdatePayload({}, fields, maxLen)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(422)
  })

  test('422 for wrong type', () => {
    const r = parseProfileUpdatePayload({ name: 42 }, fields, maxLen)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(422)
  })

  test('422 for empty name', () => {
    const r = parseProfileUpdatePayload({ name: '   ' }, fields, maxLen)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(422)
  })

  test('422 when name is null', () => {
    const r = parseProfileUpdatePayload({ name: null }, fields, maxLen)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(422)
  })

  test('422 when string too long', () => {
    const r = parseProfileUpdatePayload({ name: 'x'.repeat(100) }, fields, 10)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(422)
  })

  test('respects narrowed updatableFields (name only)', () => {
    const r = parseProfileUpdatePayload({ name: 'z', photo: 'u' }, ['name'], maxLen)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(422)
  })
})
