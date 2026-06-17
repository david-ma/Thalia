/**
 * Unit tests: CrudFactory DataTables query parsing (`server/controllers.ts`).
 * Run from Thalia root: bun test tests/Unit/crud-datatables-parse.test.ts
 */

import { describe, expect, test } from 'bun:test'
import {
  CRUD_DATATABLES_DEFAULT_DRAW,
  CRUD_DATATABLES_DEFAULT_LENGTH,
  CRUD_DATATABLES_DEFAULT_START,
  CRUD_DATATABLES_MAX_LENGTH,
  crudFirstQueryValue,
  escapeCrudDataTablesLikeTerm,
  getCrudDataTablesOrderEntries,
  hasActiveCrudGlobalSearch,
  crudColumnSupportsDataTablesOrder,
  crudColumnSupportsDataTablesSearch,
  crudWrapperMainClass,
  crudWrapperPageData,
  crudCsvEscape,
  rowsToCrudCsv,
  CRUD_CSV_MAX_ROWS,
  normaliseCrudDataTablesPaging,
  parseCrudDataTablesQuery,
  resolveCrudJsonOrderColumnNames,
} from '../../server/controllers.js'

describe('escapeCrudDataTablesLikeTerm', () => {
  test('escapes LIKE metacharacters', () => {
    expect(escapeCrudDataTablesLikeTerm('100%_off')).toBe('100\\%\\_off')
  })

  test('escapes backslashes first', () => {
    expect(escapeCrudDataTablesLikeTerm('a\\b')).toBe('a\\\\b')
  })
})

describe('crudFirstQueryValue', () => {
  test('returns first entry for arrays', () => {
    expect(crudFirstQueryValue(['7', '9'])).toBe('7')
  })

  test('returns string as-is', () => {
    expect(crudFirstQueryValue('3')).toBe('3')
  })

  test('undefined stays undefined', () => {
    expect(crudFirstQueryValue(undefined)).toBeUndefined()
  })
})

describe('parseCrudDataTablesQuery', () => {
  test('empty query yields undefined draw/start/length', () => {
    const p = parseCrudDataTablesQuery({})
    expect(p.draw).toBeUndefined()
    expect(p.start).toBeUndefined()
    expect(p.length).toBeUndefined()
    expect(p.order).toEqual({})
    expect(p.search.value).toBeUndefined()
    expect(p.search.regex).toBe(false)
  })

  test('collapses draw/start/length when repeated as array', () => {
    const p = parseCrudDataTablesQuery({
      draw: ['2', '3'],
      start: ['10'],
      length: ['25'],
    })
    expect(p.draw).toBe('2')
    expect(p.start).toBe('10')
    expect(p.length).toBe('25')
  })

  test('parses order[n][column] and order[n][dir]', () => {
    const p = parseCrudDataTablesQuery({
      'order[0][column]': '1',
      'order[0][dir]': 'asc',
    })
    expect(p.order['0']).toEqual({ column: '1', dir: 'asc' })
  })

  test('parses order[n][name] for server-side column data keys', () => {
    const p = parseCrudDataTablesQuery({
      'order[0][column]': '0',
      'order[0][dir]': 'desc',
      'order[0][name]': 'dhist_created',
    })
    expect(p.order['0']).toEqual({ column: '0', dir: 'desc', name: 'dhist_created' })
  })

  test('parses search[value] and search[regex]', () => {
    const p = parseCrudDataTablesQuery({
      'search[value]': 'foo',
      'search[regex]': 'true',
    })
    expect(p.search.value).toBe('foo')
    expect(p.search.regex).toBe(true)
  })
})

describe('normaliseCrudDataTablesPaging', () => {
  test('applies defaults when fields missing', () => {
    const n = normaliseCrudDataTablesPaging(parseCrudDataTablesQuery({}))
    expect(n.draw).toBe(CRUD_DATATABLES_DEFAULT_DRAW)
    expect(n.offset).toBe(CRUD_DATATABLES_DEFAULT_START)
    expect(n.limit).toBe(CRUD_DATATABLES_DEFAULT_LENGTH)
  })

  test('uses explicit numeric start and length', () => {
    const n = normaliseCrudDataTablesPaging(
      parseCrudDataTablesQuery({ start: '20', length: '15', draw: '4' }),
    )
    expect(n.draw).toBe('4')
    expect(n.offset).toBe(20)
    expect(n.limit).toBe(15)
  })

  test('negative start falls back to default offset', () => {
    const n = normaliseCrudDataTablesPaging(parseCrudDataTablesQuery({ start: '-5' }))
    expect(n.offset).toBe(CRUD_DATATABLES_DEFAULT_START)
  })

  test('NaN length falls back to default length', () => {
    const n = normaliseCrudDataTablesPaging(parseCrudDataTablesQuery({ length: 'x' }))
    expect(n.limit).toBe(CRUD_DATATABLES_DEFAULT_LENGTH)
  })

  test('length zero or negative uses default length', () => {
    expect(normaliseCrudDataTablesPaging(parseCrudDataTablesQuery({ length: '0' })).limit).toBe(
      CRUD_DATATABLES_DEFAULT_LENGTH,
    )
    expect(normaliseCrudDataTablesPaging(parseCrudDataTablesQuery({ length: '-3' })).limit).toBe(
      CRUD_DATATABLES_DEFAULT_LENGTH,
    )
  })

  test('caps length at CRUD_DATATABLES_MAX_LENGTH', () => {
    const n = normaliseCrudDataTablesPaging(
      parseCrudDataTablesQuery({ length: String(CRUD_DATATABLES_MAX_LENGTH + 1000) }),
    )
    expect(n.limit).toBe(CRUD_DATATABLES_MAX_LENGTH)
  })

  test('blank draw falls back to default draw', () => {
    const n = normaliseCrudDataTablesPaging(parseCrudDataTablesQuery({ draw: '' }))
    expect(n.draw).toBe(CRUD_DATATABLES_DEFAULT_DRAW)
  })
})

describe('hasActiveCrudGlobalSearch', () => {
  test('false for empty or whitespace search', () => {
    expect(hasActiveCrudGlobalSearch({ value: undefined, regex: false })).toBe(false)
    expect(hasActiveCrudGlobalSearch({ value: '   ', regex: false })).toBe(false)
  })

  test('true when search has a term', () => {
    expect(hasActiveCrudGlobalSearch({ value: 'acme', regex: false })).toBe(true)
  })
})

describe('resolveCrudJsonOrderColumnNames', () => {
  const cols = ['dhist_created', 'dhist_dbtno', 'dhist_sales']

  test('prefers order[name] when present', () => {
    const parsed = parseCrudDataTablesQuery({
      'order[0][column]': '0',
      'order[0][dir]': 'desc',
      'order[0][name]': 'dhist_sales',
    })
    expect(resolveCrudJsonOrderColumnNames(parsed, cols, 'dhist_unique')).toEqual([
      { name: 'dhist_sales', dir: 'desc' },
    ])
  })

  test('resolves order[column] index when name omitted', () => {
    const parsed = parseCrudDataTablesQuery({
      'order[0][column]': '1',
      'order[0][dir]': 'asc',
    })
    expect(resolveCrudJsonOrderColumnNames(parsed, cols, 'dhist_unique')).toEqual([
      { name: 'dhist_dbtno', dir: 'asc' },
    ])
  })

  test('falls back to default column desc when order missing', () => {
    expect(resolveCrudJsonOrderColumnNames(parseCrudDataTablesQuery({}), cols, 'dhist_dbtno')).toEqual([
      { name: 'dhist_dbtno', dir: 'desc' },
    ])
  })

  test('falls back to first available column when default not in list', () => {
    expect(resolveCrudJsonOrderColumnNames(parseCrudDataTablesQuery({}), cols, 'missing')).toEqual([
      { name: 'dhist_created', dir: 'desc' },
    ])
  })
})

describe('getCrudDataTablesOrderEntries', () => {
  test('sorts multi-column order by index', () => {
    const entries = getCrudDataTablesOrderEntries({
      '1': { column: '2', dir: 'asc' },
      '0': { column: '0', dir: 'desc' },
    })
    expect(entries).toEqual([
      { columnIndex: 0, name: undefined, dir: 'desc' },
      { columnIndex: 2, name: undefined, dir: 'asc' },
    ])
  })
})

describe('crudColumnSupportsDataTablesOrder', () => {
  test('allows common MySQL Drizzle column types', () => {
    expect(crudColumnSupportsDataTablesOrder('MySqlVarChar')).toBe(true)
    expect(crudColumnSupportsDataTablesOrder('MySqlDate')).toBe(true)
    expect(crudColumnSupportsDataTablesOrder('MySqlDouble')).toBe(true)
  })

  test('disallows json blobs', () => {
    expect(crudColumnSupportsDataTablesOrder('MySqlJson')).toBe(false)
  })
})

describe('crudColumnSupportsDataTablesSearch', () => {
  test('allows text-like MySQL types only', () => {
    expect(crudColumnSupportsDataTablesSearch('MySqlVarChar')).toBe(true)
    expect(crudColumnSupportsDataTablesSearch('MySqlDouble')).toBe(false)
  })
})

describe('crudWrapperMainClass', () => {
  test('returns container-fluid when fullWidth', () => {
    expect(crudWrapperMainClass(true)).toBe('container-fluid page py-3 px-3')
  })

  test('returns undefined for default boxed layout', () => {
    expect(crudWrapperMainClass(false)).toBeUndefined()
  })
})

describe('crudWrapperPageData', () => {
  test('adds wrapperMainClass when fullWidth', () => {
    expect(crudWrapperPageData({ title: 'List' }, { fullWidth: true })).toEqual({
      title: 'List',
      wrapperMainClass: 'container-fluid page py-3 px-3',
    })
  })

  test('leaves data unchanged when not fullWidth', () => {
    const data = { title: 'List', readOnly: true }
    expect(crudWrapperPageData(data, { fullWidth: false })).toBe(data)
  })
})

describe('rowsToCrudCsv', () => {
  test('escapes commas and quotes', () => {
    const csv = rowsToCrudCsv(['a', 'b'], [{ a: 'hello', b: 'a,b' }, { a: 'say "hi"', b: '2' }])
    expect(csv).toBe('a,b\nhello,"a,b"\n"say ""hi""",2\n')
  })
})
