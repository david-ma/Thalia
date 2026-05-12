import { describe, expect, test } from 'bun:test'
import {
  assertSafeHttpsImageFetchUrl,
  pickRemoteFileUrl,
} from '../../server/images/remote-image-fetch.js'

describe('pickRemoteFileUrl', () => {
  test('prefers uploadThingUrl over fileUrl and url', () => {
    expect(
      pickRemoteFileUrl({
        url: 'https://ignored.example/',
        fileUrl: 'https://file.example/',
        uploadThingUrl: 'https://uploadthing.example/foo',
      }),
    ).toBe('https://uploadthing.example/foo')
  })

  test('falls back across names', () => {
    expect(pickRemoteFileUrl({ url: '  https://u.example/bar  ' })).toBe('https://u.example/bar')
  })
})

describe('assertSafeHttpsImageFetchUrl', () => {
  test('allows public https API-style hosts', () => {
    expect(assertSafeHttpsImageFetchUrl('https://utfs.io/f/xyz').hostname).toBe('utfs.io')
  })

  test('rejects http', () => {
    expect(() => assertSafeHttpsImageFetchUrl('http://utfs.io/f')).toThrow(/Only https/)
  })

  test('rejects localhost and loopback IPs', () => {
    expect(() => assertSafeHttpsImageFetchUrl('https://localhost/secret')).toThrow(/host/)
    expect(() => assertSafeHttpsImageFetchUrl('https://127.45.67.89/x')).toThrow(/host/)
  })

  test('rejects private IPv4 literals', () => {
    expect(() => assertSafeHttpsImageFetchUrl('https://192.168.1.9/')).toThrow(/host/)
    expect(() => assertSafeHttpsImageFetchUrl('https://10.0.0.1/')).toThrow(/host/)
  })

  test('rejects URLs with embedded credentials', () => {
    expect(() => assertSafeHttpsImageFetchUrl('https://user:pass@utfs.io/f')).toThrow(/credentials/)
  })
})
