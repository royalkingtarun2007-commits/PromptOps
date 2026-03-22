type Environment = 'production' | 'staging' | 'development' | string;
type Provider = 'openai' | 'anthropic' | 'gemini' | 'mistral' | 'ollama' | 'custom';
interface PromptOpsConfig {
    /** Your PromptOps API key */
    apiKey: string;
    /** Base URL of your PromptOps server. Defaults to https://api.promptops.dev */
    baseUrl?: string;
    /** Default environment to fetch prompts from. Defaults to 'production' */
    defaultEnv?: Environment;
    /** Request timeout in milliseconds. Defaults to 5000 */
    timeout?: number;
    /** Retry failed requests this many times. Defaults to 2 */
    retries?: number;
}
interface PromptMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
interface PromptMetadata {
    /** Unique slug identifier for this prompt */
    slug: string;
    /** Human-readable name */
    name: string;
    /** Current version identifier e.g. "v12" or a commit-style hash */
    version: string;
    /** Environment this version is promoted to */
    env: Environment;
    /** Team / workspace this prompt belongs to */
    workspace: string;
    /** ISO timestamp of when this version was approved */
    approvedAt: string;
    /** Who approved this version */
    approvedBy: string;
    /** Tags for filtering */
    tags: string[];
    /** Variable names this prompt expects */
    variables: string[];
    /** Provider this prompt was optimised for, if any */
    optimisedFor?: Provider;
}
interface RawPrompt {
    metadata: PromptMetadata;
    /** The raw template string(s). Use {{variable}} syntax */
    messages: Array<{
        role: 'system' | 'user' | 'assistant';
        content: string;
    }>;
}
interface GetPromptOptions {
    /** Which environment to fetch from. Defaults to client's defaultEnv */
    env?: Environment;
    /** Pin to a specific version. Overrides env. */
    version?: string;
    /** Skip cache and fetch fresh from server */
    fresh?: boolean;
    /** Fallback messages to use if fetch fails */
    fallback?: PromptMessage[];
}
interface CompileOptions {
    /** Variables to interpolate into the prompt template */
    variables?: Record<string, string | number | boolean>;
    /** Trim whitespace from compiled content */
    trim?: boolean;
}
interface ABTestOptions {
    /** Name of the A/B experiment */
    experiment: string;
    /** Unique stable ID for this user/session (used for consistent bucketing) */
    userId: string;
}
interface TestCase {
    /** Descriptive name for this test case */
    name: string;
    /** Input variables to compile the prompt with */
    input: Record<string, string>;
    /** Expected output (used for semantic similarity scoring) */
    expectedOutput: string;
    /** Minimum similarity score to pass (0–1). Defaults to 0.85 */
    threshold?: number;
}
interface TestResult {
    testCase: string;
    passed: boolean;
    score: number;
    threshold: number;
    actualOutput?: string;
    error?: string;
}
interface RunTestsOptions {
    /** LLM call function to use for testing */
    runner: (messages: PromptMessage[]) => Promise<string>;
    /** Similarity scorer. Defaults to built-in cosine similarity */
    scorer?: (actual: string, expected: string) => Promise<number>;
}

declare class Prompt {
    readonly metadata: PromptMetadata;
    private readonly rawMessages;
    constructor(raw: RawPrompt);
    /**
     * Compile the prompt template by interpolating variables.
     * Replaces {{variable}} placeholders with the values you provide.
     *
     * @example
     * const messages = prompt.compile({ email: emailBody, tone: 'formal' })
     * const result = await openai.chat.completions.create({ model: 'gpt-4o', messages })
     */
    compile(variables?: Record<string, string | number | boolean>, options?: CompileOptions): PromptMessage[];
    /**
     * Like compile(), but returns a single string (system prompt merged into first user message).
     * Useful for providers that don't support the messages format.
     */
    compileToString(variables?: Record<string, string | number | boolean>): string;
    /**
     * Returns only the system message content (compiled).
     */
    systemPrompt(variables?: Record<string, string | number | boolean>): string | undefined;
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
    test(cases: TestCase[], options: RunTestsOptions): Promise<TestResult[]>;
    /**
     * Returns a human-readable summary of this prompt version.
     */
    toString(): string;
    /**
     * Raw JSON representation — useful for logging/debugging.
     */
    toJSON(): {
        metadata: PromptMetadata;
        messages: {
            role: "system" | "user" | "assistant";
            content: string;
        }[];
    };
    private interpolate;
}

declare class PromptOps {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly defaultEnv;
    private readonly timeout;
    private readonly retries;
    private readonly cache;
    constructor(config: PromptOpsConfig);
    /**
     * Fetch a prompt by its slug.
     *
     * @example
     * const prompt = await client.get('summarise-email', { env: 'production' })
     * const messages = prompt.compile({ email: body })
     */
    get(slug: string, options?: GetPromptOptions): Promise<Prompt>;
    /**
     * Fetch multiple prompts in a single request. Much faster than calling get() in a loop.
     *
     * @example
     * const [welcome, summary] = await client.getMany(['welcome-email', 'summary'])
     */
    getMany(slugs: string[], options?: Omit<GetPromptOptions, 'version' | 'fallback'>): Promise<Prompt[]>;
    /**
     * A/B test two prompt versions against each other.
     * Routes the user to version A or B based on a stable hash of their userId.
     * The assignment is consistent — the same user always gets the same variant.
     *
     * @example
     * const prompt = await client.ab('checkout-message', {
     *   experiment: 'checkout-copy-test',
     *   userId: session.userId,
     * })
     */
    ab(slug: string, options: ABTestOptions): Promise<Prompt & {
        variant: 'A' | 'B';
    }>;
    /**
     * Invalidate the local cache for a specific prompt slug.
     * Useful after pushing a new version from your dashboard.
     */
    invalidateCache(slug: string): void;
    /**
     * Clear the entire local prompt cache.
     */
    clearCache(): void;
    private fetchWithRetry;
    /** Stable deterministic A/B bucketing — same user always gets same variant */
    private bucket;
    /** Fire-and-forget impression tracking for A/B analytics */
    private trackImpression;
}

declare class PromptOpsError extends Error {
    code: 'NOT_FOUND' | 'UNAUTHORIZED' | 'TIMEOUT' | 'NETWORK' | 'COMPILE' | 'UNKNOWN';
    status: number | undefined;
    constructor(message: string, code?: PromptOpsError['code'], status?: number);
}
declare class PromptOpsNotFoundError extends PromptOpsError {
    constructor(slug: string, env: string);
}
declare class PromptOpsUnauthorizedError extends PromptOpsError {
    constructor();
}
declare class PromptOpsTimeoutError extends PromptOpsError {
    constructor(timeout: number);
}
declare class PromptOpsNetworkError extends PromptOpsError {
    constructor(originalCause: unknown);
}
declare class PromptOpsCompileError extends PromptOpsError {
    constructor(message: string);
}

declare function createClient(overrides?: Partial<PromptOpsConfig>): any;

export { type ABTestOptions, type CompileOptions, type Environment, type GetPromptOptions, Prompt, type PromptMessage, type PromptMetadata, PromptOps, PromptOpsCompileError, type PromptOpsConfig, PromptOpsError, PromptOpsNetworkError, PromptOpsNotFoundError, PromptOpsTimeoutError, PromptOpsUnauthorizedError, type Provider, type RawPrompt, type RunTestsOptions, type TestCase, type TestResult, createClient };
