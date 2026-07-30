/**
 * Best-effort DB cleanup for **example-auth** integration tests.
 * Opens a short-lived pool per call (no shared state across files).
 */
import path from 'path'
import mysql from 'mysql2/promise'

const thaliaRoot = path.resolve(import.meta.dirname, '../..')

async function withExampleAuthPool<T>(fn: (pool: mysql.Pool) => Promise<T>): Promise<T> {
  const cfg = await import(path.join(thaliaRoot, 'websites', 'example-auth', 'drizzle.config.ts'))
  const url = cfg.default.dbCredentials.url as string
  const pool = mysql.createPool(url)
  try {
    return await fn(pool)
  } finally {
    await pool.end()
  }
}

/**
 * Insert an audits row pointing at a live session (reproduces FK errno 1451 on hard DELETE).
 */
export async function insertExampleAuthAuditForSession(
  email: string,
  sessionId: string,
  action = 'test-soft-revoke-fixture',
): Promise<void> {
  await withExampleAuthPool(async (pool) => {
    const [rows] = await pool.query('SELECT `id` FROM `users` WHERE `email` = ? LIMIT 1', [email])
    const userRows = rows as Array<{ id: number }>
    const userId = userRows[0]?.id
    if (userId == null) throw new Error(`No user for email ${email}`)
    await pool.query(
      'INSERT INTO `audits` (`user_id`, `ip`, `session_id`, `action`, `blob`, `timestamp`) VALUES (?, ?, ?, ?, NULL, NOW())',
      [userId, '127.0.0.1', sessionId, action],
    )
  })
}

/** Read `logged_out` for a session sid (null if missing). */
export async function getExampleAuthSessionLoggedOut(sid: string): Promise<boolean | null> {
  return withExampleAuthPool(async (pool) => {
    const [rows] = await pool.query('SELECT `logged_out` FROM `sessions` WHERE `sid` = ? LIMIT 1', [sid])
    const sessionRows = rows as Array<{ logged_out: number | boolean }>
    if (!sessionRows[0]) return null
    return Boolean(sessionRows[0].logged_out)
  })
}

/**
 * Remove audits → sessions → user (FK-safe).
 * Sessions may remain after soft-revoke and still be referenced by audits;
 * hard-DELETE of sessions fails with errno 1451 unless audits go first.
 */
export async function deleteExampleAuthUserByEmail(email: string): Promise<void> {
  try {
    await withExampleAuthPool(async (pool) => {
      await pool.query(
        'DELETE a FROM `audits` a INNER JOIN `users` u ON a.`user_id` = u.`id` WHERE u.`email` = ?',
        [email],
      )
      await pool.query(
        'DELETE a FROM `audits` a INNER JOIN `sessions` s ON a.`session_id` = s.`sid` INNER JOIN `users` u ON s.`user_id` = u.`id` WHERE u.`email` = ?',
        [email],
      )
      await pool.query('DELETE s FROM `sessions` s INNER JOIN `users` u ON s.`user_id` = u.`id` WHERE u.`email` = ?', [
        email,
      ])
      await pool.query('DELETE FROM `users` WHERE `email` = ?', [email])
    })
  } catch {
    /* ignore */
  }
}
