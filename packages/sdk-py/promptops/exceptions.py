# ─────────────────────────────────────────────
#  PromptOps Python SDK — Exceptions
# ─────────────────────────────────────────────


class PromptOpsError(Exception):
    """Base exception for all PromptOps errors."""
    def __init__(self, message: str, code: str = "UNKNOWN", status: int | None = None):
        super().__init__(message)
        self.code = code
        self.status = status


class PromptOpsNotFoundError(PromptOpsError):
    def __init__(self, slug: str, env: str):
        super().__init__(
            f'Prompt "{slug}" not found in environment "{env}". '
            f'Make sure it exists and has been promoted to this environment.',
            code="NOT_FOUND",
            status=404,
        )


class PromptOpsUnauthorizedError(PromptOpsError):
    def __init__(self):
        super().__init__(
            "Invalid or missing API key. "
            "Set PROMPTOPS_KEY in your environment or pass api_key to the client.",
            code="UNAUTHORIZED",
            status=401,
        )


class PromptOpsTimeoutError(PromptOpsError):
    def __init__(self, timeout: float):
        super().__init__(
            f"Request timed out after {timeout}s. "
            f"Increase the timeout option or check your server connection.",
            code="TIMEOUT",
        )


class PromptOpsNetworkError(PromptOpsError):
    def __init__(self, cause: Exception):
        super().__init__(
            f"Network error while contacting PromptOps server: {cause}",
            code="NETWORK",
        )
        self.__cause__ = cause


class PromptOpsCompileError(PromptOpsError):
    def __init__(self, message: str):
        super().__init__(message, code="COMPILE")