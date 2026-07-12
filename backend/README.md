---
title: LLM Eval Platform Backend
emoji: 🔎
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# LLM Eval Platform — Backend

FastAPI service that scores LLM answers for hallucination against reference
documents using an NLI detector (DeBERTa-v3-large), stores runs in Postgres
(Neon), and evaluates the detector against the human-labeled RAGTruth benchmark.

Deploys as a Hugging Face **Docker** Space. The Next.js frontend (on Vercel)
talks to it over HTTPS.

## Required Space secrets

| Secret | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string (`postgresql://…?sslmode=require`) |
| `APP_API_TOKEN` | Shared bearer token; the frontend sends it on mutating calls |
| `FRONTEND_ORIGIN` | Allowed CORS origin(s), e.g. `https://your-app.vercel.app` |
| `OPENAI_API_KEY` etc. | Provider keys for whichever providers you enable (optional) |

The service fails fast on startup if `DATABASE_URL` or `APP_API_TOKEN` is unset.

## Run locally

```bash
cd backend
python -m venv .venv && . .venv/Scripts/activate   # torch-only; no tensorflow
pip install torch==2.6.0 --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
export DATABASE_URL=postgresql://...   APP_API_TOKEN=dev-token
uvicorn api.main:app --reload --port 8000   # docs at /docs
```

## Tests

```bash
cd backend
pytest -m "not slow"          # DB tests need DATABASE_URL, else skipped
```
