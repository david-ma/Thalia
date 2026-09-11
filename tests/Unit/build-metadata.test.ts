import { expect, test } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { captureBuildMetadata, runtimeIdentity } from '../../server/build-metadata'
import { resolveRevision } from '../../server/git-hash'
import { publicWebsiteVersion } from '../../server/health'
import type { Website } from '../../server/website'

test('Node and Bun report actual runtime independently of compatibility version', () => {
  expect(runtimeIdentity({ node: '24.3.0', bun: '1.4.1' })).toEqual({
    name: 'bun',
    version: '1.4.1',
    nodeCompatibilityVersion: '24.3.0',
  })
  expect(runtimeIdentity({ node: '24.3.0' }).name).toBe('node')
  expect(runtimeIdentity({}).version).toBeNull()
})

test('packaged identity, supplied revisions, unknown values and public boundary', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'thalia-meta-'))
  try {
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ name: 'service', version: '2.0', gitHash: 'abcdef0' }),
    )
    const metadata = captureBuildMetadata(root, '/nonexistent', {
      THALIA_BUILD_ID: 'build_123',
      THALIA_GIT_HASH: 'a'.repeat(40),
      NODE_ENV: 'private',
      THALIA_HEALTH_TOKEN: 'secret',
    })
    expect(metadata.diagnostics.revisions.application.source).toBe('package-metadata')
    expect(metadata.diagnostics.revisions.application.precision).toBe('abbreviated')
    expect(metadata.diagnostics.revisions.framework.source).toBe('environment')
    expect(metadata.diagnostics.revisions.framework.dirty).toBeNull()
    expect(metadata.identity.framework.version).toBeNull()
    expect(metadata.diagnostics.capturedAt).toMatch(/Z$/)
    expect(metadata.diagnostics.process.startedAt).toMatch(/Z$/)
    const publicInfo = publicWebsiteVersion({
      buildMetadata: metadata,
      version: { hostname: 'secret' },
    } as unknown as Website)
    for (const field of ['pid', 'platform', 'diagnostics', 'processStartTime', 'runtime', 'nodeVersion', 'serverMode'])
      expect(publicInfo).not.toHaveProperty(field)
    expect(JSON.stringify(publicInfo)).not.toContain('secret')
    expect(JSON.stringify(metadata)).not.toContain('secret')
    expect(publicInfo.gitHash).toBe('abcdef0')
    expect(publicInfo.thaliaGitHash).toBe('aaaaaaa')
    expect(publicInfo.identity?.framework.revision).toBe('aaaaaaa')
    expect(metadata.diagnostics.revisions.framework.revision).toBe('a'.repeat(40))
    expect(publicInfo.hostname).toBe(os.hostname())
    expect(publicInfo.NODE_ENV).toBe('private')
    expect(resolveRevision('/nonexistent').source).toBe('unknown')
    expect(resolveRevision('/nonexistent', 'unsafe token').revision).toBeNull()
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('local Git capture gives short revision and scoped dirty state', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'thalia-git-meta-'))
  try {
    execFileSync('git', ['init', '-q', root])
    execFileSync('git', [
      '-C',
      root,
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.invalid',
      'commit',
      '--allow-empty',
      '-qm',
      'fixture',
    ])
    expect(resolveRevision(root)).toMatchObject({
      source: 'git-at-startup',
      precision: 'abbreviated',
      dirty: false,
      dirtyScope: 'startup-checkout',
    })
    fs.writeFileSync(path.join(root, 'untracked'), 'fixture')
    expect(resolveRevision(root).dirty).toBe(true)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
