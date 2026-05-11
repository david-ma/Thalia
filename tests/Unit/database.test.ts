import { describe, expect, spyOn, test } from 'bun:test'
import type { MySqlTableWithColumns } from 'drizzle-orm/mysql-core'
import { countRowsPerSchemaParallel } from '../../server/database.js'

function asSchema(): MySqlTableWithColumns<any> {
  return {} as MySqlTableWithColumns<any>
}

describe('countRowsPerSchemaParallel', () => {
  test('returns empty counts when there are no schemas', async () => {
    const db = {
      select: () => ({
        from: async () => [] as Record<string, unknown>[],
      }),
    }
    await expect(countRowsPerSchemaParallel(db as any, {}, 'no-schemas')).resolves.toEqual({})
  })

  test('fills counts from parallel successful COUNT(*) results', async () => {
    const alpha = asSchema()
    const beta = asSchema()
    const db = {
      select(fields: Record<string, unknown>) {
        const alias = Object.keys(fields)[0] as string
        return {
          from(schema: unknown) {
            if (schema === alpha) return Promise.resolve([{ [alias]: 10 }])
            if (schema === beta) return Promise.resolve([{ [alias]: 25 }])
            return Promise.reject(new Error('unexpected schema'))
          },
        }
      },
    }

    const counts = await countRowsPerSchemaParallel(
      db as any,
      { alpha, beta },
      'demo-site',
    )
    expect(counts).toEqual({ alpha: 10, beta: 25 })
  })

  test('a rejected COUNT(*) logs and omits only that schema; Promise.all still resolves', async () => {
    const ok = asSchema()
    const broken = asSchema()

    const warnArgs: unknown[][] = []
    const warnSpy = spyOn(console, 'warn').mockImplementation((first: unknown, ...rest: unknown[]) => {
      warnArgs.push([first, ...rest])
    })

    const db = {
      select(fields: Record<string, unknown>) {
        const alias = Object.keys(fields)[0] as string
        return {
          from(schema: unknown) {
            if (schema === broken) {
              return Promise.reject(new Error('ER_NO_SUCH_TABLE'))
            }
            return Promise.resolve([{ [alias]: 7 }])
          },
        }
      },
    }

    const counts = await countRowsPerSchemaParallel(db as any, { good: ok, bad: broken }, 'demo-site')

    warnSpy.mockRestore()

    expect(counts).toEqual({ good: 7 })
    expect(counts.bad).toBeUndefined()
    expect(warnArgs.length).toBe(1)
    expect(String(warnArgs[0]?.[0])).toContain('bad')
    expect(String(warnArgs[0]?.[0])).toContain('demo-site')
    expect(warnArgs[0]?.[1]).toBe('ER_NO_SUCH_TABLE')
  })
})
