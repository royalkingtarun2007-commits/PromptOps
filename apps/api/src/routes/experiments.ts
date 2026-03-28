// apps/api/src/routes/experiments.ts
import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db/pool'
import { requireApiKey } from '../middleware/auth'
import { NotFoundError } from '../middleware/errors'

// ── Router (single export) ─────────────────────────────────────────────
export const experimentsRouter = Router()
experimentsRouter.use(requireApiKey)

// ── Zod Schemas ────────────────────────────────────────────────────────
const createExperimentSchema = z.object({
  prompt_id: z.string().uuid(),
  name: z.string().min(3).max(200),
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/),
  version_a_id: z.string().uuid(),
  version_b_id: z.string().uuid(),
  traffic_split: z.number().int().min(1).max(99).default(50),
})

const updateExperimentSchema = z.object({
  status: z.enum(['running', 'paused', 'completed']).optional(),
  winner: z.enum(['A', 'B']).optional(),
})

// ── POST /v1/experiments
experimentsRouter.post('/', async (req, res, next) => {
  try {
    const { workspaceId } = req.auth!
    const data = createExperimentSchema.parse(req.body)

    const result = await db.query(
      `INSERT INTO experiments 
        (workspace_id, prompt_id, name, slug, version_a_id, version_b_id, traffic_split, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT id FROM users LIMIT 1))
       RETURNING id, name, slug, status, traffic_split, created_at`,
      [workspaceId, data.prompt_id, data.name, data.slug, data.version_a_id, data.version_b_id, data.traffic_split]
    )

    res.status(201).json({ experiment: result.rows[0] })
  } catch (err) {
    next(err)
  }
})

// ── GET /v1/experiments
experimentsRouter.get('/', async (req, res, next) => {
  try {
    const { workspaceId } = req.auth!
    const result = await db.query(`
      SELECT 
        e.*,
        COUNT(CASE WHEN ei.variant = 'A' THEN 1 END) as impressions_a,
        COUNT(CASE WHEN ei.variant = 'B' THEN 1 END) as impressions_b
      FROM experiments e
      LEFT JOIN experiment_impressions ei ON ei.experiment_id = e.id
      WHERE e.workspace_id = $1
      GROUP BY e.id
      ORDER BY e.created_at DESC
    `, [workspaceId])

    res.json({ experiments: result.rows })
  } catch (err) {
    next(err)
  }
})

// ── POST /v1/experiments/:id/impressions
experimentsRouter.post('/:id/impressions', async (req, res, next) => {
  try {
    const { id } = req.params
    const { variant, userId } = z.object({
      variant: z.enum(['A', 'B']),
      userId: z.string().min(1),
    }).parse(req.body)

    await db.query(
      `INSERT INTO experiment_impressions (experiment_id, variant, user_id)
       VALUES ($1, $2, $3)`,
      [id, variant, userId]
    )

    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

// ── PATCH /v1/experiments/:id
experimentsRouter.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const { status, winner } = updateExperimentSchema.parse(req.body)

    const result = await db.query(
      `UPDATE experiments 
       SET status = COALESCE($1, status),
           winner = COALESCE($2, winner),
           completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END
       WHERE id = $3
       RETURNING *
    `, [status, winner, id])

    if (result.rowCount === 0) throw new NotFoundError('Experiment')

    res.json({ experiment: result.rows[0] })
  } catch (err) {
    next(err)
  }
})