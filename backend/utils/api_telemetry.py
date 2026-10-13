"""Writes one `api_request` event per API call so the Platform Health tab has data.

Usage in main.py, right after `app = FastAPI(...)`:

    from api_telemetry import install_api_telemetry
    install_api_telemetry(app)
"""
import asyncio
import time
from datetime import datetime, timedelta

from database import analytics_events_collection

API_LOG_RETENTION_DAYS = 30
_SKIP_PREFIXES = ("/analytics", "/docs", "/redoc", "/openapi")


def _insert(doc):
    try:
        analytics_events_collection.insert_one(doc)
    except Exception:
        pass  # telemetry must never break a request


def install_api_telemetry(app):
    @app.middleware("http")
    async def record_api_request(request, call_next):
        started = time.perf_counter()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            return response
        finally:
            path = request.url.path
            if not path.startswith(_SKIP_PREFIXES) and request.method != "OPTIONS":
                now = datetime.utcnow()
                doc = {
                    "eventType": "api_request",
                    "path": path[:250],
                    "method": request.method,
                    "statusCode": status,
                    "durationMs": round((time.perf_counter() - started) * 1000, 1),
                    "createdAt": now,
                    "expireAt": now + timedelta(days=API_LOG_RETENTION_DAYS),
                }
                # The insert is blocking, so run it in a worker thread.
                asyncio.get_running_loop().run_in_executor(None, _insert, doc)