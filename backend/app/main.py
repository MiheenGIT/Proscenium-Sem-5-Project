from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.auth import router as auth
from app.routes.director import router as director_router
from app.routes.admin import router as admin_router

app = FastAPI(title="Proscenium")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth, tags=["Auth"])
app.include_router(director_router, tags=["directors"])
app.include_router(admin_router, tags=["admin"])

@app.get("/")
def root():
    return {"message": "Proscenium is active"}