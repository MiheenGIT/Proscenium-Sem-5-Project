import os
import time
from collections import deque
from threading import Lock


class SlidingWindowLimiter:
    """In-memory sliding-window limiter. Per-process: use a shared store (e.g. Redis) behind multiple workers."""

    def __init__(self, max_keys=20000, idle_seconds=3600):
        self._hits = {}
        self._lock = Lock()
        self._max_keys = max_keys
        self._idle = idle_seconds

    def allow(self, key, limit, window_seconds):
        now = time.monotonic()
        with self._lock:
            if len(self._hits) > self._max_keys:
                self._prune(now)
            hits = self._hits.setdefault(key, deque())
            cutoff = now - window_seconds
            while hits and hits[0] <= cutoff:
                hits.popleft()
            if len(hits) >= limit:
                return False
            hits.append(now)
            return True

    def _prune(self, now):
        stale = [key for key, hits in self._hits.items() if not hits or hits[-1] < now - self._idle]
        for key in stale:
            del self._hits[key]
        if len(self._hits) > self._max_keys:
            self._hits.clear()  # last resort: bounded memory beats perfect accounting


def client_ip(request):
    """Client address; X-Forwarded-For is only honoured when TRUST_PROXY=1 (i.e. behind your own proxy)."""
    if os.getenv("TRUST_PROXY") == "1":
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
