# ─────────────────────────────────────────────
#  PromptOps Python SDK — Prompt
#  The object returned from client.get()
# ─────────────────────────────────────────────

from __future__ import annotations
import re
from typing import Any, Callable, Awaitable
from .types import RawPrompt, PromptMessage, PromptMetadata, TestCase, TestResult
from .exceptions import PromptOpsCompileError


class Prompt:
    """
    Represents a fetched prompt with its metadata and messages.
    Use .compile() to interpolate variables and get messages ready for any LLM.
    """

    def __init__(self, raw: RawPrompt):
        self.metadata: PromptMetadata = raw.metadata
        self._raw_messages = raw.messages

    def compile(
        self,
        variables: dict[str, Any] | None = None,
        trim: bool = True,
    ) -> list[dict[str, str]]:
        """
        Interpolate {{variable}} placeholders and return messages
        ready for any LLM provider.

        Example:
            messages = prompt.compile(email=email_body, tone="formal")
            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=messages,
            )
        """
        variables = variables or {}

        # Check for missing required variables
        missing = [v for v in self.metadata.variables if v not in variables]
        if missing:
            raise PromptOpsCompileError(
                f'Missing required variables for prompt "{self.metadata.slug}": '
                f'{", ".join(missing)}'
            )

        return [
            {
                "role": msg.role,
                "content": self._interpolate(msg.content, variables, trim),
            }
            for msg in self._raw_messages
        ]

    def compile_to_string(self, variables: dict[str, Any] | None = None) -> str:
        """Compile and join all messages into a single string."""
        return "\n\n".join(m["content"] for m in self.compile(variables))

    def system_prompt(self, variables: dict[str, Any] | None = None) -> str | None:
        """Return just the system message content, compiled."""
        sys_msg = next((m for m in self._raw_messages if m.role == "system"), None)
        if not sys_msg:
            return None
        return self._interpolate(sys_msg.content, variables or {}, trim=True)

    async def test(
        self,
        cases: list[TestCase],
        runner: Callable[[list[dict[str, str]]], Awaitable[str]],
        scorer: Callable[[str, str], Awaitable[float]] | None = None,
    ) -> list[TestResult]:
        """
        Run regression tests against this prompt using your LLM runner.

        Example:
            async def runner(messages):
                response = await openai.chat.completions.create(
                    model="gpt-4o", messages=messages
                )
                return response.choices[0].message.content

            results = await prompt.test(test_cases, runner=runner)
            failed = [r for r in results if not r.passed]
        """
        results: list[TestResult] = []
        _scorer = scorer or _default_similarity

        for case in cases:
            try:
                messages = self.compile(case.input)
                actual = await runner(messages)
                score = await _scorer(actual, case.expected_output)
                results.append(TestResult(
                    test_case=case.name,
                    passed=score >= case.threshold,
                    score=score,
                    threshold=case.threshold,
                    actual_output=actual,
                ))
            except Exception as e:
                results.append(TestResult(
                    test_case=case.name,
                    passed=False,
                    score=0.0,
                    threshold=case.threshold,
                    error=str(e),
                ))

        return results

    def __repr__(self) -> str:
        return f"Prompt({self.metadata.slug}@{self.metadata.version}, env={self.metadata.env})"

    # ── Private ──────────────────────────────────

    def _interpolate(self, template: str, variables: dict[str, Any], trim: bool) -> str:
        def replacer(match: re.Match) -> str:  # type: ignore[type-arg]
            key = match.group(1).strip()
            if key in variables:
                return str(variables[key])
            return match.group(0)  # leave unknown placeholders as-is

        result = re.sub(r"\{\{\s*([\w.]+)\s*\}\}", replacer, template)
        return result.strip() if trim else result


async def _default_similarity(a: str, b: str) -> float:
    """
    Jaccard similarity on word tokens.
    Works offline — no embedding API needed.
    For production, replace with an embeddings-based scorer.
    """
    def tokenise(s: str) -> set[str]:
        return set(re.sub(r"[^a-z0-9\s]", "", s.lower()).split())

    set_a = tokenise(a)
    set_b = tokenise(b)

    if not set_a and not set_b:
        return 1.0
    if not set_a or not set_b:
        return 0.0

    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    return intersection / union