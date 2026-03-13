/**
 * Unit tests for server/controllers.ts
 *
 * Tests CrudFactory.getAction (path-derived permission action for route guard).
 * Run from Thalia root: bun test tests/Unit/controllers.test.ts
 */

import { describe, test, expect } from 'bun:test'
import { CrudFactory } from '../../server/controllers.js'
import type { RequestInfo } from '../../server/server.js'

function makeRequestInfo(action: string, method = 'GET'): RequestInfo {
  return {
    host: 'localhost',
    domain: 'localhost',
    url: '/fruit/' + action,
    ip: '127.0.0.1',
    method,
    pathname: '/fruit/' + (action ? action : ''),
    controller: 'fruit',
    action,
    slug: action || 'list',
    cookies: {},
    node_env: 'test',
    query: {},
  }
}

describe('CrudFactory.getAction', () => {
  test('action "" or "list" returns read', () => {
    expect(CrudFactory.getAction(makeRequestInfo(''))).toBe('read')
    expect(CrudFactory.getAction(makeRequestInfo('list'))).toBe('read')
  })

  test('action "columns" and "json" return read', () => {
    expect(CrudFactory.getAction(makeRequestInfo('columns'))).toBe('read')
    expect(CrudFactory.getAction(makeRequestInfo('json'))).toBe('read')
  })

  test('action "new", "create", "testdata" return create', () => {
    expect(CrudFactory.getAction(makeRequestInfo('new'))).toBe('create')
    expect(CrudFactory.getAction(makeRequestInfo('create'))).toBe('create')
    expect(CrudFactory.getAction(makeRequestInfo('testdata'))).toBe('create')
  })

  test('action "edit", "update", "restore" return update', () => {
    expect(CrudFactory.getAction(makeRequestInfo('edit'))).toBe('update')
    expect(CrudFactory.getAction(makeRequestInfo('update'))).toBe('update')
    expect(CrudFactory.getAction(makeRequestInfo('restore'))).toBe('update')
  })

  test('action "delete" returns delete', () => {
    expect(CrudFactory.getAction(makeRequestInfo('delete'))).toBe('delete')
  })

  test('numeric id (default) returns read', () => {
    expect(CrudFactory.getAction(makeRequestInfo('1'))).toBe('read')
    expect(CrudFactory.getAction(makeRequestInfo('42'))).toBe('read')
  })
})
