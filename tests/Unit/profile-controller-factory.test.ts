import { describe, expect, test } from 'bun:test'
import {
  parseProfileUpdatePayload,
  profileJsonErrorString,
  profileRevealEmailForGet,
  profileSelfRedirectLocation,
  validateProfilePhotoHttpHttpsUrl,
} from '../../server/security/profile-controller-factory.js'

const fields = ['name', 'photo'] as const
const maxLen = 64

describe('profileJsonErrorString', () => {
  test('serialises error and code', () => {
    const s = profileJsonErrorString('Invalid JSON', 'INVALID_JSON')
    expect(JSON.parse(s)).toEqual({ error: 'Invalid JSON', code: 'INVALID_JSON' })
  })
})

describe('profileSelfRedirectLocation', () => {
  test('returns canonical URL when bare path and session user', () => {
    expect(profileSelfRedirectLocation('', 42, true)).toBe('/profile/42')
    expect(profileSelfRedirectLocation('   ', 42, true)).toBe('/profile/42')
  })
  test('returns null when id segment present, redirect disabled, or no user', () => {
    expect(profileSelfRedirectLocation('', 42, false)).toBe(null)
    expect(profileSelfRedirectLocation('', undefined, true)).toBe(null)
    expect(profileSelfRedirectLocation('7', 42, true)).toBe(null)
    expect(profileSelfRedirectLocation('x', 42, true)).toBe(null)
  })
})

describe('validateProfilePhotoHttpHttpsUrl', () => {
  test('allows null', () => {
    expect(validateProfilePhotoHttpHttpsUrl(null)).toEqual({ ok: true })
  })
  test('allows http and https URLs', () => {
    expect(validateProfilePhotoHttpHttpsUrl('https://example.com/a.png')).toEqual({ ok: true })
    expect(validateProfilePhotoHttpHttpsUrl('http://localhost/x')).toEqual({ ok: true })
  })
  test('rejects non-http(s) schemes and invalid URLs', () => {
    expect(validateProfilePhotoHttpHttpsUrl('javascript:alert(1)')).toMatchObject({
      ok: false,
      code: 'PHOTO_VALUE_REJECTED',
    })
    expect(validateProfilePhotoHttpHttpsUrl('ftp://x/y')).toMatchObject({ ok: false, code: 'PHOTO_VALUE_REJECTED' })
    expect(validateProfilePhotoHttpHttpsUrl('not a url')).toMatchObject({ ok: false, code: 'PHOTO_VALUE_REJECTED' })
  })
})

describe('profileRevealEmailForGet', () => {
  test('everyone mode always reveals', () => {
    expect(profileRevealEmailForGet('everyone', 1, 2, 'user')).toBe(true)
    expect(profileRevealEmailForGet('everyone', 1, undefined, undefined)).toBe(true)
  })
  test('owner_or_admin_only reveals for admin or profile owner', () => {
    expect(profileRevealEmailForGet('owner_or_admin_only', 5, 5, 'user')).toBe(true)
    expect(profileRevealEmailForGet('owner_or_admin_only', 5, 9, 'admin')).toBe(true)
  })
  test('owner_or_admin_only hides for other signed-in users', () => {
    expect(profileRevealEmailForGet('owner_or_admin_only', 5, 9, 'user')).toBe(false)
    expect(profileRevealEmailForGet('owner_or_admin_only', 5, undefined, 'user')).toBe(false)
  })
})

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
      code: 'JSON_NOT_OBJECT',
    })
  })

  test('422 for unknown field includes code', () => {
    const r = parseProfileUpdatePayload({ name: 'a', extra: 1 }, fields, maxLen)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.status).toBe(422)
      expect(r.code).toBe('UNKNOWN_FIELD')
      expect(r.error).toContain('extra')
    }
  })

  test('422 for empty object includes code', () => {
    const r = parseProfileUpdatePayload({}, fields, maxLen)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.status).toBe(422)
      expect(r.code).toBe('NO_FIELDS_TO_UPDATE')
    }
  })

  test('422 for wrong type includes code', () => {
    const r = parseProfileUpdatePayload({ name: 42 }, fields, maxLen)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('FIELD_NOT_STRING')
  })

  test('422 for empty name includes code', () => {
    const r = parseProfileUpdatePayload({ name: '   ' }, fields, maxLen)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('NAME_EMPTY')
  })

  test('422 when name is null includes code', () => {
    const r = parseProfileUpdatePayload({ name: null }, fields, maxLen)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('FIELD_NULL_INVALID')
  })

  test('422 when string too long includes code', () => {
    const r = parseProfileUpdatePayload({ name: 'x'.repeat(100) }, fields, 10)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('FIELD_TOO_LONG')
  })

  test('respects narrowed updatableFields (name only)', () => {
    const r = parseProfileUpdatePayload({ name: 'z', photo: 'u' }, ['name'], maxLen)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.status).toBe(422)
      expect(r.code).toBe('UNKNOWN_FIELD')
    }
  })
})
