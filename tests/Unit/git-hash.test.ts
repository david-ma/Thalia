import { afterEach, describe, expect, test } from 'bun:test'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  findThaliaRoot,
  resolveGitHash,
  resolveThaliaGitHash,
  resolveWebsiteGitHash,
} from '../../server/git-hash'

const envKeys = ['THALIA_GIT_HASH', 'WEBSITE_GIT_HASH', 'THALIA_WEBSITE_GIT_HASH'] as const
const savedEnv: Record<string, string | undefined> = {}

function saveEnv() {
  for (const key of envKeys) savedEnv[key] = process.env[key]
}

function restoreEnv() {
  for (const key of envKeys) {
    if (savedEnv[key] === undefined) delete process.env[key]
    else process.env[key] = savedEnv[key]
  }
}

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2))
}

describe('git-hash', () => {
  afterEach(() => {
    restoreEnv()
  })

  test('resolveGitHash prefers env override', () => {
    expect(resolveGitHash('/tmp', 'abc1234')).toBe('abc1234')
  })

  test('resolveGitHash uses metadata fallback when no .git', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'thalia-githash-'))
    expect(resolveGitHash(dir, undefined, () => 'deadbeef')).toBe('deadbeef')
  })

  test('resolveGitHash returns unknown when nothing matches', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'thalia-githash-'))
    expect(resolveGitHash(dir)).toBe('unknown')
  })

  test('resolveThaliaGitHash reads .bun-tag from package install', () => {
    saveEnv()
    delete process.env.THALIA_GIT_HASH

    const siteRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'thalia-site-'))
    const thaliaRoot = path.join(siteRoot, 'node_modules', 'thalia')
    fs.mkdirSync(thaliaRoot, { recursive: true })
    fs.writeFileSync(path.join(thaliaRoot, '.bun-tag'), 'david-ma-Thalia-ce93b85\n')

    expect(resolveThaliaGitHash(thaliaRoot, siteRoot)).toBe('ce93b85')
  })

  test('resolveThaliaGitHash parses bun.lock github entry', () => {
    saveEnv()
    delete process.env.THALIA_GIT_HASH

    const siteRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'thalia-site-'))
    const thaliaRoot = path.join(siteRoot, 'node_modules', 'thalia')
    fs.mkdirSync(thaliaRoot, { recursive: true })
    writeJson(path.join(siteRoot, 'package.json'), { name: 'my-site' })
    fs.writeFileSync(
      path.join(siteRoot, 'bun.lock'),
      JSON.stringify(
        {
          packages: {
            'thalia@github:david-ma/Thalia#ce93b85': [
              'thalia@github:david-ma/Thalia#ce93b85',
              {},
              'david-ma-Thalia-ce93b85',
            ],
          },
        },
        null,
        2,
      ),
    )

    expect(resolveThaliaGitHash(thaliaRoot, siteRoot)).toBe('ce93b85')
  })

  test('resolveThaliaGitHash parses package-lock.json resolved git URL', () => {
    saveEnv()
    delete process.env.THALIA_GIT_HASH

    const siteRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'thalia-site-'))
    const thaliaRoot = path.join(siteRoot, 'node_modules', 'thalia')
    fs.mkdirSync(thaliaRoot, { recursive: true })
    writeJson(path.join(siteRoot, 'package-lock.json'), {
      packages: {
        'node_modules/thalia': {
          resolved: 'git+https://github.com/david-ma/Thalia.git#ce93b85',
        },
      },
    })

    expect(resolveThaliaGitHash(thaliaRoot, siteRoot)).toBe('ce93b85')
  })

  test('resolveThaliaGitHash uses THALIA_GIT_HASH env override', () => {
    saveEnv()
    process.env.THALIA_GIT_HASH = 'envhash'

    const siteRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'thalia-site-'))
    const thaliaRoot = path.join(siteRoot, 'node_modules', 'thalia')
    fs.mkdirSync(thaliaRoot, { recursive: true })

    expect(resolveThaliaGitHash(thaliaRoot, siteRoot)).toBe('envhash')
  })

  test('resolveWebsiteGitHash reads gitHash from package.json', () => {
    saveEnv()
    delete process.env.WEBSITE_GIT_HASH
    delete process.env.THALIA_WEBSITE_GIT_HASH

    const siteRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'thalia-site-'))
    writeJson(path.join(siteRoot, 'package.json'), { name: 'my-site', gitHash: 'site123' })

    expect(resolveWebsiteGitHash(siteRoot)).toBe('site123')
  })

  test('resolveWebsiteGitHash accepts THALIA_WEBSITE_GIT_HASH env override', () => {
    saveEnv()
    delete process.env.WEBSITE_GIT_HASH
    process.env.THALIA_WEBSITE_GIT_HASH = 'override'

    const siteRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'thalia-site-'))
    expect(resolveWebsiteGitHash(siteRoot)).toBe('override')
  })

  test('findThaliaRoot walks up to thalia package.json', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'thalia-root-'))
    writeJson(path.join(repoRoot, 'package.json'), { name: 'thalia', version: '1.0.0' })
    const nested = path.join(repoRoot, 'server')
    fs.mkdirSync(nested, { recursive: true })

    expect(findThaliaRoot(nested)).toBe(repoRoot)
  })
})
