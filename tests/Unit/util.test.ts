// Test various Thalia functions

import { recursiveObjectMerge } from '../../server/website.js'
import { expect, test, describe } from "bun:test";

describe('recursiveObjectMerge', () => {
  test('should merge two objects', () => {
    const obj1 : any = { a: 1, b: 2 }
    const obj2 : any = { b: 3, c: 4 }
    const result = recursiveObjectMerge(obj1, obj2)
    expect(result).toEqual({ a: 1, b: 3, c: 4 })
  })

  // Test arrays
  test('should merge two arrays', () => {
    const obj1 : any = { a: [1, 2], b: 2 }
    const obj2 : any = { a: [3, 4], b: 3, c: [4, 5] }
    const result = recursiveObjectMerge(obj1, obj2)
    expect(result).toEqual({ a: [1, 2, 3, 4], b: 3, c: [4, 5] })
  })

  // Test nested objects
  test('should merge nested objects', () => {
    const obj1 : any = { a: { b: 1, c: 2 } }
    const obj2 : any = { a: { b: 3, d: 4 } }
    const result = recursiveObjectMerge(obj1, obj2)
    expect(result).toEqual({ a: { b: 3, c: 2, d: 4 } })
  })

  // Test overwriting different types
  test('should overwrite different types', () => {
    const obj1 : any = { a: 1, b: 2 }
    const obj2 : any = { a: '1', b: 2 }
    const result = recursiveObjectMerge(obj1, obj2)
    expect(result).toEqual({ a: '1', b: 2 })
  })

  // Test overwriting with arrays
  test('should overwrite with arrays', () => {
    const obj1 : any = { a: [1, 2], b: 2, c: 'string lol'}
    const obj2 : any = { a: [3, 4], b: 3, c: [4, 5] }
    const result = recursiveObjectMerge(obj1, obj2)
    expect(result).toEqual({ a: [1, 2, 3, 4], b: 3, c: [4, 5] })
  })

  // Test original object not being modified
  test('should not modify original object', () => {
    const obj1 : any = { a: 1, b: 2 }
    const obj2 : any = { b: 3, c: 4 }
    const result = recursiveObjectMerge(obj1, obj2)
    expect(obj1).toEqual({ a: 1, b: 2 })
    expect(obj2).toEqual({ b: 3, c: 4 })
    expect(result).toEqual({ a: 1, b: 3, c: 4 })
  })

  // Config-style: routes array concatenation (default_routes + project routes)
  test('should concatenate routes arrays (config merge)', () => {
    const base : any = { routes: [{ path: '/' }, { path: '/admin' }] }
    const extra : any = { routes: [{ path: '/fruit' }] }
    const result = recursiveObjectMerge(base, extra)
    expect(Array.isArray(result.routes)).toBe(true)
    expect(result.routes).toHaveLength(3)
    expect(result.routes[0]).toEqual({ path: '/' })
    expect(result.routes[1]).toEqual({ path: '/admin' })
    expect(result.routes[2]).toEqual({ path: '/fruit' })
  })
})


import { asyncForEach, escapeHtml, sanitiseFormFields, sanitiseFormText } from '../../server/util.js'

describe('test asyncForEach', () => {
  // TODO: Think of a way to test this
  test('should iterate over an array', async () => {
    const array = [1, 2, 3, 4, 5]

    asyncForEach(array, 2, (item, index, array, done) => {
      expect(item).toBe(array[index])
      done()
    })
  })
})

describe('sanitiseFormText', () => {
  test('null and undefined become empty string', () => {
    expect(sanitiseFormText(null)).toBe('')
    expect(sanitiseFormText(undefined)).toBe('')
  })

  test('arrays are mapped and joined with comma-space', () => {
    expect(sanitiseFormText(['a', 'b'])).toBe('a, b')
    expect(sanitiseFormText([1, 2])).toBe('1, 2')
  })

  test('other values are stringified', () => {
    expect(sanitiseFormText('hello')).toBe('hello')
    expect(sanitiseFormText(42)).toBe('42')
    expect(sanitiseFormText(true)).toBe('true')
  })

  test('backticks are stripped', () => {
    expect(sanitiseFormText('`code`')).toBe('code')
    expect(sanitiseFormText(['`a`', '`b`'])).toBe('a, b')
  })
})

describe('sanitiseFormFields', () => {
  test('maps all entries through sanitiseFormText', () => {
    expect(
      sanitiseFormFields({
        message: '`hi`',
        tags: ['a', 'b'],
        count: 3,
        empty: null,
      }),
    ).toEqual({
      message: 'hi',
      tags: 'a, b',
      count: '3',
      empty: '',
    })
  })
})

describe('escapeHtml', () => {
  test('escapes HTML metacharacters', () => {
    expect(escapeHtml('a & b <c> "d"')).toBe('a &amp; b &lt;c&gt; &quot;d&quot;')
  })

  test('leaves safe text unchanged', () => {
    expect(escapeHtml('plain text')).toBe('plain text')
  })
})

