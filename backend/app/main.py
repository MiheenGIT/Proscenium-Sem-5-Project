from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.auth import router as auth
from app.routes.director import router as director_router
from app.routes.admin import router as admin_router
from app.routes.viewer import router as viewer_router

app = FastAPI(title="Proscenium")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth, tags=["Auth"])
app.include_router(director_router, tags=["directors"])
app.include_router(admin_router, tags=["admin"])
app.include_router(viewer_router, tags=["viewer"])

@app.get("/")
def root():
    return {"message": "Proscenium is active"}