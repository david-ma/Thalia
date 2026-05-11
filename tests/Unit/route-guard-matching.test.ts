import { describe, test, expect } from 'bun:test'
import { routeFullpathMatchesMappedKey } from '../../server/route-guard.js'

describe('routeFullpathMatchesMappedKey', () => {
  const host = 'example.test:1234'

  test('root key matches only the homepage fullpath, not deeper paths', () => {
    const root = `${host}/`
    expect(routeFullpathMatchesMappedKey(`${host}/`, root)).toBe(true)
    expect(routeFullpathMatchesMappedKey(`${host}/fruit`, root)).toBe(false)
    expect(routeFullpathMatchesMappedKey(`${host}/profile/1`, root)).toBe(false)
  })

  test('nested route key matches itself and children', () => {
    const fruit = `${host}/fruit`
    expect(routeFullpathMatchesMappedKey(`${host}/fruit`, fruit)).toBe(true)
    expect(routeFullpathMatchesMappedKey(`${host}/fruit/list`, fruit)).toBe(true)
    expect(routeFullpathMatchesMappedKey(`${host}/fruit/new`, fruit)).toBe(true)
  })

  test('does not match a sibling path segment prefix (e.g. /fruit vs /fruity)', () => {
    const fruit = `${host}/fruit`
    expect(routeFullpathMatchesMappedKey(`${host}/fruity`, fruit)).toBe(false)
  })

  test('asset prefixes match nested paths (e.g. /css matches /css/main.css)', () => {
    const css = `${host}/css`
    expect(routeFullpathMatchesMappedKey(`${host}/css/main.css`, css)).toBe(true)
    expect(routeFullpathMatchesMappedKey(`${host}/css`, css)).toBe(true)

    // Failure cases: different prefix or sibling segment should not match.
    expect(routeFullpathMatchesMappedKey(`${host}/scss/main.css`, css)).toBe(false)
    expect(routeFullpathMatchesMappedKey(`${host}/cssish/main.css`, css)).toBe(false)
  })
})
