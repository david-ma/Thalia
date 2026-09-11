import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { captureRevisions } from './git-hash'

export function runtimeIdentity(versions: { bun?: string; node?: string }) {
  return {
    name: versions.bun ? 'bun' : versions.node ? 'node' : 'unknown',
    version: versions.bun ?? versions.node ?? null,
    nodeCompatibilityVersion: versions.node ?? null,
  }
}
function packageInfo(root: string): { name?: string; version?: string } {
  try {
    const value = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
    return value && typeof value === 'object' ? value : {}
  } catch {
    return {}
  }
}
const processStartedAt = new Date(Date.now() - process.uptime() * 1000).toISOString()
const instanceId = randomUUID()
export function captureBuildMetadata(siteRoot: string, frameworkRoot: string, env = process.env) {
  const revisions = captureRevisions(frameworkRoot, siteRoot, env)
  const app = packageInfo(siteRoot)
  const framework = packageInfo(frameworkRoot)
  // These values are explicitly public packaging inputs, never inferred from paths or hosts.
  const publicString = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const identity = {
    application: {
      id: publicString(env.THALIA_APPLICATION_ID ?? app.name),
      version: publicString(env.THALIA_APPLICATION_VERSION ?? app.version),
      revision: revisions.application.revision?.slice(0, 7) ?? null,
    },
    framework: { id: 'thalia', version: publicString(framework.version), revision: revisions.framework.revision?.slice(0, 7) ?? null },
    buildId: /^[a-zA-Z0-9_-]{1,128}$/.test(env.THALIA_BUILD_ID ?? '') ? env.THALIA_BUILD_ID! : null,
  }
  return {
    identity,
    diagnostics: {
      capturedAt: new Date().toISOString(),
      captureScope: 'website-construction' as const,
      observationScope: 'this-process-only' as const,
      revisions,
      process: {
        instanceId,
        deploymentId: publicString(env.THALIA_DEPLOYMENT_ID),
        startedAt: processStartedAt,
        runtime: runtimeIdentity(process.versions),
        hostname: os.hostname(),
        pid: process.pid,
        environment: env.NODE_ENV || 'development',
        platform: process.platform,
        architecture: process.arch,
      },
    },
  }
}
export type BuildMetadata = ReturnType<typeof captureBuildMetadata>
