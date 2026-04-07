
-- ── Extensions ────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Workspaces (teams/organisations) ──────────
CREATE TABLE IF NOT EXISTS workspaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Users ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('viewer', 'editor', 'reviewer', 'admin')),
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── API Keys ───────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  key_hash      TEXT NOT NULL UNIQUE,
  key_prefix    TEXT NOT NULL,
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Prompts ────────────────────────────────────
CREATE TABLE IF NOT EXISTS prompts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  slug          TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  tags          TEXT[] NOT NULL DEFAULT '{}',
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, slug)
);

-- ── Prompt Versions ────────────────────────────
CREATE TABLE IF NOT EXISTS prompt_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id     UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  version       TEXT NOT NULL,
  messages      JSONB NOT NULL,
  variables     TEXT[] NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'approved', 'rejected', 'archived')),
  created_by    UUID REFERENCES users(id),
  approved_by   UUID REFERENCES users(id),
  approved_at   TIMESTAMPTZ,
  review_notes  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(prompt_id, version)
);

-- ── Environment Promotions ─────────────────────
-- Tracks which version is live in each environment
CREATE TABLE IF NOT EXISTS promotions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id         UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  prompt_version_id UUID NOT NULL REFERENCES prompt_versions(id),
  environment       TEXT NOT NULL,
  promoted_by       UUID REFERENCES users(id),
  promoted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(prompt_id, environment)
);

-- ── A/B Experiments ────────────────────────────
CREATE TABLE IF NOT EXISTS experiments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  prompt_id           UUID NOT NULL REFERENCES prompts(id),
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL,
  version_a_id        UUID NOT NULL REFERENCES prompt_versions(id),
  version_b_id        UUID NOT NULL REFERENCES prompt_versions(id),
  traffic_split       INTEGER NOT NULL DEFAULT 50 CHECK (traffic_split BETWEEN 1 AND 99),
  status              TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'paused', 'completed')),
  winner              TEXT CHECK (winner IN ('A', 'B')),
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  UNIQUE(workspace_id, slug)
);

-- ── Experiment Impressions ─────────────────────
CREATE TABLE IF NOT EXISTS experiment_impressions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id  UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  variant        TEXT NOT NULL CHECK (variant IN ('A', 'B')),
  user_id        TEXT NOT NULL,
  recorded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_prompts_workspace    ON prompts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_prompts_slug         ON prompts(slug);
CREATE INDEX IF NOT EXISTS idx_versions_prompt      ON prompt_versions(prompt_id);
CREATE INDEX IF NOT EXISTS idx_versions_status      ON prompt_versions(status);
CREATE INDEX IF NOT EXISTS idx_promotions_prompt    ON promotions(prompt_id, environment);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash        ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_impressions_exp      ON experiment_impressions(experiment_id);
