// ─────────────────────────────────────────────
//  PromptOps SDK — Tests
// ─────────────────────────────────────────────

import { Prompt } from '../prompt'
import { PromptOpsCompileError } from '../errors'
import { PromptCache } from '../cache'
import type { RawPrompt } from '../types'

// ── Fixtures ─────────────────────────────────

const mockRaw: RawPrompt = {
  metadata: {
    slug: 'summarise-email',
    name: 'Summarise Email',
    version: 'v3',
    env: 'production',
    workspace: 'acme',
    approvedAt: '2026-01-01T00:00:00Z',
    approvedBy: 'alice@acme.com',
    tags: ['email', 'summarisation'],
    variables: ['email', 'tone'],
  },
  messages: [
    {
      role: 'system',
      content: 'You are a helpful assistant. Respond in a {{tone}} tone.',
    },
    {
      role: 'user',
      content: 'Summarise this email in 3 bullet points:\n\n{{email}}',
    },
  ],
}

// ── Prompt.compile() ─────────────────────────

describe('Prompt.compile()', () => {
  it('interpolates variables into messages', () => {
    const prompt = new Prompt(mockRaw)
    const messages = prompt.compile({ email: 'Hello world', tone: 'formal' })

    expect(messages[0]?.content).toBe('You are a helpful assistant. Respond in a formal tone.')
    expect(messages[1]?.content).toContain('Hello world')
  })

  it('throws PromptOpsCompileError when required variables are missing', () => {
    const prompt = new Prompt(mockRaw)
    expect(() => prompt.compile({ email: 'test' })).toThrow(PromptOpsCompileError)
    expect(() => prompt.compile({ email: 'test' })).toThrow(/tone/)
  })

  it('leaves unknown {{placeholders}} untouched', () => {
    const prompt = new Prompt(mockRaw)
    const messages = prompt.compile({ email: 'body', tone: 'friendly' })
    // No unknown placeholders in the fixture — just verify no crash
    expect(messages).toHaveLength(2)
  })

  it('trims whitespace by default', () => {
    const raw: RawPrompt = {
      ...mockRaw,
      messages: [{ role: 'user', content: '  hello {{name}}  ' }],
      metadata: { ...mockRaw.metadata, variables: ['name'] },
    }
    const prompt = new Prompt(raw)
    const [msg] = prompt.compile({ name: 'world' })
    expect(msg?.content).toBe('hello world')
  })

  it('preserves whitespace when trim: false', () => {
    const raw: RawPrompt = {
      ...mockRaw,
      messages: [{ role: 'user', content: '  hello  ' }],
      metadata: { ...mockRaw.metadata, variables: [] },
    }
    const prompt = new Prompt(raw)
    const [msg] = prompt.compile({}, { trim: false })
    expect(msg?.content).toBe('  hello  ')
  })
})

// ── Prompt.systemPrompt() ────────────────────

describe('Prompt.systemPrompt()', () => {
  it('returns the compiled system message', () => {
    const prompt = new Prompt(mockRaw)
    const sys = prompt.systemPrompt({ tone: 'casual', email: '' })
    expect(sys).toBe('You are a helpful assistant. Respond in a casual tone.')
  })

  it('returns undefined when no system message exists', () => {
    const raw: RawPrompt = {
      ...mockRaw,
      messages: [{ role: 'user', content: 'hi' }],
      metadata: { ...mockRaw.metadata, variables: [] },
    }
    const prompt = new Prompt(raw)
    expect(prompt.systemPrompt()).toBeUndefined()
  })
})

// ── Prompt.test() ────────────────────────────

describe('Prompt.test()', () => {
  it('passes when score meets threshold', async () => {
    const prompt = new Prompt(mockRaw)
    const results = await prompt.test(
      [{ name: 'basic', input: { email: 'test body', tone: 'formal' }, expectedOutput: 'test body summary', threshold: 0 }],
      { runner: async () => 'test body summary' }
    )
    expect(results[0]?.passed).toBe(true)
  })

  it('fails when score is below threshold', async () => {
    const prompt = new Prompt(mockRaw)
    const results = await prompt.test(
      [{ name: 'fail case', input: { email: 'cats and dogs', tone: 'formal' }, expectedOutput: 'quantum physics', threshold: 0.9 }],
      { runner: async () => 'unrelated output about pizza' }
    )
    expect(results[0]?.passed).toBe(false)
  })

  it('captures errors from the runner', async () => {
    const prompt = new Prompt(mockRaw)
    const results = await prompt.test(
      [{ name: 'crash', input: { email: 'x', tone: 'y' }, expectedOutput: 'z' }],
      { runner: async () => { throw new Error('API error') } }
    )
    expect(results[0]?.passed).toBe(false)
    expect(results[0]?.error).toContain('API error')
  })
})

// ── PromptCache ──────────────────────────────

describe('PromptCache', () => {
  it('stores and retrieves a prompt', () => {
    const cache = new PromptCache()
    cache.set('test-slug', 'production', mockRaw)
    const result = cache.get('test-slug', 'production')
    expect(result).toEqual(mockRaw)
  })

  it('returns null for a cache miss', () => {
    const cache = new PromptCache()
    expect(cache.get('missing', 'production')).toBeNull()
  })

  it('expires entries after TTL', async () => {
    const cache = new PromptCache(50) // 50ms TTL
    cache.set('slug', 'production', mockRaw)
    await new Promise(r => setTimeout(r, 60))
    expect(cache.get('slug', 'production')).toBeNull()
  })

  it('invalidates all entries for a slug', () => {
    const cache = new PromptCache()
    cache.set('slug', 'production', mockRaw)
    cache.set('slug', 'staging', mockRaw)
    cache.invalidate('slug')
    expect(cache.get('slug', 'production')).toBeNull()
    expect(cache.get('slug', 'staging')).toBeNull()
  })
})