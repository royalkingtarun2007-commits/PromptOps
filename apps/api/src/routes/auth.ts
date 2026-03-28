import { Router } from 'express'
import { z } from 'zod'
import { createHash, randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { db } from '../db/pool'
import { requireApiKey } from '../middleware/auth'
import { AppError, ConflictError } from '../middleware/errors'

export const authRouter = Router()

// ── Schemas ───────────────────────────────────

const RegisterSchema = z.object({
  workspaceName: z.string().min(1).max(100),
  workspaceSlug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'slug must be lowercase with hyphens only'),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

// ── POST /v1/auth/register ────────────────────
// Creates workspace + first admin user + returns first API key
// This is the entry point for every new user

authRouter.post('/register', async (req, res, next) => {
  try {
    const body = RegisterSchema.parse(req.body)

    // Check workspace slug is unique
    const existingWorkspace = await db.query(
      'SELECT id FROM workspaces WHERE slug = $1',
      [body.workspaceSlug]
    )
    if ((existingWorkspace.rowCount ?? 0) > 0) {
      throw new ConflictError(`Workspace slug "${body.workspaceSlug}" is already taken.`)
    }

    // Check email is unique
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [body.email]
    )
    if ((existingUser.rowCount ?? 0) > 0) {
      throw new ConflictError('An account with this email already exists.')
    }

    const passwordHash = await bcrypt.hash(body.password, 12)

    // Create workspace + user + API key in one transaction
    const client = await db.connect()
    try {
      await client.query('BEGIN')

      // Create workspace
      const workspaceResult = await client.query(
        `INSERT INTO workspaces (name, slug) VALUES ($1, $2) RETURNING id`,
        [body.workspaceName, body.workspaceSlug]
      )
      const workspaceId = workspaceResult.rows[0].id

      // Create admin user
      const userResult = await client.query(
        `INSERT INTO users (workspace_id, email, name, role, password_hash)
         VALUES ($1, $2, $3, 'admin', $4) RETURNING id, email, name, role`,
        [workspaceId, body.email, body.name, passwordHash]
      )
      const user = userResult.rows[0]

      // Generate first API key automatically
      const rawKey = `po_live_${randomBytes(32).toString('hex')}`
      const keyPrefix = rawKey.slice(0, 16)
      const keyHash = createHash('sha256').update(rawKey).digest('hex')

      await client.query(
        `INSERT INTO api_keys (workspace_id, name, key_hash, key_prefix, created_by)
         VALUES ($1, 'Default Key', $2, $3, $4)`,
        [workspaceId, keyHash, keyPrefix, user.id]
      )

      await client.query('COMMIT')

      res.status(201).json({
        message: 'Workspace created successfully. Save your API key — it will not be shown again.',
        workspace: { id: workspaceId, name: body.workspaceName, slug: body.workspaceSlug },
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        apiKey: rawKey,
        warning: 'Copy this API key now and store it securely. It cannot be retrieved later.',
      })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    next(err)
  }
})

// ── POST /v1/auth/login ───────────────────────
// Verifies credentials and generates a fresh API key

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = LoginSchema.parse(req.body)

    // Find user
    const userResult = await db.query(
      `SELECT u.id, u.email, u.name, u.role, u.password_hash, u.workspace_id,
              w.name AS workspace_name, w.slug AS workspace_slug
       FROM users u
       JOIN workspaces w ON w.id = u.workspace_id
       WHERE u.email = $1
       LIMIT 1`,
      [body.email]
    )

    if (userResult.rowCount === 0) {
      // Use same error for both wrong email and wrong password (security best practice)
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password.', 401)
    }

    const user = userResult.rows[0]

    const passwordValid = await bcrypt.compare(body.password, user.password_hash)
    if (!passwordValid) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password.', 401)
    }

    // Generate a new API key on login
    const rawKey = `po_live_${randomBytes(32).toString('hex')}`
    const keyPrefix = rawKey.slice(0, 16)
    const keyHash = createHash('sha256').update(rawKey).digest('hex')

    await db.query(
      `INSERT INTO api_keys (workspace_id, name, key_hash, key_prefix, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.workspace_id, `Login key ${new Date().toISOString().slice(0, 10)}`, keyHash, keyPrefix, user.id]
    )

    res.json({
      message: 'Login successful.',
      workspace: { id: user.workspace_id, name: user.workspace_name, slug: user.workspace_slug },
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      apiKey: rawKey,
      warning: 'Copy this API key now. It cannot be retrieved later.',
    })
  } catch (err) {
    next(err)
  }
})

// ── GET /v1/auth/me ───────────────────────────
// Returns current user and workspace info — used by dashboard header

authRouter.get('/me', requireApiKey, async (req, res, next) => {
  try {
    const { workspaceId } = req.auth!

    const result = await db.query(
      `SELECT w.id AS workspace_id, w.name AS workspace_name, w.slug AS workspace_slug,
              w.created_at AS workspace_created_at,
              COUNT(DISTINCT p.id) AS prompt_count,
              COUNT(DISTINCT ak.id) AS key_count
       FROM workspaces w
       LEFT JOIN prompts p ON p.workspace_id = w.id
       LEFT JOIN api_keys ak ON ak.workspace_id = w.id
       WHERE w.id = $1
       GROUP BY w.id`,
      [workspaceId]
    )

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Workspace not found.' })
      return
    }

    const row = result.rows[0]

    res.json({
      workspace: {
        id: row.workspace_id,
        name: row.workspace_name,
        slug: row.workspace_slug,
        createdAt: row.workspace_created_at,
      },
      stats: {
        promptCount: parseInt(row.prompt_count),
        keyCount: parseInt(row.key_count),
      },
    })
  } catch (err) {
    next(err)
  }
})