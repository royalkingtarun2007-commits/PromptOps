# ─────────────────────────────────────────────
#  PromptOps Python SDK — Cache
# ─────────────────────────────────────────────

from __future__ import annotations
import time
from typing import Optional
from .types import RawPrompt


class PromptCache:
    """In-memory cache for fetched prompts with TTL expiry."""

    def __init__(self, ttl_seconds: float = 300.0):
        self._store: dict[str, tuple[RawPrompt, float]] = {}
        self._ttl = ttl_seconds

    def _key(self, slug: str, env: str, version: Optional[str] = None) -> str:
        return f"{slug}::v:{version}" if version else f"{slug}::env:{env}"

    def get(self, slug: str, env: str, version: Optional[str] = None) -> Optional[RawPrompt]:
        key = self._key(slug, env, version)
        entry = self._store.get(key)
        if not entry:
            return None
        prompt, expires_at = entry
        if time.monotonic() > expires_at:
            del self._store[key]
            return None
        return prompt

    def set(self, slug: str, env: str, prompt: RawPrompt, version: Optional[str] = None) -> None:
        key = self._key(slug, env, version)
        self._store[key] = (prompt, time.monotonic() + self._ttl)

    def invalidate(self, slug: str) -> None:
        keys_to_delete = [k for k in self._store if k.startswith(f"{slug}::")]
        for key in keys_to_delete:
            del self._store[key]

    def clear(self) -> None:
        self._store.clear()

    def size(self) -> int:
        return len(self._store)