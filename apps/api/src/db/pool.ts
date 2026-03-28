// apps/api/src/db/pool.ts
import { Pool } from 'pg'

export const db = new Pool({
  host: process.env.NODE_ENV === 'production' || process.env.PGHOST === 'postgres' 
    ? 'postgres' 
    : 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'promptops',
  user: process.env.PGUSER || 'promptops',
  password: process.env.PGPASSWORD || 'promptops',
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

export async function connectDB(): Promise<void> {
  const client = await db.connect()
  try {
    await client.query('SELECT 1')
    console.log('✅ Database connected')
  } finally {
    client.release()
  }
}

export async function closeDB(): Promise<void> {
  await db.end()
  console.log('Database pool closed')
}