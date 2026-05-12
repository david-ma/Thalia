/**
 * Drizzle mysql2 `insert().values()` resolves to mysql2's query result tuple
 * `[ResultSetHeader, FieldPacket[]]` when the driver runs a raw INSERT — not a bare header.
 * Extract `insertId` for follow-up `SELECT` by primary key.
 */
export function mysqlInsertIdFromDrizzleMysql2Result(result: unknown): number | undefined {
  let header: { insertId?: number | bigint } | undefined
  if (result != null && typeof result === 'object') {
    if (Array.isArray(result) && result.length > 0) {
      const first = result[0]
      if (first != null && typeof first === 'object' && 'insertId' in first) {
        header = first as { insertId?: number | bigint }
      }
    } else if ('insertId' in result) {
      header = result as { insertId?: number | bigint }
    }
  }
  if (header == null) return undefined
  const raw = header.insertId
  if (raw === undefined) return undefined
  return typeof raw === 'bigint' ? Number(raw) : raw
}
