# ─────────────────────────────────────────────
#  PromptOps Python SDK — Client
# ─────────────────────────────────────────────

from __future__ import annotations
import os
import asyncio
import hashlib
from typing import Optional
import httpx

from .types import RawPrompt, PromptMessage, PromptMetadata, Environment
from .prompt import Prompt
from .cache import PromptCache
from .exceptions import (
    PromptOpsError,
    PromptOpsNotFoundError,
    PromptOpsUnauthorizedError,
    PromptOpsTimeoutError,
    PromptOpsNetworkError,
)

DEFAULT_BASE_URL = "https://api.promptops.dev"
DEFAULT_TIMEOUT  = 5.0
DEFAULT_RETRIES  = 2
DEFAULT_ENV      = "production"


class PromptOps:
    """
    PromptOps client — fetch, compile, and A/B test your prompts.

    Example:
        client = PromptOps(api_key=os.environ["PROMPTOPS_KEY"])
        prompt = client.get("summarise-email", env="production")
        messages = prompt.compile(email=email_body, tone="formal")
    """

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str = DEFAULT_BASE_URL,
        default_env: Environment = DEFAULT_ENV,
        timeout: float = DEFAULT_TIMEOUT,
        retries: int = DEFAULT_RETRIES,
    ):
        resolved_key = api_key or os.environ.get("PROMPTOPS_KEY")
        if not resolved_key:
            raise PromptOpsError(
                "api_key is required. Pass it directly or set the PROMPTOPS_KEY "
                "environment variable.",
                code="UNAUTHORIZED",
            )

        self._api_key    = resolved_key
        self._base_url   = base_url.rstrip("/")
        self._default_env = default_env
        self._timeout    = timeout
        self._retries    = retries
        self._cache      = PromptCache()

    # ── Public API ──────────────────────────────

    def get(
        self,
        slug: str,
        env: Environment | None = None,
        version: str | None = None,
        fresh: bool = False,
        fallback: list[PromptMessage] | None = None,
    ) -> Prompt:
        """
        Fetch a prompt synchronously.

        Example:
            prompt = client.get("summarise-email", env="production")
            messages = prompt.compile(email=body, tone="formal")
        """
        return asyncio.get_event_loop().run_until_complete(
            self.aget(slug, env=env, version=version, fresh=fresh, fallback=fallback)
        )

    async def aget(
        self,
        slug: str,
        env: Environment | None = None,
        version: str | None = None,
        fresh: bool = False,
        fallback: list[PromptMessage] | None = None,
    ) -> Prompt:
        """Async version of get()."""
        resolved_env = env or self._default_env

        if not fresh:
            cached = self._cache.get(slug, resolved_env, version)
            if cached:
                return Prompt(cached)

        try:
            raw = await self._fetch_with_retry(slug, resolved_env, version)
            self._cache.set(slug, resolved_env, raw, version)
            return Prompt(raw)
        except PromptOpsNetworkError:
            if fallback:
                import warnings
                warnings.warn(
                    f'[PromptOps] Network error fetching "{slug}", using fallback.',
                    stacklevel=2,
                )
                return Prompt(RawPrompt(
                    metadata=PromptMetadata(
                        slug=slug, name=slug, version="fallback",
                        env=resolved_env, workspace="unknown",
                        approved_at=None, approved_by="system",
                        tags=[], variables=[],
                    ),
                    messages=fallback,
                ))
            raise

    def get_many(
        self,
        slugs: list[str],
        env: Environment | None = None,
    ) -> list[Prompt]:
        """Fetch multiple prompts in parallel."""
        return asyncio.get_event_loop().run_until_complete(
            self.aget_many(slugs, env=env)
        )

    async def aget_many(
        self,
        slugs: list[str],
        env: Environment | None = None,
    ) -> list[Prompt]:
        """Async version of get_many()."""
        return list(await asyncio.gather(*[self.aget(s, env=env) for s in slugs]))

    def ab(self, slug: str, experiment: str, user_id: str) -> tuple[Prompt, str]:
        """
        A/B test two prompt versions. Returns (prompt, variant) where
        variant is 'A' or 'B'. Same user always gets the same variant.

        Example:
            prompt, variant = client.ab("checkout-msg", "checkout-q1", user_id)
            messages = prompt.compile(cart_total=cart_total)
        """
        return asyncio.get_event_loop().run_until_complete(
            self.aab(slug, experiment=experiment, user_id=user_id)
        )

    async def aab(self, slug: str, experiment: str, user_id: str) -> tuple[Prompt, str]:
        """Async version of ab()."""
        variant = self._bucket(user_id, experiment)
        env = f"ab:{experiment}:{variant}"
        prompt = await self.aget(slug, env=env)

        # Fire-and-forget impression tracking
        asyncio.create_task(self._track_impression(slug, experiment, variant, user_id))

        return prompt, variant

    def invalidate_cache(self, slug: str) -> None:
        """Invalidate cached versions of a prompt slug."""
        self._cache.invalidate(slug)

    def clear_cache(self) -> None:
        """Clear all cached prompts."""
        self._cache.clear()

    # ── Private ──────────────────────────────────

    async def _fetch_with_retry(
        self,
        slug: str,
        env: str,
        version: str | None,
        attempt: int = 0,
    ) -> RawPrompt:
        if version:
            url = f"{self._base_url}/v1/prompts/{slug}/versions/{version}"
        else:
            url = f"{self._base_url}/v1/prompts/{slug}?env={env}"

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "X-PromptOps-SDK": "py/0.1.0",
        }

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.get(url, headers=headers)
        except httpx.TimeoutException:
            raise PromptOpsTimeoutError(self._timeout)
        except httpx.RequestError as e:
            if attempt < self._retries:
                await asyncio.sleep(0.2 * (2 ** attempt))
                return await self._fetch_with_retry(slug, env, version, attempt + 1)
            raise PromptOpsNetworkError(e)

        if response.status_code in (401, 403):
            raise PromptOpsUnauthorizedError()

        if response.status_code == 404:
            raise PromptOpsNotFoundError(slug, env)

        if not response.is_success:
            raise PromptOpsError(
                f"Server returned {response.status_code}: {response.text}",
                status=response.status_code,
            )

        data = response.json()
        return RawPrompt(**data)

    def _bucket(self, user_id: str, experiment: str) -> str:
        """Stable deterministic A/B bucketing."""
        key = f"{experiment}:{user_id}".encode()
        digest = int(hashlib.md5(key).hexdigest(), 16)
        return "A" if digest % 2 == 0 else "B"

    async def _track_impression(
        self, slug: str, experiment: str, variant: str, user_id: str
    ) -> None:
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                await client.post(
                    f"{self._base_url}/v1/experiments/{experiment}/impressions",
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    json={"slug": slug, "variant": variant, "userId": user_id},
                )
        except Exception:
            pass  # Analytics must never break the main flow