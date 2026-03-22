import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db/pool'
import { requireApiKey } from '../middleware/auth'
import { NotFoundError, ConflictError } from '../middleware/errors'

export const promptsRouter = Router()

// All prompt routes require a valid API key
promptsRouter.use(requireApiKey)

// ── Schemas ───────────────────────────────────

const MessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1),
})

const CreatePromptSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'slug must be lowercase with hyphens only'),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  messages: z.array(MessageSchema).min(1),
  variables: z.array(z.string()).default([]),
})

const UpdateVersionSchema = z.object({
  messages: z.array(MessageSchema).min(1),
  variables: z.array(z.string()).default([]),
  review_notes: z.string().optional(),
})

const PromoteSchema = z.object({
  environment: z.string().min(1),
  version_id: z.string().uuid(),
})

// ── GET /v1/prompts ───────────────────────────
// List all prompts in the workspace

promptsRouter.get('/', async (req, res, next) => {
  try {
    const { workspaceId } = req.auth!
    const { tag, search } = req.query

    let query = `
      SELECT
        p.id, p.slug, p.name, p.description, p.tags,
        p.created_at, p.updated_at,
        COUNT(pv.id) AS version_count
      FROM prompts p
      LEFT JOIN prompt_versions pv ON pv.prompt_id = p.id
      WHERE p.workspace_id = $1
    `
    const params: unknown[] = [workspaceId]

    if (search) {
      params.push(`%${search}%`)
      query += ` AND (p.name ILIKE $${params.length} OR p.slug ILIKE $${params.length})`
    }

    if (tag) {
      params.push(tag)
      query += ` AND $${params.length} = ANY(p.tags)`
    }

    query += ' GROUP BY p.id ORDER BY p.updated_at DESC'

    const result = await db.query(query, params)
    res.json({ prompts: result.rows, total: result.rowCount })
  } catch (err) {
    next(err)
  }
})

// ── GET /v1/prompts/:slug ─────────────────────
// Fetch the active version of a prompt for a given environment
// This is the route the SDK calls

promptsRouter.get('/:slug', async (req, res, next) => {
  try {
    const { workspaceId } = req.auth!
    const { slug } = req.params
    const env = (req.query['env'] as string) || 'production'

    // Join through promotions to get the active version for this environment
    const result = await db.query(
      `SELECT
        p.id AS prompt_id,
        p.slug,
        p.name,
        p.tags,
        pv.id AS version_id,
        pv.version,
        pv.messages,
        pv.variables,
        pv.approved_at,
        u.email AS approved_by,
        pr.environment AS env
      FROM prompts p
      JOIN promotions pr ON pr.prompt_id = p.id
      JOIN prompt_versions pv ON pv.id = pr.prompt_version_id
      LEFT JOIN users u ON u.id = pv.approved_by
      WHERE p.workspace_id = $1
        AND p.slug = $2
        AND pr.environment = $3
      LIMIT 1`,
      [workspaceId, slug, env]
    )

    if (result.rowCount === 0) {
      throw new NotFoundError(`Prompt "${slug}" in environment "${env}"`)
    }

    const row = result.rows[0]

    // Return in the exact shape the SDK expects
    res.json({
      metadata: {
        slug: row.slug,
        name: row.name,
        version: row.version,
        env: row.env,
        workspace: workspaceId,
        approvedAt: row.approved_at,
        approvedBy: row.approved_by ?? 'system',
        tags: row.tags,
        variables: row.variables,
      },
      messages: row.messages,
    })
  } catch (err) {
    next(err)
  }
})

// ── GET /v1/prompts/:slug/versions ────────────
// List all versions of a prompt

promptsRouter.get('/:slug/versions', async (req, res, next) => {
  try {
    const { workspaceId } = req.auth!
    const { slug } = req.params

    const prompt = await getPromptBySlug(workspaceId, slug)

    const result = await db.query(
      `SELECT
        pv.id, pv.version, pv.status, pv.variables,
        pv.review_notes, pv.created_at, pv.approved_at,
        creator.email AS created_by,
        approver.email AS approved_by
      FROM prompt_versions pv
      LEFT JOIN users creator ON creator.id = pv.created_by
      LEFT JOIN users approver ON approver.id = pv.approved_by
      WHERE pv.prompt_id = $1
      ORDER BY pv.created_at DESC`,
      [prompt.id]
    )

    res.json({ versions: result.rows })
  } catch (err) {
    next(err)
  }
})

// ── GET /v1/prompts/:slug/versions/:version ───
// Fetch a specific pinned version (used by SDK when version is pinned)

promptsRouter.get('/:slug/versions/:version', async (req, res, next) => {
  try {
    const { workspaceId } = req.auth!
    const { slug, version } = req.params

    const result = await db.query(
      `SELECT
        p.slug, p.name, p.tags,
        pv.id, pv.version, pv.messages, pv.variables,
        pv.approved_at, u.email AS approved_by
      FROM prompts p
      JOIN prompt_versions pv ON pv.prompt_id = p.id
      LEFT JOIN users u ON u.id = pv.approved_by
      WHERE p.workspace_id = $1
        AND p.slug = $2
        AND pv.version = $3
      LIMIT 1`,
      [workspaceId, slug, version]
    )

    if (result.rowCount === 0) {
      throw new NotFoundError(`Prompt "${slug}" version "${version}"`)
    }

    const row = result.rows[0]

    res.json({
      metadata: {
        slug: row.slug,
        name: row.name,
        version: row.version,
        env: 'pinned',
        workspace: workspaceId,
        approvedAt: row.approved_at,
        approvedBy: row.approved_by ?? 'system',
        tags: row.tags,
        variables: row.variables,
      },
      messages: row.messages,
    })
  } catch (err) {
    next(err)
  }
})

// ── POST /v1/prompts ──────────────────────────
// Create a new prompt with its first version

promptsRouter.post('/', async (req, res, next) => {
  try {
    const { workspaceId } = req.auth!
    const body = CreatePromptSchema.parse(req.body)

    // Check slug is unique within workspace
    const existing = await db.query(
      'SELECT id FROM prompts WHERE workspace_id = $1 AND slug = $2',
      [workspaceId, body.slug]
    )

    if ((existing.rowCount ?? 0) > 0) {
      throw new ConflictError(`A prompt with slug "${body.slug}" already exists.`)
    }

    // Create prompt + first version in a transaction
    const client = await db.connect()
    try {
      await client.query('BEGIN')

      const promptResult = await client.query(
        `INSERT INTO prompts (workspace_id, slug, name, description, tags)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [workspaceId, body.slug, body.name, body.description ?? null, body.tags]
      )

      const promptId = promptResult.rows[0].id

      const versionResult = await client.query(
        `INSERT INTO prompt_versions (prompt_id, version, messages, variables, status)
         VALUES ($1, 'v1', $2, $3, 'draft')
         RETURNING id, version`,
        [promptId, JSON.stringify(body.messages), body.variables]
      )

      await client.query('COMMIT')

      res.status(201).json({
        id: promptId,
        slug: body.slug,
        name: body.name,
        version: versionResult.rows[0],
        message: 'Prompt created. Promote a version to an environment to make it available via the SDK.',
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

// ── POST /v1/prompts/:slug/versions ───────────
// Add a new version to an existing prompt

promptsRouter.post('/:slug/versions', async (req, res, next) => {
  try {
    const { workspaceId } = req.auth!
    const { slug } = req.params
    const body = UpdateVersionSchema.parse(req.body)

    const prompt = await getPromptBySlug(workspaceId, slug)

    // Get the latest version number and increment
    const latestResult = await db.query(
      `SELECT version FROM prompt_versions
       WHERE prompt_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [prompt.id]
    )

    const latest = latestResult.rows[0]?.version ?? 'v0'
    const nextNum = parseInt(latest.replace('v', ''), 10) + 1
    const nextVersion = `v${nextNum}`

    const result = await db.query(
      `INSERT INTO prompt_versions (prompt_id, version, messages, variables, review_notes, status)
       VALUES ($1, $2, $3, $4, $5, 'draft')
       RETURNING id, version, status, created_at`,
      [prompt.id, nextVersion, JSON.stringify(body.messages), body.variables, body.review_notes ?? null]
    )

    res.status(201).json({
      promptSlug: slug,
      version: result.rows[0],
      message: `Version ${nextVersion} created as draft. Submit for review to promote it.`,
    })
  } catch (err) {
    next(err)
  }
})

// ── POST /v1/prompts/:slug/promote ───────────
// Promote a version to an environment (e.g. production, staging)

promptsRouter.post('/:slug/promote', async (req, res, next) => {
  try {
    const { workspaceId } = req.auth!
    const { slug } = req.params
    const body = PromoteSchema.parse(req.body)

    const prompt = await getPromptBySlug(workspaceId, slug)

    // Verify the version exists and is approved
    const versionResult = await db.query(
      `SELECT id, version, status FROM prompt_versions
       WHERE id = $1 AND prompt_id = $2`,
      [body.version_id, prompt.id]
    )

    if (versionResult.rowCount === 0) {
      throw new NotFoundError('Prompt version')
    }

    const version = versionResult.rows[0]

    if (version.status !== 'approved') {
      throw new Error(`Only approved versions can be promoted. This version is "${version.status}".`)
    }

    // Upsert the promotion (replace any existing promotion for this environment)
    await db.query(
      `INSERT INTO promotions (prompt_id, prompt_version_id, environment)
       VALUES ($1, $2, $3)
       ON CONFLICT (prompt_id, environment)
       DO UPDATE SET prompt_version_id = $2, promoted_at = NOW()`,
      [prompt.id, body.version_id, body.environment]
    )

    res.json({
      message: `Version ${version.version} is now live in "${body.environment}".`,
      slug,
      version: version.version,
      environment: body.environment,
    })
  } catch (err) {
    next(err)
  }
})

// ── PATCH /v1/prompts/:slug/versions/:versionId/status ───
// Approve or reject a version (reviewer action)

promptsRouter.patch('/:slug/versions/:versionId/status', async (req, res, next) => {
  try {
    const { workspaceId } = req.auth!
    const { slug, versionId } = req.params
    const { status, review_notes } = z.object({
      status: z.enum(['approved', 'rejected', 'in_review']),
      review_notes: z.string().optional(),
    }).parse(req.body)

    const prompt = await getPromptBySlug(workspaceId, slug)

    const result = await db.query(
      `UPDATE prompt_versions
       SET status = $1,
           review_notes = COALESCE($2, review_notes),
           approved_at = CASE WHEN $1 = 'approved' THEN NOW() ELSE NULL END
       WHERE id = $3 AND prompt_id = $4
       RETURNING id, version, status`,
      [status, review_notes ?? null, versionId, prompt.id]
    )

    if (result.rowCount === 0) {
      throw new NotFoundError('Prompt version')
    }

    res.json({
      message: `Version ${result.rows[0].version} is now "${status}".`,
      version: result.rows[0],
    })
  } catch (err) {
    next(err)
  }
})

// ── Helpers ───────────────────────────────────

async function getPromptBySlug(workspaceId: string, slug: string) {
  const result = await db.query(
    'SELECT id, slug, name FROM prompts WHERE workspace_id = $1 AND slug = $2',
    [workspaceId, slug]
  )
  if (result.rowCount === 0) throw new NotFoundError(`Prompt "${slug}"`)
  return result.rows[0] as { id: string; slug: string; name: string }
}