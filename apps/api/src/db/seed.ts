import { db } from './pool'
import { createHash, randomBytes } from 'crypto'
import 'dotenv/config'

async function seed() {
  console.log('Seeding database...')
  try {
    await db.query(`
      INSERT INTO workspaces (name, slug)
      VALUES ('Default Team', 'default')
      ON CONFLICT (slug) DO NOTHING
    `)

    const ws = await db.query(`SELECT id FROM workspaces WHERE slug = 'default'`)
    const workspaceId = ws.rows[0].id

    const bcrypt = await import('bcryptjs')
    const passwordHash = await bcrypt.default.hash('Password123!', 12)

    await db.query(`
      INSERT INTO users (workspace_id, email, name, password_hash, role)
      VALUES ($1, 'admin@promptops.dev', 'Admin', $2, 'admin')
      ON CONFLICT (email) DO NOTHING
    `, [workspaceId, passwordHash])

    const promptRes = await db.query(`
      INSERT INTO prompts (workspace_id, slug, name, description, tags)
      VALUES ($1, 'summarise-email', 'Summarise Email',
              'Converts long emails into 3 bullet points', ARRAY['email','summary'])
      ON CONFLICT (workspace_id, slug) DO NOTHING
      RETURNING id
    `, [workspaceId])

    if (!promptRes.rows[0]) {
      console.log('Seed data already exists.')
      await db.end(); return
    }

    const promptId = promptRes.rows[0].id

    const versionRes = await db.query(`
      INSERT INTO prompt_versions (prompt_id, version, messages, variables, status)
      VALUES ($1, 'v1',
        '[{"role":"system","content":"Summarise in a {{tone}} tone using 3 bullet points."},
          {"role":"user","content":"Summarise this email:\n\n{{email}}"}]',
        ARRAY['email','tone'], 'approved')
      RETURNING id
    `, [promptId])

    await db.query(`
      INSERT INTO promotions (prompt_id, prompt_version_id, environment)
      VALUES ($1, $2, 'production')
      ON CONFLICT DO NOTHING
    `, [promptId, versionRes.rows[0].id])

    const rawKey = `po_live_${randomBytes(32).toString('hex')}`
    const keyHash = createHash('sha256').update(rawKey).digest('hex')

    await db.query(`
      INSERT INTO api_keys (workspace_id, name, key_hash, key_prefix)
      VALUES ($1, 'Seed Key', $2, $3)
    `, [workspaceId, keyHash, rawKey.slice(0, 16)])

    console.log('Seed complete.')
    console.log('  Login: admin@promptops.dev / Password123!')
    console.log('  API Key:', rawKey)
  } catch (err: any) {
    console.error('Seed failed:', err.message)
  } finally {
    await db.end()
  }
}

seed()