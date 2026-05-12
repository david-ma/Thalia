import { describe, expect, test } from 'bun:test'
import { images } from '../../models/images.js'

describe('images.notesBlob (LONGBLOB JSON)', () => {
  const col = images.notesBlob

  test('SQL type is longblob', () => {
    expect(col.getSQLType()).toBe('longblob')
  })

  test('mapToDriverValue: null stays null', () => {
    expect(col.mapToDriverValue(null as never)).toBeNull()
  })

  test('mapToDriverValue: empty or whitespace-only string becomes null', () => {
    expect(col.mapToDriverValue('' as never)).toBeNull()
    expect(col.mapToDriverValue('   \n\t  ' as never)).toBeNull()
  })

  test('mapToDriverValue: object serializes to UTF-8 JSON bytes', () => {
    const buf = col.mapToDriverValue({ text: 'hello', count: 2 })
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(JSON.parse((buf as Buffer).toString('utf8'))).toEqual({ text: 'hello', count: 2 })
  })

  test('mapToDriverValue: string is stored as raw UTF-8 (form / pre-encoded JSON path)', () => {
    const json = '{"text":"from form","extra":true}'
    const buf = col.mapToDriverValue(json as never)
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect((buf as Buffer).toString('utf8')).toBe(json)
  })

  test('mapFromDriverValue: null and empty buffer become null', () => {
    expect(col.mapFromDriverValue(null as never)).toBeNull()
    expect(col.mapFromDriverValue(Buffer.alloc(0) as never)).toBeNull()
  })

  test('mapFromDriverValue: UTF-8 JSON object round-trips', () => {
    const obj = { text: 'note', tags: ['a', 'b'], nested: { ok: true } }
    const buf = col.mapToDriverValue(obj)!
    expect(col.mapFromDriverValue(buf as never)).toEqual(obj)
  })

  test('mapFromDriverValue: rejects JSON array at root', () => {
    const buf = Buffer.from('[1,2]', 'utf8')
    expect(col.mapFromDriverValue(buf as never)).toBeNull()
  })

  test('mapFromDriverValue: rejects JSON primitive at root', () => {
    expect(col.mapFromDriverValue(Buffer.from('"hello"', 'utf8') as never)).toBeNull()
    expect(col.mapFromDriverValue(Buffer.from('42', 'utf8') as never)).toBeNull()
  })

  test('mapFromDriverValue: invalid JSON returns null', () => {
    expect(col.mapFromDriverValue(Buffer.from('{broken', 'utf8') as never)).toBeNull()
  })

  test('mapFromDriverValue: accepts Uint8Array from driver', () => {
    const buf = col.mapToDriverValue({ a: 1 })!
    const u8 = new Uint8Array(buf)
    expect(col.mapFromDriverValue(u8 as never)).toEqual({ a: 1 })
  })
})
