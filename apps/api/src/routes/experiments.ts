import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db/pool'
import { requireApiKey } from '../middleware/auth'
import { NotFoundError } from '../middleware/errors'

export const experimentsRouter = Router()
experimentsRouter.use(requireApiKey)

// ── POST /v1/experiments/:slug/impressions ────
// Called by SDK automatically when ab() is used

experimentsRouter.post('/:slug/impressions', async (req, res, next) => {
  try {
    const { workspaceId } = req.auth!
    const { slug } = req.params
    const { variant, userId } = z.object({
      variant: z.enum(['A', 'B']),
      userId: z.string(),
    }).parse(req.body)

    const exp = await db.query(
      'SELECT id FROM experiments WHERE workspace_id = $1 AND slug = $2 AND status = $3',
      [workspaceId, slug, 'running']
    )

    if (exp.rowCount === 0) throw new NotFoundError(`Experiment "${slug}"`)

    await db.query(
      'INSERT INTO experiment_impressions (experiment_id, variant, user_id) VALUES ($1, $2, $3)',
      [exp.rows[0].id, variant, userId]
    )

    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// ── GET /v1/experiments ───────────────────────
// List all experiments with impression counts

experimentsRouter.get('/', async (req, res, next) => {
  try {
    const { workspaceId } = req.auth!

    const result = await db.query(
      `SELECT
        e.id, e.slug, e.name, e.status, e.traffic_split, e.winner,
        e.created_at, e.completed_at,
        COUNT(CASE WHEN ei.variant = 'A' THEN 1 END) AS impressions_a,
        COUNT(CASE WHEN ei.variant = 'B' THEN 1 END) AS impressions_b
      FROM experiments e
      LEFT JOIN experiment_impressions ei ON ei.experiment_id = e.id
      WHERE e.workspace_id = $1
      GROUP BY e.id
      ORDER BY e.created_at DESC`,
      [workspaceId]
    )

    res.json({ experiments: result.rows })
  } catch (err) {
    next(err)
  }
})

// ── POST /v1/experiments/:slug/winner ─────────
// Declare a winner and close the experiment

experimentsRouter.post('/:slug/winner', async (req, res, next) => {
  try {
    const { workspaceId } = req.auth!
    const { slug } = req.params
    const { winner } = z.object({ winner: z.enum(['A', 'B']) }).parse(req.body)

    const result = await db.query(
      `UPDATE experiments
       SET winner = $1, status = 'completed', completed_at = NOW()
       WHERE workspace_id = $2 AND slug = $3
       RETURNING id, name`,
      [winner, workspaceId, slug]
    )

    if (result.rowCount === 0) throw new NotFoundError(`Experiment "${slug}"`)

    res.json({
      message: `Variant ${winner} declared winner. Experiment closed.`,
      experiment: result.rows[0],
    })
  } catch (err) {
    next(err)
  }
})