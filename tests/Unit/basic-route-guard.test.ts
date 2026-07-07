import { describe, test, expect } from 'bun:test'
import {
  basicPasswordAuthRequired,
} from '../../server/route-guard.js'
import {
  ipMatchesAnyCidr,
  ipMatchesWhitelist,
  ipv4MatchesCidr,
  normaliseClientIp,
  resolveClientIp,
} from '../../server/client-ip.js'
import type { RouteRule } from '../../server/types.js'

describe('normaliseClientIp', () => {
  test('takes the first address from X-Forwarded-For', () => {
    expect(normaliseClientIp('203.0.113.5, 10.0.0.1')).toBe('203.0.113.5')
  })

  test('strips IPv4-mapped IPv6 prefix', () => {
    expect(normaliseClientIp('::ffff:192.168.1.10')).toBe('192.168.1.10')
  })
})

describe('ipv4MatchesCidr', () => {
  test('matches addresses inside the network', () => {
    expect(ipv4MatchesCidr('104.16.0.42', '104.16.0.0/13')).toBe(true)
    expect(ipv4MatchesCidr('104.23.255.1', '104.16.0.0/13')).toBe(true)
    expect(ipv4MatchesCidr('8.8.8.8', '104.16.0.0/13')).toBe(false)
  })
})

describe('ipMatchesWhitelist', () => {
  test('matches exact IPv4 addresses', () => {
    expect(ipMatchesWhitelist('192.168.1.10', '192.168.1.10')).toBe(true)
    expect(ipMatchesWhitelist('192.168.1.11', '192.168.1.10')).toBe(false)
  })

  test('matches IPv4 CIDR blocks', () => {
    expect(ipMatchesWhitelist('192.168.0.42', '192.168.0.0/24')).toBe(true)
    expect(ipMatchesWhitelist('192.168.1.1', '192.168.0.0/24')).toBe(false)
  })

  test('supports comma-separated entries', () => {
    expect(ipMatchesWhitelist('10.0.0.5', '192.168.0.0/24, 10.0.0.0/8')).toBe(true)
    expect(ipMatchesWhitelist('8.8.8.8', '192.168.0.0/24, 10.0.0.0/8')).toBe(false)
  })
})

describe('ipMatchesAnyCidr', () => {
  test('matches Cloudflare edge addresses', () => {
    expect(ipMatchesAnyCidr('104.16.0.42', ['104.16.0.0/13'])).toBe(true)
    expect(ipMatchesAnyCidr('203.0.113.1', ['104.16.0.0/13'])).toBe(false)
  })
})

describe('resolveClientIp', () => {
  test('prefers nginx X-Real-IP for normal traffic', () => {
    expect(
      resolveClientIp({ 'x-real-ip': '203.0.113.10' }, '127.0.0.1'),
    ).toBe('203.0.113.10')
  })

  test('trusts CF-Connecting-IP when peer is a Cloudflare edge IP', () => {
    expect(
      resolveClientIp(
        {
          'x-real-ip': '104.16.0.42',
          'cf-connecting-ip': '203.0.113.99',
        },
        '127.0.0.1',
      ),
    ).toBe('203.0.113.99')
  })

  test('trusts CF-Connecting-IP when peer is loopback (nginx on same host)', () => {
    expect(
      resolveClientIp(
        {
          'x-real-ip': '203.0.113.10',
          'cf-connecting-ip': '198.51.100.20',
        },
        '127.0.0.1',
      ),
    ).toBe('198.51.100.20')
  })

  test('ignores forgeable headers when exposed directly (non-loopback socket)', () => {
    expect(
      resolveClientIp(
        {
          'x-real-ip': '104.16.0.42',
          'cf-connecting-ip': '192.168.0.50',
        },
        '203.0.113.10',
      ),
    ).toBe('203.0.113.10')
  })

  test('trusts nginx X-Real-IP when peer is a Docker bridge gateway', () => {
    expect(
      resolveClientIp({ 'x-real-ip': '203.0.113.10' }, '172.21.0.1'),
    ).toBe('203.0.113.10')
  })

  test('trusts CF-Connecting-IP when peer is a Docker bridge gateway', () => {
    expect(
      resolveClientIp(
        {
          'x-real-ip': '104.16.0.42',
          'cf-connecting-ip': '203.0.113.99',
        },
        '172.21.0.1',
      ),
    ).toBe('203.0.113.99')
  })
})

describe('basicPasswordAuthRequired', () => {
  const protectedRoute: RouteRule = {
    path: '/protected',
    password: 'secret',
    node_env: 'production',
    ip_whitelist: '192.168.0.0/24',
  }

  test('requires password in the configured environment for non-whitelisted IPs', () => {
    expect(basicPasswordAuthRequired(protectedRoute, 'production', '203.0.113.1')).toBe(true)
  })

  test('skips password outside the configured environment', () => {
    expect(basicPasswordAuthRequired(protectedRoute, 'development', '203.0.113.1')).toBe(false)
  })

  test('skips password for whitelisted IPs even in production', () => {
    expect(basicPasswordAuthRequired(protectedRoute, 'production', '192.168.0.50')).toBe(false)
  })

  test('returns false when no password is configured', () => {
    expect(basicPasswordAuthRequired({ path: '/open' }, 'production', '203.0.113.1')).toBe(false)
  })
})
