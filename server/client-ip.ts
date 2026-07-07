import type { IncomingHttpHeaders } from 'http'

/** Cloudflare published IPv4 ranges — https://www.cloudflare.com/ips-v4 */
export const CLOUDFLARE_IPV4_CIDRS = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
] as const

/** Loopback + RFC1918 — typical nginx-on-host → Docker bridge peers (e.g. 172.21.0.1). */
const DEFAULT_TRUSTED_PROXY_CIDRS = [
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
] as const

function trustedProxyCidrs(): readonly string[] {
  const env = process.env.THALIA_TRUSTED_PROXY_CIDRS
  if (env?.trim()) {
    return env.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return DEFAULT_TRUSTED_PROXY_CIDRS
}

/** First IP in `X-Forwarded-For` chains; strips IPv4-mapped IPv6 prefix. */
export function normaliseClientIp(ip: string): string {
  const first = ip.split(',')[0]?.trim() ?? ip.trim()
  return first.startsWith('::ffff:') ? first.slice(7) : first
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const part of parts) {
    const octet = Number(part)
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null
    n = (n << 8) | octet
  }
  return n >>> 0
}

export function ipv4MatchesCidr(ip: string, cidr: string): boolean {
  const slash = cidr.indexOf('/')
  const network = slash >= 0 ? cidr.slice(0, slash) : cidr
  const prefix = slash >= 0 ? Number(cidr.slice(slash + 1)) : 32
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false
  const ipInt = ipv4ToInt(normaliseClientIp(ip))
  const netInt = ipv4ToInt(network)
  if (ipInt === null || netInt === null) return false
  if (prefix === 0) return true
  const mask = prefix === 32 ? 0xffffffff : (~0 << (32 - prefix)) >>> 0
  return (ipInt & mask) === (netInt & mask)
}

/**
 * A cidr is a range of ips. This function checks if an ip is in any of the cidrs.
 */
export function ipMatchesAnyCidr(ip: string, cidrs: readonly string[]): boolean {
  const normalised = normaliseClientIp(ip)
  return cidrs.some((cidr) => ipv4MatchesCidr(normalised, cidr))
}

/** True when `clientIp` matches any comma-separated IPv4 literal or CIDR in `whitelist`. */
export function ipMatchesWhitelist(clientIp: string, whitelist: string): boolean {
  const ip = normaliseClientIp(clientIp)
  for (const entry of whitelist.split(',').map((s) => s.trim()).filter(Boolean)) {
    if (entry.includes('/')) {
      if (ipv4MatchesCidr(ip, entry)) return true
    } else if (ip === entry) {
      return true
    }
  }
  return false
}

function headerString(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value[0]
  return undefined
}

/**
 * Same-host or private-network TCP peer (nginx on localhost, or Docker bridge gateway).
 * Safe to trust proxy headers the reverse proxy sets (e.g. X-Real-IP).
 */
function isTrustedProxySocket(socketAddress: string | undefined): boolean {
  if (!socketAddress) return false
  const ip = normaliseClientIp(socketAddress)
  if (ip === '127.0.0.1' || ip === '::1') return true
  return ipMatchesAnyCidr(ip, trustedProxyCidrs())
}

/**
 * IP of the immediate upstream proxy (nginx TCP peer, or the socket when exposed directly).
 * When Thalia is behind nginx on localhost, `X-Real-IP` is nginx's `$remote_addr` and is authoritative.
 */
function peerIpForTrust(headers: IncomingHttpHeaders, socketAddress: string | undefined): string {
  const socket = normaliseClientIp(socketAddress ?? '')
  if (isTrustedProxySocket(socketAddress)) {
    return normaliseClientIp(headerString(headers['x-real-ip']) ?? socket)
  }
  return socket
}

/**
 * Resolve the client IP from proxy headers.
 * Trust `CF-Connecting-IP` when the immediate peer is Cloudflare or a trusted reverse proxy.
 */
export function resolveClientIp(headers: IncomingHttpHeaders, socketAddress?: string): string {
  const cfConnectingIp = headerString(headers['cf-connecting-ip'])
  const peerIp = peerIpForTrust(headers, socketAddress)

  if (
    cfConnectingIp &&
    peerIp &&
    (ipMatchesAnyCidr(peerIp, CLOUDFLARE_IPV4_CIDRS) || isTrustedProxySocket(socketAddress))
  ) {
    return normaliseClientIp(cfConnectingIp)
  }

  if (isTrustedProxySocket(socketAddress)) {
    const raw =
      headerString(headers['x-real-ip']) ??
      headerString(headers['x-forwarded-for']) ??
      headerString(headers['true-client-ip']) ??
      socketAddress ??
      'unknown-ip'
    return normaliseClientIp(raw)
  }

  // Direct exposure — only the TCP socket is trustworthy.
  return normaliseClientIp(socketAddress ?? 'unknown-ip')
}
