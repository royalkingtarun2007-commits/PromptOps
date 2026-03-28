// apps/api/src/routes/apiKeys.ts
import { Router } from 'express'
import { z } from 'zod'
import { createHash, randomBytes } from 'crypto'
import { db } from '../db/pool'

export const apiKeysRouter = Router()

// POST /v1/api-keys - Create first key (no auth needed initially)
apiKeysRouter.post('/', async (req, res, next) => {
  try {
    // Get first workspace or create default
    let workspaceId = '00000000-0000-0000-0000-000000000000'

    const wsResult = await db.query('SELECT id FROM workspaces LIMIT 1')
    if (wsResult.rows.length > 0) {
      workspaceId = wsResult.rows[0].id
    } else {
      // Create default workspace if none exists
      const newWs = await db.query(`
        INSERT INTO workspaces (name, slug) 
        VALUES ('Default Team', 'default') 
        RETURNING id
      `)
      workspaceId = newWs.rows[0].id
    }

    const { name } = z.object({
      name: z.string().min(1).max(100),
    }).parse(req.body || { name: 'Default Key' })

    const rawKey = `po_live_${randomBytes(32).toString('hex')}`
    const keyPrefix = rawKey.slice(0, 16)
    const keyHash = createHash('sha256').update(rawKey).digest('hex')

    const result = await db.query(
      `INSERT INTO api_keys (workspace_id, name, key_hash, key_prefix, expires_at)
       VALUES ($1, $2, $3, $4, NULL)
       RETURNING id, name, key_prefix, created_at`,
      [workspaceId, name, keyHash, keyPrefix]
    )

    res.status(201).json({
      ...result.rows[0],
      key: rawKey,
      warning: 'Save this key now. It will not be shown again.',
    })
  } catch (err) {
    console.error('API Key error:', err)
    next(err)
  }
})

// GET /v1/api-keys
apiKeysRouter.get('/', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT id, name, key_prefix, last_used_at, expires_at, created_at
      FROM api_keys 
      ORDER BY created_at DESC
    `)
    res.json({ apiKeys: result.rows })
  } catch (err) {
    next(err)
  }
})