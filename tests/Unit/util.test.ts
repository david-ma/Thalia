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
})


import { asyncForEach } from '../../server/util.js'

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

