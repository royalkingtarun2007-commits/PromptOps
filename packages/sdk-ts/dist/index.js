"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/errors.ts
var PromptOpsError, PromptOpsNotFoundError, PromptOpsUnauthorizedError, PromptOpsTimeoutError, PromptOpsNetworkError, PromptOpsCompileError;
var init_errors = __esm({
  "src/errors.ts"() {
    "use strict";
    PromptOpsError = class extends Error {
      constructor(message, code = "UNKNOWN", status) {
        super(message);
        this.name = "PromptOpsError";
        this.code = code;
        this.status = status;
        Object.setPrototypeOf(this, new.target.prototype);
      }
    };
    PromptOpsNotFoundError = class extends PromptOpsError {
      constructor(slug, env) {
        super(
          `Prompt "${slug}" not found in environment "${env}". Make sure it exists and has been promoted to this environment.`,
          "NOT_FOUND",
          404
        );
        this.name = "PromptOpsNotFoundError";
      }
    };
    PromptOpsUnauthorizedError = class extends PromptOpsError {
      constructor() {
        super(
          "Invalid or missing API key. Set PROMPTOPS_KEY in your environment or pass apiKey to the client.",
          "UNAUTHORIZED",
          401
        );
        this.name = "PromptOpsUnauthorizedError";
      }
    };
    PromptOpsTimeoutError = class extends PromptOpsError {
      constructor(timeout) {
        super(
          `Request timed out after ${timeout}ms. Increase the timeout option or check your server connection.`,
          "TIMEOUT"
        );
        this.name = "PromptOpsTimeoutError";
      }
    };
    PromptOpsNetworkError = class extends PromptOpsError {
      constructor(originalCause) {
        super(
          `Network error while contacting PromptOps server: ${originalCause instanceof Error ? originalCause.message : String(originalCause)}`,
          "NETWORK"
        );
        this.name = "PromptOpsNetworkError";
      }
    };
    PromptOpsCompileError = class extends PromptOpsError {
      constructor(message) {
        super(message, "COMPILE");
        this.name = "PromptOpsCompileError";
      }
    };
  }
});

// src/prompt.ts
function defaultCosineSimilarity(a, b) {
  const tokenise = (s) => new Set(
    s.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean)
  );
  const setA = tokenise(a);
  const setB = tokenise(b);
  if (setA.size === 0 && setB.size === 0) return Promise.resolve(1);
  if (setA.size === 0 || setB.size === 0) return Promise.resolve(0);
  let intersection = 0;
  setA.forEach((token) => {
    if (setB.has(token)) intersection++;
  });
  const union = setA.size + setB.size - intersection;
  return Promise.resolve(intersection / union);
}
var Prompt;
var init_prompt = __esm({
  "src/prompt.ts"() {
    "use strict";
    init_errors();
    Prompt = class {
      constructor(raw) {
        this.metadata = raw.metadata;
        this.rawMessages = raw.messages;
      }
      /**
       * Compile the prompt template by interpolating variables.
       * Replaces {{variable}} placeholders with the values you provide.
       *
       * @example
       * const messages = prompt.compile({ email: emailBody, tone: 'formal' })
       * const result = await openai.chat.completions.create({ model: 'gpt-4o', messages })
       */
      compile(variables = {}, options = {}) {
        const missing = this.metadata.variables.filter((v) => !(v in variables));
        if (missing.length > 0) {
          throw new PromptOpsCompileError(
            `Missing required variables for prompt "${this.metadata.slug}": ${missing.join(", ")}`
          );
        }
        return this.rawMessages.map((msg) => ({
          role: msg.role,
          content: this.interpolate(msg.content, variables, options.trim ?? true)
        }));
      }
      /**
       * Like compile(), but returns a single string (system prompt merged into first user message).
       * Useful for providers that don't support the messages format.
       */
      compileToString(variables = {}) {
        return this.compile(variables).map((m) => m.content).join("\n\n");
      }
      /**
       * Returns only the system message content (compiled).
       */
      systemPrompt(variables = {}) {
        const sys = this.rawMessages.find((m) => m.role === "system");
        if (!sys) return void 0;
        return this.interpolate(sys.content, variables, true);
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
      async test(cases, options) {
        const results = [];
        for (const tc of cases) {
          try {
            const messages = this.compile(tc.input);
            const actual = await options.runner(messages);
            const scorer = options.scorer ?? defaultCosineSimilarity;
            const score = await scorer(actual, tc.expectedOutput);
            const threshold = tc.threshold ?? 0.85;
            results.push({
              testCase: tc.name,
              passed: score >= threshold,
              score,
              threshold,
              actualOutput: actual
            });
          } catch (err) {
            results.push({
              testCase: tc.name,
              passed: false,
              score: 0,
              threshold: tc.threshold ?? 0.85,
              error: err instanceof Error ? err.message : String(err)
            });
          }
        }
        return results;
      }
      /**
       * Returns a human-readable summary of this prompt version.
       */
      toString() {
        return `Prompt(${this.metadata.slug}@${this.metadata.version}, env=${this.metadata.env})`;
      }
      /**
       * Raw JSON representation — useful for logging/debugging.
       */
      toJSON() {
        return {
          metadata: this.metadata,
          messages: this.rawMessages
        };
      }
      // ── Private ──────────────────────────────────
      interpolate(template, variables, trim) {
        const result = template.replace(/\{\{(\s*[\w.]+\s*)\}\}/g, (match, key) => {
          const trimmedKey = key.trim();
          if (trimmedKey in variables) {
            return String(variables[trimmedKey]);
          }
          return match;
        });
        return trim ? result.trim() : result;
      }
    };
  }
});

// src/cache.ts
var PromptCache;
var init_cache = __esm({
  "src/cache.ts"() {
    "use strict";
    PromptCache = class {
      constructor(ttlMs = 5 * 60 * 1e3) {
        this.store = /* @__PURE__ */ new Map();
        this.ttl = ttlMs;
      }
      key(slug, env, version) {
        return version ? `${slug}::${version}` : `${slug}::env:${env}`;
      }
      get(slug, env, version) {
        const entry = this.store.get(this.key(slug, env, version));
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
          this.store.delete(this.key(slug, env, version));
          return null;
        }
        return entry.prompt;
      }
      set(slug, env, prompt, version) {
        this.store.set(this.key(slug, env, version), {
          prompt,
          expiresAt: Date.now() + this.ttl
        });
      }
      invalidate(slug) {
        for (const key of this.store.keys()) {
          if (key.startsWith(`${slug}::`)) {
            this.store.delete(key);
          }
        }
      }
      clear() {
        this.store.clear();
      }
      size() {
        return this.store.size;
      }
    };
  }
});

// src/client.ts
var client_exports = {};
__export(client_exports, {
  PromptOps: () => PromptOps
});
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
var DEFAULT_BASE_URL, DEFAULT_TIMEOUT, DEFAULT_RETRIES, DEFAULT_ENV, PromptOps;
var init_client = __esm({
  "src/client.ts"() {
    "use strict";
    init_prompt();
    init_cache();
    init_errors();
    DEFAULT_BASE_URL = "https://api.promptops.dev";
    DEFAULT_TIMEOUT = 5e3;
    DEFAULT_RETRIES = 2;
    DEFAULT_ENV = "production";
    PromptOps = class {
      constructor(config) {
        if (!config.apiKey) {
          throw new PromptOpsError(
            "apiKey is required. Pass it directly or set the PROMPTOPS_KEY environment variable.",
            "UNAUTHORIZED"
          );
        }
        this.apiKey = config.apiKey;
        this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
        this.defaultEnv = config.defaultEnv ?? DEFAULT_ENV;
        this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
        this.retries = config.retries ?? DEFAULT_RETRIES;
        this.cache = new PromptCache();
      }
      // ── Public API ──────────────────────────────
      /**
       * Fetch a prompt by its slug.
       *
       * @example
       * const prompt = await client.get('summarise-email', { env: 'production' })
       * const messages = prompt.compile({ email: body })
       */
      async get(slug, options = {}) {
        const env = options.env ?? this.defaultEnv;
        const version = options.version;
        if (!options.fresh) {
          const cached = this.cache.get(slug, env, version);
          if (cached) return new Prompt(cached);
        }
        try {
          const raw = await this.fetchWithRetry(slug, env, version);
          this.cache.set(slug, env, raw, version);
          return new Prompt(raw);
        } catch (err) {
          if (options.fallback && err instanceof PromptOpsNetworkError) {
            console.warn(`[PromptOps] Network error fetching "${slug}", using fallback.`);
            return new Prompt({
              metadata: {
                slug,
                name: slug,
                version: "fallback",
                env,
                workspace: "unknown",
                approvedAt: (/* @__PURE__ */ new Date()).toISOString(),
                approvedBy: "system",
                tags: [],
                variables: []
              },
              messages: options.fallback
            });
          }
          throw err;
        }
      }
      /**
       * Fetch multiple prompts in a single request. Much faster than calling get() in a loop.
       *
       * @example
       * const [welcome, summary] = await client.getMany(['welcome-email', 'summary'])
       */
      async getMany(slugs, options = {}) {
        return Promise.all(slugs.map((slug) => this.get(slug, options)));
      }
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
      async ab(slug, options) {
        const variant = this.bucket(options.userId, options.experiment);
        const env = `ab:${options.experiment}:${variant}`;
        const prompt = await this.get(slug, { env });
        void this.trackImpression(slug, options.experiment, variant, options.userId);
        return Object.assign(prompt, { variant });
      }
      /**
       * Invalidate the local cache for a specific prompt slug.
       * Useful after pushing a new version from your dashboard.
       */
      invalidateCache(slug) {
        this.cache.invalidate(slug);
      }
      /**
       * Clear the entire local prompt cache.
       */
      clearCache() {
        this.cache.clear();
      }
      // ── Private ──────────────────────────────────
      async fetchWithRetry(slug, env, version, attempt = 0) {
        const url = version ? `${this.baseUrl}/v1/prompts/${slug}/versions/${version}` : `${this.baseUrl}/v1/prompts/${slug}?env=${encodeURIComponent(env)}`;
        let response;
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), this.timeout);
          response = await fetch(url, {
            headers: {
              "Authorization": `Bearer ${this.apiKey}`,
              "Content-Type": "application/json",
              "X-PromptOps-SDK": "ts/0.1.0"
            },
            signal: controller.signal
          });
          clearTimeout(timer);
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            throw new PromptOpsTimeoutError(this.timeout);
          }
          if (attempt < this.retries) {
            await sleep(200 * Math.pow(2, attempt));
            return this.fetchWithRetry(slug, env, version, attempt + 1);
          }
          throw new PromptOpsNetworkError(err);
        }
        if (response.status === 401 || response.status === 403) {
          throw new PromptOpsUnauthorizedError();
        }
        if (response.status === 404) {
          throw new PromptOpsNotFoundError(slug, env);
        }
        if (!response.ok) {
          const body = await response.text().catch(() => "");
          throw new PromptOpsError(
            `Server returned ${response.status}: ${body}`,
            "UNKNOWN",
            response.status
          );
        }
        const data = await response.json();
        return data;
      }
      /** Stable deterministic A/B bucketing — same user always gets same variant */
      bucket(userId, experiment) {
        const str = `${experiment}:${userId}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          hash = (hash << 5) - hash + str.charCodeAt(i);
          hash |= 0;
        }
        return Math.abs(hash) % 2 === 0 ? "A" : "B";
      }
      /** Fire-and-forget impression tracking for A/B analytics */
      async trackImpression(slug, experiment, variant, userId) {
        try {
          await fetch(`${this.baseUrl}/v1/experiments/${experiment}/impressions`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${this.apiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ slug, variant, userId, timestamp: Date.now() })
          });
        } catch {
        }
      }
    };
  }
});

// src/index.ts
var index_exports = {};
__export(index_exports, {
  Prompt: () => Prompt,
  PromptOps: () => PromptOps,
  PromptOpsCompileError: () => PromptOpsCompileError,
  PromptOpsError: () => PromptOpsError,
  PromptOpsNetworkError: () => PromptOpsNetworkError,
  PromptOpsNotFoundError: () => PromptOpsNotFoundError,
  PromptOpsTimeoutError: () => PromptOpsTimeoutError,
  PromptOpsUnauthorizedError: () => PromptOpsUnauthorizedError,
  createClient: () => createClient
});
module.exports = __toCommonJS(index_exports);
init_client();
init_prompt();
init_errors();
function createClient(overrides = {}) {
  const apiKey = overrides.apiKey ?? (typeof process !== "undefined" ? process.env["PROMPTOPS_KEY"] : void 0);
  if (!apiKey) {
    throw new Error(
      "[PromptOps] No API key found. Set PROMPTOPS_KEY in your environment or pass apiKey to createClient()."
    );
  }
  return new (init_client(), __toCommonJS(client_exports)).PromptOps({ ...overrides, apiKey });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Prompt,
  PromptOps,
  PromptOpsCompileError,
  PromptOpsError,
  PromptOpsNetworkError,
  PromptOpsNotFoundError,
  PromptOpsTimeoutError,
  PromptOpsUnauthorizedError,
  createClient
});
