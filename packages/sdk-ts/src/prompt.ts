// ─────────────────────────────────────────────
//  PromptOps SDK — Prompt
//  The object returned from client.get()
// ─────────────────────────────────────────────

import type {
  RawPrompt,
  PromptMessage,
  PromptMetadata,
  CompileOptions,
  TestCase,
  TestResult,
  RunTestsOptions,
} from './types'
import { PromptOpsCompileError } from './errors'

export class Prompt {
  readonly metadata: PromptMetadata
  private readonly rawMessages: RawPrompt['messages']

  constructor(raw: RawPrompt) {
    this.metadata = raw.metadata
    this.rawMessages = raw.messages
  }

  /**
   * Compile the prompt template by interpolating variables.
   * Replaces {{variable}} placeholders with the values you provide.
   *
   * @example
   * const messages = prompt.compile({ email: emailBody, tone: 'formal' })
   * const result = await openai.chat.completions.create({ model: 'gpt-4o', messages })
   */
  compile(variables: Record<string, string | number | boolean> = {}, options: CompileOptions = {}): PromptMessage[] {
    // Check all required variables are supplied
    const missing = this.metadata.variables.filter(v => !(v in variables))
    if (missing.length > 0) {
      throw new PromptOpsCompileError(
        `Missing required variables for prompt "${this.metadata.slug}": ${missing.join(', ')}`
      )
    }

    return this.rawMessages.map(msg => ({
      role: msg.role,
      content: this.interpolate(msg.content, variables, options.trim ?? true),
    }))
  }

  /**
   * Like compile(), but returns a single string (system prompt merged into first user message).
   * Useful for providers that don't support the messages format.
   */
  compileToString(variables: Record<string, string | number | boolean> = {}): string {
    return this.compile(variables)
      .map(m => m.content)
      .join('\n\n')
  }

  /**
   * Returns only the system message content (compiled).
   */
  systemPrompt(variables: Record<string, string | number | boolean> = {}): string | undefined {
    const sys = this.rawMessages.find(m => m.role === 'system')
    if (!sys) return undefined
    return this.interpolate(sys.content, variables, true)
  }

  /**
   * Run a suite of test cases against this prompt using your LLM runner.
   *
   * @example
   * const results = await prompt.test(testCases, {
   *   runner: async (messages) => {
   *     const res = await openai.chat.completions.create({ model: 'gpt-4o', messages })
   *     return res.choices[0].message.content ?? ''
   *   }
   * })
   */
  async test(cases: TestCase[], options: RunTestsOptions): Promise<TestResult[]> {
    const results: TestResult[] = []

    for (const tc of cases) {
      try {
        const messages = this.compile(tc.input)
        const actual = await options.runner(messages)
        const scorer = options.scorer ?? defaultCosineSimilarity
        const score = await scorer(actual, tc.expectedOutput)
        const threshold = tc.threshold ?? 0.85

        results.push({
          testCase: tc.name,
          passed: score >= threshold,
          score,
          threshold,
          actualOutput: actual,
        })
      } catch (err) {
        results.push({
          testCase: tc.name,
          passed: false,
          score: 0,
          threshold: tc.threshold ?? 0.85,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return results
  }

  /**
   * Returns a human-readable summary of this prompt version.
   */
  toString(): string {
    return `Prompt(${this.metadata.slug}@${this.metadata.version}, env=${this.metadata.env})`
  }

  /**
   * Raw JSON representation — useful for logging/debugging.
   */
  toJSON() {
    return {
      metadata: this.metadata,
      messages: this.rawMessages,
    }
  }

  // ── Private ──────────────────────────────────

  private interpolate(
    template: string,
    variables: Record<string, string | number | boolean>,
    trim: boolean
  ): string {
    const result = template.replace(/\{\{(\s*[\w.]+\s*)\}\}/g, (match, key: string) => {
      const trimmedKey = key.trim()
      if (trimmedKey in variables) {
        return String(variables[trimmedKey])
      }
      // Leave unknown variables as-is (they may be optional or for nested templates)
      return match
    })
    return trim ? result.trim() : result
  }
}

// ── Default similarity scorer ─────────────────
// Simple token-overlap Jaccard similarity.
// In production this would call an embeddings API,
// but this works well offline for CI test suites.

function defaultCosineSimilarity(a: string, b: string): Promise<number> {
  const tokenise = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(Boolean)
    )

  const setA = tokenise(a)
  const setB = tokenise(b)

  if (setA.size === 0 && setB.size === 0) return Promise.resolve(1)
  if (setA.size === 0 || setB.size === 0) return Promise.resolve(0)

  let intersection = 0
  setA.forEach(token => { if (setB.has(token)) intersection++ })

  const union = setA.size + setB.size - intersection
  return Promise.resolve(intersection / union)
}