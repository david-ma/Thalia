/**
 * Best-effort DB cleanup for **example-auth** integration tests.
 * Opens a short-lived pool per call (no shared state across files).
 */
import path from 'path'
import mysql from 'mysql2/promise'

const thaliaRoot = path.resolve(import.meta.dirname, '../..')

/** Remove sessions then user row (FK-safe). Ignores errors (best-effort cleanup). */
export async function deleteExampleAuthUserByEmail(email: string): Promise<void> {
  const cfg = await import(path.join(thaliaRoot, 'websites', 'example-auth', 'drizzle.config.ts'))
  const url = cfg.default.dbCredentials.url as string
  const pool = mysql.createPool(url)
  try {
    await pool.query('DELETE s FROM `sessions` s INNER JOIN `users` u ON s.`user_id` = u.`id` WHERE u.`email` = ?', [
      email,
    ])
    await pool.query('DELETE FROM `users` WHERE `email` = ?', [email])
  } catch {
    /* ignore */
  } finally {
    await pool.end()
  }
}
