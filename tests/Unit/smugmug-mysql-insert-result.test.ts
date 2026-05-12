import { describe, expect, test } from 'bun:test'
import { mysqlInsertIdFromDrizzleMysql2Result } from '../../models/util.js'

describe('mysqlInsertIdFromDrizzleMysql2Result', () => {
  test('reads insertId from mysql2 tuple [ResultSetHeader, fields]', () => {
    const tuple = [{ insertId: 42, affectedRows: 1 }, []]
    expect(mysqlInsertIdFromDrizzleMysql2Result(tuple)).toBe(42)
  })

  test('reads bigint insertId from tuple header', () => {
    const tuple = [{ insertId: BigInt(9007199254740991), affectedRows: 1 }, []]
    expect(mysqlInsertIdFromDrizzleMysql2Result(tuple)).toBe(9007199254740991)
  })

  test('reads insertId from bare header object (legacy shape)', () => {
    expect(mysqlInsertIdFromDrizzleMysql2Result({ insertId: 7, affectedRows: 1 })).toBe(7)
  })

  test('returns undefined for empty tuple', () => {
    expect(mysqlInsertIdFromDrizzleMysql2Result([])).toBeUndefined()
  })

  test('returns undefined for null', () => {
    expect(mysqlInsertIdFromDrizzleMysql2Result(null)).toBeUndefined()
  })
})
