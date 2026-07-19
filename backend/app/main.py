from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.auth import router as auth
from app.routes.director import router as director_router

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

@app.get("/")
def root():
    return {"message": "Proscenium is active"}