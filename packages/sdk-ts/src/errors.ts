// ─────────────────────────────────────────────
//  PromptOps SDK — Errors
// ─────────────────────────────────────────────

export class PromptOpsError extends Error {
  code: 'NOT_FOUND' | 'UNAUTHORIZED' | 'TIMEOUT' | 'NETWORK' | 'COMPILE' | 'UNKNOWN'
  status: number | undefined

  constructor(
    message: string,
    code: PromptOpsError['code'] = 'UNKNOWN',
    status?: number
  ) {
    super(message)
    this.name = 'PromptOpsError'
    this.code = code
    this.status = status
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class PromptOpsNotFoundError extends PromptOpsError {
  constructor(slug: string, env: string) {
    super(
      `Prompt "${slug}" not found in environment "${env}". ` +
      `Make sure it exists and has been promoted to this environment.`,
      'NOT_FOUND',
      404
    )
    this.name = 'PromptOpsNotFoundError'
  }
}

export class PromptOpsUnauthorizedError extends PromptOpsError {
  constructor() {
    super(
      'Invalid or missing API key. ' +
      'Set PROMPTOPS_KEY in your environment or pass apiKey to the client.',
      'UNAUTHORIZED',
      401
    )
    this.name = 'PromptOpsUnauthorizedError'
  }
}

export class PromptOpsTimeoutError extends PromptOpsError {
  constructor(timeout: number) {
    super(
      `Request timed out after ${timeout}ms. ` +
      `Increase the timeout option or check your server connection.`,
      'TIMEOUT'
    )
    this.name = 'PromptOpsTimeoutError'
  }
}

export class PromptOpsNetworkError extends PromptOpsError {
  constructor(originalCause: unknown) {
    super(
      `Network error while contacting PromptOps server: ${
        originalCause instanceof Error ? originalCause.message : String(originalCause)
      }`,
      'NETWORK'
    )
    this.name = 'PromptOpsNetworkError'
  }
}

export class PromptOpsCompileError extends PromptOpsError {
  constructor(message: string) {
    super(message, 'COMPILE')
    this.name = 'PromptOpsCompileError'
  }
}