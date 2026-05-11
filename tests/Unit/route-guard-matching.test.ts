import { describe, test, expect } from 'bun:test'
import { routeFullpathMatchesMappedKey } from '../../server/route-guard.js'

describe('routeFullpathMatchesMappedKey', () => {
  test('root key matches only the homepage fullpath, not deeper paths', () => {
    const root = 'localhost:3000/'
    expect(routeFullpathMatchesMappedKey('localhost:3000/', root)).toBe(true)
    expect(routeFullpathMatchesMappedKey('localhost:3000/fruit', root)).toBe(false)
    expect(routeFullpathMatchesMappedKey('localhost:3000/profile/1', root)).toBe(false)
  })

  test('nested route key matches itself and children', () => {
    const fruit = 'localhost:3000/fruit'
    expect(routeFullpathMatchesMappedKey('localhost:3000/fruit', fruit)).toBe(true)
    expect(routeFullpathMatchesMappedKey('localhost:3000/fruit/list', fruit)).toBe(true)
    expect(routeFullpathMatchesMappedKey('localhost:3000/fruit/new', fruit)).toBe(true)
  })

  test('does not match a sibling path segment prefix (e.g. /fruit vs /fruity)', () => {
    const fruit = 'localhost:3000/fruit'
    expect(routeFullpathMatchesMappedKey('localhost:3000/fruity', fruit)).toBe(false)
  })
})
