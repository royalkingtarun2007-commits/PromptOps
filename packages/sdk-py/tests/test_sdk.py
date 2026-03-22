import pytest
from promptops.prompt import Prompt, _default_similarity
from promptops.cache import PromptCache
from promptops.exceptions import PromptOpsCompileError
from promptops.types import RawPrompt, PromptMetadata, PromptMessage, TestCase

# ── Fixtures ─────────────────────────────────

@pytest.fixture
def mock_raw() -> RawPrompt:
    return RawPrompt(
        metadata=PromptMetadata(
            slug="summarise-email",
            name="Summarise Email",
            version="v3",
            env="production",
            workspace="acme",
            approved_by="alice@acme.com",
            tags=["email", "summarisation"],
            variables=["email", "tone"],
        ),
        messages=[
            PromptMessage(role="system", content="You are helpful. Respond in a {{tone}} tone."),
            PromptMessage(role="user", content="Summarise:\n\n{{email}}"),
        ],
    )

# ── Prompt.compile() ─────────────────────────

class TestPromptCompile:
    def test_interpolates_variables(self, mock_raw):
        prompt = Prompt(mock_raw)
        messages = prompt.compile({"email": "Hello world", "tone": "formal"})
        assert messages[0]["content"] == "You are helpful. Respond in a formal tone."
        assert "Hello world" in messages[1]["content"]

    def test_raises_on_missing_variables(self, mock_raw):
        prompt = Prompt(mock_raw)
        with pytest.raises(PromptOpsCompileError, match="tone"):
            prompt.compile({"email": "test"})

    def test_trims_whitespace_by_default(self):
        raw = RawPrompt(
            metadata=PromptMetadata(slug="t", name="t", version="v1", env="production", workspace="w"),
            messages=[PromptMessage(role="user", content="  hello {{name}}  ")],
        )
        raw.metadata.variables = ["name"]
        prompt = Prompt(raw)
        result = prompt.compile({"name": "world"})
        assert result[0]["content"] == "hello world"

    def test_preserves_whitespace_when_disabled(self):
        raw = RawPrompt(
            metadata=PromptMetadata(slug="t", name="t", version="v1", env="production", workspace="w"),
            messages=[PromptMessage(role="user", content="  hello  ")],
        )
        prompt = Prompt(raw)
        result = prompt.compile(trim=False)
        assert result[0]["content"] == "  hello  "

    def test_leaves_unknown_placeholders(self, mock_raw):
        prompt = Prompt(mock_raw)
        messages = prompt.compile({"email": "body", "tone": "friendly"})
        assert len(messages) == 2

# ── Prompt.system_prompt() ───────────────────

class TestSystemPrompt:
    def test_returns_compiled_system_message(self, mock_raw):
        prompt = Prompt(mock_raw)
        result = prompt.system_prompt({"tone": "casual", "email": ""})
        assert result == "You are helpful. Respond in a casual tone."

    def test_returns_none_when_no_system_message(self):
        raw = RawPrompt(
            metadata=PromptMetadata(slug="t", name="t", version="v1", env="production", workspace="w"),
            messages=[PromptMessage(role="user", content="hi")],
        )
        prompt = Prompt(raw)
        assert prompt.system_prompt() is None

# ── Prompt.test() ────────────────────────────

class TestPromptTest:
    @pytest.mark.asyncio
    async def test_passes_when_score_meets_threshold(self, mock_raw):
        prompt = Prompt(mock_raw)
        async def runner(messages): return "test body summary"
        results = await prompt.test(
            [TestCase(name="basic", input={"email": "test body", "tone": "formal"}, expected_output="test body summary", threshold=0.0)],
            runner=runner,
        )
        assert results[0].passed is True

    @pytest.mark.asyncio
    async def test_fails_when_score_below_threshold(self, mock_raw):
        prompt = Prompt(mock_raw)
        async def runner(messages): return "completely unrelated response about pizza"
        results = await prompt.test(
            [TestCase(name="fail", input={"email": "quantum physics", "tone": "formal"}, expected_output="advanced science concepts", threshold=0.9)],
            runner=runner,
        )
        assert results[0].passed is False

    @pytest.mark.asyncio
    async def test_captures_runner_errors(self, mock_raw):
        prompt = Prompt(mock_raw)
        async def runner(messages): raise RuntimeError("API error")
        results = await prompt.test(
            [TestCase(name="crash", input={"email": "x", "tone": "y"}, expected_output="z")],
            runner=runner,
        )
        assert results[0].passed is False
        assert "API error" in (results[0].error or "")

# ── PromptCache ──────────────────────────────

class TestPromptCache:
    def test_stores_and_retrieves(self, mock_raw):
        cache = PromptCache()
        cache.set("slug", "production", mock_raw)
        assert cache.get("slug", "production") == mock_raw

    def test_returns_none_on_miss(self):
        cache = PromptCache()
        assert cache.get("missing", "production") is None

    def test_expires_after_ttl(self, mock_raw):
        import time
        cache = PromptCache(ttl_seconds=0.05)
        cache.set("slug", "production", mock_raw)
        time.sleep(0.1)
        assert cache.get("slug", "production") is None

    def test_invalidates_slug(self, mock_raw):
        cache = PromptCache()
        cache.set("slug", "production", mock_raw)
        cache.set("slug", "staging", mock_raw)
        cache.invalidate("slug")
        assert cache.get("slug", "production") is None
        assert cache.get("slug", "staging") is None

# ── Similarity scorer ─────────────────────────

class TestSimilarity:
    @pytest.mark.asyncio
    async def test_identical_strings_score_one(self):
        score = await _default_similarity("hello world", "hello world")
        assert score == 1.0

    @pytest.mark.asyncio
    async def test_empty_strings_score_one(self):
        score = await _default_similarity("", "")
        assert score == 1.0

    @pytest.mark.asyncio
    async def test_completely_different_scores_zero(self):
        score = await _default_similarity("cat dog bird", "apple banana mango")
        assert score == 0.0