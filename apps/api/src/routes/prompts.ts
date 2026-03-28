// apps/api/src/routes/prompts.ts
import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db/pool'
import { requireApiKey } from '../middleware/auth'
import { NotFoundError, ConflictError } from '../middleware/errors'

// ── Router ─────────────────────────────────────────────────────────────
export const promptsRouter = Router()
promptsRouter.use(requireApiKey)

// ── Zod Schemas ────────────────────────────────────────────────────────
const createPromptSchema = z.object({
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/),
  name: z.string().min(3).max(200),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string().max(50)).default([]),
})

const createVersionSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string().min(1),
    })
  ),
  variables: z.array(z.string()).default([]),
  reviewNotes: z.string().optional(),
})

const updateStatusSchema = z.object({
  status: z.enum(['draft', 'in_review', 'approved', 'rejected', 'archived']),
  reviewNotes: z.string().optional(),
})

const promoteSchema = z.object({
  version_id: z.string().uuid(),
  environment: z.string().min(1).max(50),
})

// ── POST /v1/prompts ────────────────────────────── Create Prompt
promptsRouter.post('/', async (req, res, next) => {
  try {
    const { workspaceId } = req.auth!
    const { slug, name, description, tags } = createPromptSchema.parse(req.body)

    const result = await db.query(
      `INSERT INTO prompts (workspace_id, slug, name, description, tags, created_by)
       VALUES ($1, $2, $3, $4, $5, (SELECT id FROM users LIMIT 1))
       RETURNING id, slug, name, created_at`,
      [workspaceId, slug, name, description, tags]
    )

    res.status(201).json({ prompt: result.rows[0] })
  } catch (err) {
    next(err)
  }
})

// ── GET /v1/prompts ───────────────────────────────── List all Prompts
promptsRouter.get('/', async (req, res, next) => {
  try {
    const { workspaceId } = req.auth!
    const result = await db.query(`
      SELECT 
        p.id, p.slug, p.name, p.description, p.tags, p.updated_at,
        COUNT(pv.id)::int as version_count
      FROM prompts p
      LEFT JOIN prompt_versions pv ON pv.prompt_id = p.id
      WHERE p.workspace_id = $1
      GROUP BY p.id
      ORDER BY p.updated_at DESC
    `, [workspaceId])

    res.json({ prompts: result.rows })
  } catch (err) {
    next(err)
  }
})

// ── GET /v1/prompts/:slug ───────────────────────── Get Prompt + Latest Version
promptsRouter.get('/:slug', async (req, res, next) => {
  try {
    const { workspaceId } = req.auth!
    const { slug } = req.params

    const promptRes = await db.query(
      `SELECT * FROM prompts WHERE slug = $1 AND workspace_id = $2`,
      [slug, workspaceId]
    )
    const prompt = promptRes.rows[0]
    if (!prompt) throw new NotFoundError('Prompt')

    const versionRes = await db.query(
      `SELECT * FROM prompt_versions 
       WHERE prompt_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [prompt.id]
    )

    res.json({
      prompt,
      latestVersion: versionRes.rows[0] || null,
    })
  } catch (err) {
    next(err)
  }
})

// ── POST /v1/prompts/:slug/versions ─────────────── Create New Version
promptsRouter.post('/:slug/versions', async (req, res, next) => {
  try {
    const { workspaceId } = req.auth!
    const { slug } = req.params
    const { messages, variables, reviewNotes } = createVersionSchema.parse(req.body)

    const promptRes = await db.query(
      `SELECT id FROM prompts WHERE slug = $1 AND workspace_id = $2`,
      [slug, workspaceId]
    )
    const prompt = promptRes.rows[0]
    if (!prompt) throw new NotFoundError('Prompt')

    // Simple version numbering: v1, v2, ...
    const countRes = await db.query(
      `SELECT COUNT(*) as count FROM prompt_versions WHERE prompt_id = $1`,
      [prompt.id]
    )
    const nextVersion = `v${parseInt(countRes.rows[0].count) + 1}`

    const result = await db.query(
      `INSERT INTO prompt_versions 
        (prompt_id, version, messages, variables, status, created_by, review_notes)
       VALUES ($1, $2, $3, $4, 'draft', 
               (SELECT id FROM users LIMIT 1), $5)
       RETURNING *`,
      [prompt.id, nextVersion, messages, variables, reviewNotes]
    )

    res.status(201).json({ version: result.rows[0] })
  } catch (err) {
    next(err)
  }
})

// ── GET /v1/prompts/:slug/versions ──────────────── List All Versions
promptsRouter.get('/:slug/versions', async (req, res, next) => {
  try {
    const { workspaceId } = req.auth!
    const { slug } = req.params

    const promptRes = await db.query(
      `SELECT id FROM prompts WHERE slug = $1 AND workspace_id = $2`,
      [slug, workspaceId]
    )
    if (!promptRes.rows[0]) throw new NotFoundError('Prompt')

    const versions = await db.query(
      `SELECT * FROM prompt_versions 
       WHERE prompt_id = $1 
       ORDER BY created_at DESC`,
      [promptRes.rows[0].id]
    )

    res.json({ versions: versions.rows })
  } catch (err) {
    next(err)
  }
})

// ── PATCH /v1/prompts/:slug/versions/:versionId/status
promptsRouter.patch('/:slug/versions/:versionId/status', async (req, res, next) => {
  try {
    const { status, reviewNotes } = updateStatusSchema.parse(req.body)
    const { versionId } = req.params

    const result = await db.query(`
      UPDATE prompt_versions 
      SET status = $1,
          review_notes = COALESCE($2, review_notes),
          approved_by = CASE WHEN $1 = 'approved' THEN (SELECT id FROM users LIMIT 1) ELSE approved_by END,
          approved_at = CASE WHEN $1 = 'approved' THEN NOW() ELSE approved_at END
      WHERE id = $3
      RETURNING *
    `, [status, reviewNotes, versionId])

    if (result.rowCount === 0) throw new NotFoundError('Version')

    res.json({ version: result.rows[0] })
  } catch (err) {
    next(err)
  }
})

// ── POST /v1/prompts/:slug/promote ───────────────── Promote Version
promptsRouter.post('/:slug/promote', async (req, res, next) => {
  try {
    const { workspaceId } = req.auth!
    const { slug } = req.params
    const { version_id, environment } = promoteSchema.parse(req.body)

    const verRes = await db.query(`
      SELECT pv.prompt_id 
      FROM prompt_versions pv
      JOIN prompts p ON pv.prompt_id = p.id
      WHERE pv.id = $1 AND p.workspace_id = $2
    `, [version_id, workspaceId])

    if (!verRes.rows[0]) throw new NotFoundError('Version')

    await db.query(`
      INSERT INTO promotions (prompt_id, prompt_version_id, environment, promoted_by)
      VALUES ($1, $2, $3, (SELECT id FROM users LIMIT 1))
      ON CONFLICT (prompt_id, environment) 
      DO UPDATE SET 
        prompt_version_id = $2,
        promoted_by = (SELECT id FROM users LIMIT 1),
        promoted_at = NOW()
    `, [verRes.rows[0].prompt_id, version_id, environment])

    res.json({ message: `Successfully promoted to ${environment}` })
  } catch (err) {
    next(err)
  }
})