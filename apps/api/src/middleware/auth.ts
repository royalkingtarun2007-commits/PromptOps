import type { Request, Response, NextFunction } from 'express'
import { createHash } from 'crypto'
import { db } from '../db/pool'

// ── Types ─────────────────────────────────────

export interface AuthContext {
  workspaceId: string
  keyId: string
  keyName: string
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext
    }
  }
}

// ── Middleware ────────────────────────────────

export async function requireApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization']

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Missing Authorization header. Use: Authorization: Bearer <your-api-key>',
    })
    return
  }

  const rawKey = authHeader.slice(7).trim()

  if (!rawKey) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'API key is empty.',
    })
    return
  }

  // Hash the key before DB lookup — we never store raw keys
  const keyHash = createHash('sha256').update(rawKey).digest('hex')

  try {
    const result = await db.query<{
      id: string
      workspace_id: string
      name: string
      expires_at: Date | null
    }>(
      `SELECT id, workspace_id, name, expires_at
       FROM api_keys
       WHERE key_hash = $1
       LIMIT 1`,
      [keyHash]
    )

    const key = result.rows[0]

    if (!key) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Invalid API key.',
      })
      return
    }

    if (key.expires_at && key.expires_at < new Date()) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'API key has expired.',
      })
      return
    }

    // Update last_used_at in background — don't await
    void db.query(
      'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
      [key.id]
    )

    req.auth = {
      workspaceId: key.workspace_id,
      keyId: key.id,
      keyName: key.name,
    }

    next()
  } catch (err) {
    console.error('Auth middleware error:', err)
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Authentication service error.',
    })
  }
}