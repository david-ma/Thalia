import { describe, expect, spyOn, test } from 'bun:test'
import type { MySqlTableWithColumns } from 'drizzle-orm/mysql-core'
import { mysqlTable, varchar } from 'drizzle-orm/mysql-core'
import {
  estimateRowsPerSchemaParallel,
  fetchTableRowEstimatesBySqlName,
  inferDbDialect,
} from '../../server/database.js'

function asSchema(tableName: string): MySqlTableWithColumns<any> {
  return mysqlTable(tableName, {
    id: varchar('id', { length: 1 }),
  })
}

describe('inferDbDialect', () => {
  test('reads drizzle-kit dialect field', () => {
    expect(inferDbDialect({ dialect: 'mysql', dbCredentials: {} })).toBe('mysql')
    expect(inferDbDialect({ dialect: 'postgresql' })).toBe('postgresql')
  })

  test('infers from connection URL when dialect omitted', () => {
    expect(inferDbDialect({ dbCredentials: { url: 'mysql://u:p@localhost/db' } })).toBe('mysql')
    expect(inferDbDialect({ dbCredentials: { url: 'postgresql://u:p@localhost/db' } })).toBe('postgresql')
    expect(inferDbDialect({ dbCredentials: { url: 'file:./models/sqlite.db' } })).toBe('sqlite')
  })
})

describe('fetchTableRowEstimatesBySqlName', () => {
  test('mysql maps information_schema TABLE_ROWS', async () => {
    const db = {
      execute: async () => [
        [
          { TABLE_NAME: 'Class_File', TABLE_ROWS: 42 },
          { TABLE_NAME: 'Debtors_Master_File', TABLE_ROWS: 9000 },
        ],
      ],
    }

    const estimates = await fetchTableRowEstimatesBySqlName(
      db,
      ['Class_File', 'Debtors_Master_File'],
      'mysql',
      'demo-site',
    )

    expect(estimates.get('Class_File')).toBe(42)
    expect(estimates.get('Debtors_Master_File')).toBe(9000)
  })

  test('postgresql maps pg_stat_user_tables n_live_tup', async () => {
    const db = {
      execute: async () => [[{ table_name: 'albums', row_estimate: 12 }]],
    }

    const estimates = await fetchTableRowEstimatesBySqlName(db, ['albums'], 'postgresql', 'demo-site')
    expect(estimates.get('albums')).toBe(12)
  })

  test('sqlite returns empty without querying', async () => {
    const execute = async () => {
      throw new Error('should not run')
    }
    const estimates = await fetchTableRowEstimatesBySqlName(
      { execute },
      ['fruit'],
      'sqlite',
      'demo-site',
    )
    expect(estimates.size).toBe(0)
  })
})

describe('estimateRowsPerSchemaParallel', () => {
  test('returns empty counts when there are no schemas', async () => {
    const db = { execute: async () => [[]] }
    await expect(estimateRowsPerSchemaParallel(db, {}, 'no-schemas', 'mysql')).resolves.toEqual({})
  })

  test('fills counts from one catalog query keyed by Drizzle table name', async () => {
    const alpha = asSchema('Alpha_Table')
    const beta = asSchema('Beta_Table')
    const db = {
      execute: async () => [
        [
          { TABLE_NAME: 'Alpha_Table', TABLE_ROWS: 10 },
          { TABLE_NAME: 'Beta_Table', TABLE_ROWS: 25 },
        ],
      ],
    }

    const counts = await estimateRowsPerSchemaParallel(
      db,
      { alpha, beta },
      'demo-site',
      'mysql',
    )
    expect(counts).toEqual({ alpha: 10, beta: 25 })
  })

  test('a missing catalog row logs and omits only that schema', async () => {
    const ok = asSchema('Good_Table')
    const missing = asSchema('Missing_Table')

    const warnArgs: unknown[][] = []
    const warnSpy = spyOn(console, 'warn').mockImplementation((first: unknown, ...rest: unknown[]) => {
      warnArgs.push([first, ...rest])
    })

    const db = {
      execute: async () => [[{ TABLE_NAME: 'Good_Table', TABLE_ROWS: 7 }]],
    }

    const counts = await estimateRowsPerSchemaParallel(
      db,
      { good: ok, bad: missing },
      'demo-site',
      'mysql',
    )

    warnSpy.mockRestore()

    expect(counts).toEqual({ good: 7 })
    expect(counts.bad).toBeUndefined()
    expect(warnArgs.length).toBe(1)
    expect(String(warnArgs[0]?.[0])).toContain('bad')
    expect(String(warnArgs[0]?.[0])).toContain('Missing_Table')
  })
})
