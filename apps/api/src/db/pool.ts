import { Pool } from 'pg'

// ── Connection Pool ────────────────────────────
// Reuses connections across requests for performance.
// Config is read from environment variables.

export const db = new Pool({
  connectionString: process.env['DATABASE_URL'],
  max: 20,                // max connections in pool
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

// Verify connection on startup
export async function connectDB(): Promise<void> {
  const client = await db.connect()
  try {
    await client.query('SELECT 1')
    console.log('✅ Database connected')
  } finally {
    client.release()
  }
}

// Graceful shutdown
export async function closeDB(): Promise<void> {
  await db.end()
  console.log('Database pool closed')
}