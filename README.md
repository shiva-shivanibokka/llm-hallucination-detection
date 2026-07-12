# LLM Hallucination Eval Platform

Benchmark and compare LLMs for hallucination against reference documents — and
measure the hallucination detector itself against the **human-labeled RAGTruth
corpus** (precision / recall / F1), not just self-generated scores.

- **Frontend (Vercel):** _add your Vercel URL_
- **Backend API (GCP Cloud Run):** _add your Cloud Run URL_ · API docs at `/docs`

## Why

Most hallucination tools check a single response and report a number with nothing
to calibrate it against. This platform is built around the workflow that matters:
define a benchmark, run models against it, compare hallucination rates, and — the
part most portfolios skip — **quantify how well the detector agrees with human
labels** on an established benchmark (RAGTruth). That agreement (F1) is the
headline result.

The scoring engine runs a local NLI model (DeBERTa-v3-large): every sentence of
an answer is classified GROUNDED / UNGROUNDED / CONTRADICTED against the
retrieved reference chunks.

## Architecture

```
  Vercel (free)                     GCP Cloud Run — Docker
  ┌───────────────────┐   HTTPS     ┌──────────────────────────────────────┐
  │ Next.js frontend  │  + bearer   │ FastAPI                              │
  │ 5 screens         │ ──token──▶  │  ├─ DeBERTa-v3-large NLI detector    │
  │ server-side proxy │             │  ├─ sentence-transformers + ChromaDB │
  └───────────────────┘             │  └─ RAGTruth loader (human labels)   │
                                    └───────────────┬──────────────────────┘
                                                    │
                                            Neon Postgres (free, via Vercel)
                                     benchmarks · cases · runs · results · metrics
```

Design rationale (why two services, why Postgres, why RAGTruth, the label
mapping, behavior at 10× load): [`docs/adr/0001-frontend-backend-split.md`](docs/adr/0001-frontend-backend-split.md).

## Repo layout

```
backend/    FastAPI + NLI detector + Postgres + RAGTruth loader   (deploys to GCP Cloud Run)
frontend/   Next.js App Router + Tailwind                          (deploys to Vercel)
docs/       ADR + implementation plan
.github/    CI (lint + tests + frontend build)
```

## Run locally

**Backend** (torch-only; do not install tensorflow):
```bash
cd backend
python -m venv .venv && . .venv/Scripts/activate
pip install torch==2.6.0 --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
export DATABASE_URL=postgresql://...   APP_API_TOKEN=dev-token
uvicorn api.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
# .env.local:  NEXT_PUBLIC_API_BASE=http://localhost:8000   APP_API_TOKEN=dev-token
npm run dev
```

## Deploy

1. **Neon** — provision Postgres via the Vercel Neon integration (`vercel
   integration add neon`); copy the `DATABASE_URL`.
2. **GCP Cloud Run** (backend) — from `backend/`:
   ```bash
   gcloud run deploy llm-eval-backend --source backend --region us-central1 \
     --allow-unauthenticated --memory 4Gi --cpu 2 --no-cpu-throttling \
     --min-instances 0 --timeout 3600 \
     --set-env-vars "DATABASE_URL=...,APP_API_TOKEN=...,FRONTEND_ORIGIN=https://<your>.vercel.app"
   ```
   (`--no-cpu-throttling` lets background eval runs finish; the frontend's polling
   also keeps the instance warm. Copy the printed service URL.)
3. **Vercel** (frontend) — project root `frontend/`; set `NEXT_PUBLIC_API_BASE`
   (Cloud Run URL) and `APP_API_TOKEN` (server-only, same value as the backend).

## Tests & CI

`pytest backend -m "not slow"` (DB tests need `DATABASE_URL`, else skipped);
`cd frontend && npm run build`. CI runs both on every push/PR.

## How the detector is scored

RAGTruth ships each answer with human hallucination labels. A RAGTruth run scores
those stored answers with the NLI detector and compares the verdicts to the human
labels, reporting **precision / recall / F1 / accuracy** (positive class =
hallucinated). Seed it from the **RAGTruth** screen, run it, and view the metric
card on **Results**.

## Stack

| Component | Technology |
|---|---|
| NLI model | `cross-encoder/nli-deberta-v3-large` |
| Embeddings | `sentence-transformers/all-MiniLM-L6-v2` |
| Vector store | ChromaDB (in-memory, isolated per test case) |
| Database | Neon Postgres (provisioned via Vercel) |
| Dataset | RAGTruth (`wandb/RAGTruth-processed`) |
| LLM providers | OpenAI, Anthropic, Groq, Mistral, Gemini, Ollama (OpenAI-compatible) — **BYOK**: paste your own key per run, or fall back to the server's free-tier keys |
| Backend | FastAPI + Pydantic + Uvicorn, on GCP Cloud Run (Docker) |
| Frontend | Next.js (App Router) + Tailwind, on Vercel |
