# LLM Eval Platform — Backend

FastAPI service that scores LLM answers for hallucination against reference
documents using an NLI detector (DeBERTa-v3-large), stores runs in Postgres
(Neon), and evaluates the detector against the human-labeled RAGTruth benchmark.

Deploys as a Docker container on **GCP Cloud Run**. The Next.js frontend (on
Vercel) talks to it over HTTPS.

## Required env vars (Cloud Run `--set-env-vars`)

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string (`postgresql://…?sslmode=require`) |
| `APP_API_TOKEN` | Shared bearer token; the frontend sends it on mutating calls |
| `FRONTEND_ORIGIN` | Allowed CORS origin(s), e.g. `https://your-app.vercel.app` |
| `OPENAI_API_KEY` etc. | Provider keys (optional). Set free-tier ones (Groq/Gemini/Mistral) so the demo works out of the box; users can **BYOK** (paste their own key per run) for any provider, which takes priority over these. |

The service fails fast on startup if `DATABASE_URL` or `APP_API_TOKEN` is unset.

## Deploy

```bash
gcloud run deploy llm-eval-backend --source . --region us-central1 \
  --allow-unauthenticated --memory 4Gi --cpu 2 --no-cpu-throttling \
  --min-instances 0 --timeout 3600 \
  --set-env-vars "DATABASE_URL=...,APP_API_TOKEN=...,FRONTEND_ORIGIN=https://<app>.vercel.app"
```

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
