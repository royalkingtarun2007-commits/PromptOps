import { readFileSync } from 'fs'
import { join } from 'path'
import { db, closeDB } from './pool'
import 'dotenv/config'

async function migrate(): Promise<void> {
  console.log('🔄 Running database migrations...')

  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8')

  try {
    await db.query(sql)
    console.log('✅ Migrations complete')
  } catch (err) {
    console.error('❌ Migration failed:', err)
    process.exit(1)
  } finally {
    await closeDB()
  }
}

migrate()