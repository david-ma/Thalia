/**
 * Upsert integration-test users for example-auth (used by request-handler tests).
 *
 * Requires DATABASE_URL or readable docker-compose next to drizzle.config (same rules as drizzle.config.ts).
 *
 *   bun websites/example-auth/scripts/seed-test-users.ts   # from Thalia repo root
 */
import path from 'path'
import { fileURLToPath } from 'url'
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import { eq } from 'drizzle-orm'
import { users } from '../models/drizzle-schema.ts'
import { ThaliaSecurity } from '../../../server/security/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main(): Promise<void> {
  const configPath = path.join(__dirname, '..', 'drizzle.config.ts')
  const drizzleConfig = await import(configPath)
  const url = drizzleConfig.default.dbCredentials.url as string
  const pool = mysql.createPool(url)
  const db = drizzle(pool)

  const password = await ThaliaSecurity.hashPassword('test-password')
  const rows = [
    { email: 'user@example-auth.test', name: 'Test User', role: 'user' as const },
    { email: 'admin@example-auth.test', name: 'Test Admin', role: 'admin' as const },
  ]

  for (const row of rows) {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, row.email)).limit(1)
    if (existing.length === 0) {
      await db.insert(users).values({
        name: row.name,
        email: row.email,
        password,
        role: row.role,
        locked: false,
        verified: true,
      })
      console.log('Inserted', row.email)
    } else {
      await db
        .update(users)
        .set({
          password,
          name: row.name,
          role: row.role,
          verified: true,
          locked: false,
        })
        .where(eq(users.email, row.email))
      console.log('Updated', row.email)
    }
  }

  await pool.end()
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
