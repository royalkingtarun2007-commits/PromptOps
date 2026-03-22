import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

import { connectDB, closeDB } from './db/pool'
import { promptsRouter } from './routes/prompts'
import { experimentsRouter } from './routes/experiments'
import { apiKeysRouter } from './routes/apiKeys'
import { errorHandler } from './middleware/errors'

// ── App Setup ─────────────────────────────────

const app = express()
const PORT = process.env['PORT'] ?? 3001

// ── Security Middleware ───────────────────────

app.use(helmet())

app.use(cors({
  origin: process.env['ALLOWED_ORIGINS']?.split(',') ?? '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type'],
}))

// Rate limiting — 200 requests per minute per IP
app.use(rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' },
}))

app.use(express.json({ limit: '1mb' }))

// ── Health Check ──────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  })
})

// ── Routes ────────────────────────────────────

app.use('/v1/prompts', promptsRouter)
app.use('/v1/experiments', experimentsRouter)
app.use('/v1/api-keys', apiKeysRouter)

// ── 404 Handler ───────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: 'Route not found. Check the PromptOps API docs.',
  })
})

// ── Error Handler (must be last) ──────────────

app.use(errorHandler)

// ── Start ─────────────────────────────────────

async function start() {
  try {
    await connectDB()
    app.listen(PORT, () => {
      console.log(`🚀 PromptOps API running on http://localhost:${PORT}`)
      console.log(`   Health: http://localhost:${PORT}/health`)
    })
  } catch (err) {
    console.error('Failed to start server:', err)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...')
  await closeDB()
  process.exit(0)
})

start()

export { app }