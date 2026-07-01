import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

/** Strip JSONC comments so bun.lock can be parsed. */
function stripJsonComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function hashFromGitRef(ref: string): string | undefined {
  const match = ref.match(/#([0-9a-f]{7,40})\b/i)
  return match?.[1]
}

function hashFromBunTag(tag: string): string | undefined {
  const hash = tag.split('-').pop()
  if (hash && /^[0-9a-f]{7,40}$/i.test(hash)) return hash
  return undefined
}

function gitHashFromDirectory(cwd: string): string | undefined {
  if (!fs.existsSync(path.join(cwd, '.git'))) return undefined
  try {
    return execSync('git rev-parse --short HEAD', { cwd }).toString().trim()
  } catch {
    return undefined
  }
}

export function resolveGitHash(
  cwd: string,
  envOverride?: string,
  metadataFallback?: () => string | undefined,
): string {
  const fromEnv = envOverride?.trim()
  if (fromEnv) return fromEnv

  const fromGit = gitHashFromDirectory(cwd)
  if (fromGit) return fromGit

  const fromMetadata = metadataFallback?.()
  if (fromMetadata) return fromMetadata

  return 'unknown'
}

export function findThaliaRoot(startDir: string): string {
  let dir = startDir
  while (dir !== path.dirname(dir)) {
    const packageJsonPath = path.join(dir, 'package.json')
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
        if (pkg.name === 'thalia') return dir
      } catch {
        // Not valid JSON, continue searching
      }
    }
    dir = path.dirname(dir)
  }
  return startDir
}

function thaliaHashFromBunTag(thaliaRoot: string): string | undefined {
  const bunTagPath = path.join(thaliaRoot, '.bun-tag')
  if (!fs.existsSync(bunTagPath)) return undefined
  try {
    const tag = fs.readFileSync(bunTagPath, 'utf8').trim()
    return hashFromBunTag(tag)
  } catch {
    return undefined
  }
}

function thaliaHashFromBunLock(siteRoot: string): string | undefined {
  const lockPath = path.join(siteRoot, 'bun.lock')
  if (!fs.existsSync(lockPath)) return undefined
  try {
    const parsed = JSON.parse(stripJsonComments(fs.readFileSync(lockPath, 'utf8'))) as {
      packages?: Record<string, unknown[]>
    }
    for (const [key, value] of Object.entries(parsed.packages ?? {})) {
      if (!key.startsWith('thalia@github:') && !key.startsWith('thalia@git')) continue
      const fromKey = hashFromGitRef(key)
      if (fromKey) return fromKey
      if (!Array.isArray(value)) continue
      for (const entry of value) {
        if (typeof entry !== 'string') continue
        const fromEntry = hashFromGitRef(entry) ?? hashFromBunTag(entry)
        if (fromEntry) return fromEntry
      }
    }
  } catch {
    return undefined
  }
  return undefined
}

function thaliaHashFromPackageLock(siteRoot: string): string | undefined {
  const lockPath = path.join(siteRoot, 'package-lock.json')
  if (!fs.existsSync(lockPath)) return undefined
  try {
    const parsed = JSON.parse(fs.readFileSync(lockPath, 'utf8'))
    return findThaliaHashInLockObject(parsed)
  } catch {
    return undefined
  }
}

function findThaliaHashInLockObject(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findThaliaHashInLockObject(item)
      if (found) return found
    }
    return undefined
  }
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if ((key === 'thalia' || key.endsWith('/thalia')) && entry && typeof entry === 'object') {
      const resolved = (entry as { resolved?: string }).resolved
      if (resolved) {
        const fromResolved = hashFromGitRef(resolved)
        if (fromResolved) return fromResolved
      }
    }
    const nested = findThaliaHashInLockObject(entry)
    if (nested) return nested
  }
  return undefined
}

function thaliaInstallHash(thaliaRoot: string, siteRoot: string): string | undefined {
  return (
    thaliaHashFromBunTag(thaliaRoot) ??
    thaliaHashFromBunLock(siteRoot) ??
    thaliaHashFromPackageLock(siteRoot)
  )
}

function websiteHashFromPackageJson(siteRoot: string): string | undefined {
  const pkgPath = path.join(siteRoot, 'package.json')
  if (!fs.existsSync(pkgPath)) return undefined
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    const hash = pkg.gitHash
    if (typeof hash === 'string' && hash.trim()) return hash.trim()
  } catch {
    return undefined
  }
  return undefined
}

export function resolveThaliaGitHash(thaliaRoot: string, siteRoot: string): string {
  return resolveGitHash(thaliaRoot, process.env.THALIA_GIT_HASH, () =>
    thaliaInstallHash(thaliaRoot, siteRoot),
  )
}

export function resolveWebsiteGitHash(siteRoot: string): string {
  const envOverride = process.env.WEBSITE_GIT_HASH ?? process.env.THALIA_WEBSITE_GIT_HASH
  return resolveGitHash(siteRoot, envOverride, () => websiteHashFromPackageJson(siteRoot))
}
