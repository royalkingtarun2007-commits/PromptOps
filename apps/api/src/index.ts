import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

import { connectDB, closeDB } from './db/pool'
import { authRouter } from './routes/auth'
import { promptsRouter } from './routes/prompts'
import { experimentsRouter } from './routes/experiments'
import { apiKeysRouter } from './routes/apiKeys'
import { errorHandler } from './middleware/errors'

const app = express()
const PORT = process.env['PORT'] ?? 3001

app.use(helmet())
app.use(cors({
  origin: process.env['ALLOWED_ORIGINS']?.split(',') ?? '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type'],
}))

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 20,
  message: { error: 'RATE_LIMITED', message: 'Too many auth attempts. Try again in 15 minutes.' },
})

app.use(rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' },
}))

app.use(express.json({ limit: '1mb' }))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0', timestamp: new Date().toISOString() })
})

app.use('/v1/auth', authLimiter, authRouter)
app.use('/v1/prompts', promptsRouter)
app.use('/v1/experiments', experimentsRouter)
app.use('/v1/api-keys', apiKeysRouter)

app.use((_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Route not found. Check the PromptOps API docs.' })
})

app.use(errorHandler)

async function start() {
  try {
    await connectDB()
    app.listen(PORT, () => {
      console.log(`🚀 PromptOps API running on http://localhost:${PORT}`)
      console.log(`   Health:   http://localhost:${PORT}/health`)
      console.log(`   Register: POST http://localhost:${PORT}/v1/auth/register`)
    })
  } catch (err) {
    console.error('Failed to start server:', err)
    process.exit(1)
  }
}

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...')
  await closeDB()
  process.exit(0)
})

start()

export { app }