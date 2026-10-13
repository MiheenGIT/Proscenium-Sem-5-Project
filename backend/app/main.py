import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.auth import router as auth
from app.routes.director import router as director_router
from app.routes.admin import router as admin_router
from app.routes.viewer import router as viewer_router
from app.routes.notifications import router as notifications_router
from app.routes.analytics import router as analytics_router, ensure_event_indexes
from utils.api_telemetry import install_api_telemetry

DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
]
# Production: ALLOWED_ORIGINS="https://app.example.com,https://www.example.com"
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()] or DEFAULT_ORIGINS

app = FastAPI(title="Proscenium")
install_api_telemetry(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth, tags=["Auth"])
app.include_router(director_router, tags=["directors"])
app.include_router(admin_router, tags=["admin"])
app.include_router(viewer_router, tags=["viewer"])
app.include_router(notifications_router, tags=["notifications"])
app.include_router(analytics_router, tags=["Analytics"])


@app.on_event("startup")
def init_analytics_indexes():
    ensure_event_indexes()


@app.get("/")
def root():
    return {"message": "Proscenium is active"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )