# Proscenium — frontend (auth pages)

## Setup

```bash
npm install
cp .env.example .env   # set VITE_API_BASE_URL if your backend isn't on :8000
npm run dev
```

Runs at `http://localhost:5173`.

## What's here

- `/login` — email + password, posts to `POST /auth/login`
- `/register` — Viewer/Director toggle, posts multipart form data to
  `POST /auth/register/viewer` or `POST /auth/register/creator`
  (matches `ViewerRegister` / `CreatorRegister` schemas, including
  optional avatar upload)
- `/director` — placeholder landing page behind a role guard, to be
  replaced by the real director panel

Auth state (`token`, `role`, `username`, `userId`) is kept in
`localStorage` via `AuthContext` — nothing else touches the backend
yet.

## Before this will work: enable CORS on the backend

The FastAPI app doesn't currently have `CORSMiddleware` configured
anywhere in the files shared with me. Without it, the browser will
block every request from `localhost:5173` to `localhost:8000` with a
CORS error, even though curl/Postman work fine (they don't enforce
CORS). Add this wherever your `FastAPI()` app instance is created
(likely `main.py`):

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Not built yet

- The real director dashboard (video list/upload/moderation) —
  waiting on the missing "list my videos" and "get one video" routes
  we flagged earlier.
- Viewer-side pages — your partner's scope.
