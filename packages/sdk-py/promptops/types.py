# ─────────────────────────────────────────────
#  PromptOps Python SDK — Types
# ─────────────────────────────────────────────

from __future__ import annotations
from typing import Any, Literal, Optional
from pydantic import BaseModel


Role = Literal["system", "user", "assistant"]
Environment = str
Provider = Literal["openai", "anthropic", "gemini", "mistral", "ollama", "custom"]


class PromptMessage(BaseModel):
    role: Role
    content: str


class PromptMetadata(BaseModel):
    slug: str
    name: str
    version: str
    env: Environment
    workspace: str
    approved_at: Optional[str] = None
    approved_by: Optional[str] = None
    tags: list[str] = []
    variables: list[str] = []
    optimised_for: Optional[Provider] = None


class RawPrompt(BaseModel):
    metadata: PromptMetadata
    messages: list[PromptMessage]


class GetPromptOptions(BaseModel):
    env: Environment = "production"
    version: Optional[str] = None
    fresh: bool = False
    fallback: Optional[list[PromptMessage]] = None


class TestCase(BaseModel):
    name: str
    input: dict[str, Any]
    expected_output: str
    threshold: float = 0.85


class TestResult(BaseModel):
    test_case: str
    passed: bool
    score: float
    threshold: float
    actual_output: Optional[str] = None
    error: Optional[str] = None


class ABTestOptions(BaseModel):
    experiment: str
    user_id: str