import time
from collections import defaultdict
from typing import Dict, List
from fastapi import HTTPException, status
from app.core.config import settings


class InMemoryRateLimiter:
    """
    Simple in-memory sliding-window rate limiter for sensitive endpoints like /auth/login.
    
    NOTE ON PRODUCTION LIMITATION:
    This rate limiter maintains state in memory inside the running Python process.
    If the application is horizontally scaled across multiple instances or worker processes,
    rate limit counters will not be synchronized across instances. In a distributed multi-instance
    production environment, an external in-memory data store like Redis (using token bucket or
    atomic INCR/EXPIRE scripts) should be used instead.
    """
    def __init__(self, max_attempts: int, window_seconds: int):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        # key -> list of attempt timestamps
        self.attempts: Dict[str, List[float]] = defaultdict(list)

    def check(self, key: str) -> None:
        now = time.time()
        window_start = now - self.window_seconds
        
        # Filter attempts within current sliding window
        valid_attempts = [t for t in self.attempts[key] if t > window_start]
        self.attempts[key] = valid_attempts

        if len(valid_attempts) >= self.max_attempts:
            retry_after = int(self.window_seconds - (now - valid_attempts[0])) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error": "rate_limit_exceeded",
                    "message": f"Too many login attempts. Please try again in {retry_after} seconds."
                },
                headers={"Retry-After": str(retry_after)}
            )

    def record_attempt(self, key: str) -> None:
        self.attempts[key].append(time.time())

    def reset(self, key: str) -> None:
        """Clear attempts on successful login."""
        if key in self.attempts:
            del self.attempts[key]


login_limiter = InMemoryRateLimiter(
    max_attempts=settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    window_seconds=settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS
)
