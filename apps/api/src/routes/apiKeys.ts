import { Router } from 'express'
import { z } from 'zod'
import { createHash, randomBytes } from 'crypto'
import { db } from '../db/pool'
import { requireApiKey } from '../middleware/auth'

export const apiKeysRouter = Router()
apiKeysRouter.use(requireApiKey)

// ── POST /v1/api-keys ─────────────────────────
// Generate a new API key for the workspace

apiKeysRouter.post('/', async (req, res, next) => {
  try {
    const { workspaceId } = req.auth!
    const { name, expiresInDays } = z.object({
      name: z.string().min(1).max(100),
      expiresInDays: z.number().int().positive().optional(),
    }).parse(req.body)

    // Generate a secure random key with a readable prefix
    const rawKey = `po_live_${randomBytes(32).toString('hex')}`
    const keyPrefix = rawKey.slice(0, 16)
    const keyHash = createHash('sha256').update(rawKey).digest('hex')

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86_400_000)
      : null

    const result = await db.query(
      `INSERT INTO api_keys (workspace_id, name, key_hash, key_prefix, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, key_prefix, expires_at, created_at`,
      [workspaceId, name, keyHash, keyPrefix, expiresAt]
    )

    // Return the raw key ONCE — we never store it
    res.status(201).json({
      ...result.rows[0],
      key: rawKey,
      warning: 'Save this key now. It will not be shown again.',
    })
  } catch (err) {
    next(err)
  }
})

// ── GET /v1/api-keys ──────────────────────────
// List all API keys (prefixes only, never full keys)

apiKeysRouter.get('/', async (req, res, next) => {
  try {
    const { workspaceId } = req.auth!

    const result = await db.query(
      `SELECT id, name, key_prefix, last_used_at, expires_at, created_at
       FROM api_keys
       WHERE workspace_id = $1
       ORDER BY created_at DESC`,
      [workspaceId]
    )

    res.json({ apiKeys: result.rows })
  } catch (err) {
    next(err)
  }
})

// ── DELETE /v1/api-keys/:id ───────────────────
// Revoke an API key immediately

apiKeysRouter.delete('/:id', async (req, res, next) => {
  try {
    const { workspaceId } = req.auth!

    await db.query(
      'DELETE FROM api_keys WHERE id = $1 AND workspace_id = $2',
      [req.params['id'], workspaceId]
    )

    res.json({ message: 'API key revoked.' })
  } catch (err) {
    next(err)
  }
})