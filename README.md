# LLM Hallucination Eval Platform

Benchmark and compare LLMs for hallucination against reference documents — and
measure the hallucination detector itself against the **human-labeled RAGTruth
corpus** (precision / recall / F1), not just self-generated scores.

- **Frontend (Vercel):** _add your Vercel URL_
- **Backend API (HF Space):** _add your Space URL_ · API docs at `/docs`

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
  Vercel (free)                     Hugging Face Space — Docker (free)
  ┌───────────────────┐   HTTPS     ┌──────────────────────────────────────┐
  │ Next.js frontend  │  + bearer   │ FastAPI                              │
  │ 5 screens         │ ──token──▶  │  ├─ DeBERTa-v3-large NLI detector    │
  │ server-side proxy │             │  ├─ sentence-transformers + ChromaDB │
  └───────────────────┘             │  └─ RAGTruth loader (human labels)   │
                                    └───────────────┬──────────────────────┘
                                                    │
                                            Neon Postgres (free)
                                     benchmarks · cases · runs · results · metrics
```

Design rationale (why two services, why Postgres, why RAGTruth, the label
mapping, behavior at 10× load): [`docs/adr/0001-frontend-backend-split.md`](docs/adr/0001-frontend-backend-split.md).

## Repo layout

```
backend/    FastAPI + NLI detector + Postgres + RAGTruth loader   (deploys to HF Spaces)
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

## Deploy (all free tier)

1. **Neon** — create a Postgres project; copy the connection string.
2. **HF Space** — create a Docker Space from `backend/`; set secrets
   `DATABASE_URL`, `APP_API_TOKEN`, `FRONTEND_ORIGIN`, and any provider keys.
3. **Vercel** — import the repo, root directory `frontend/`; set
   `NEXT_PUBLIC_API_BASE` (Space URL) and `APP_API_TOKEN` (server-only).

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
| Database | Neon Postgres |
| Dataset | RAGTruth (`wandb/RAGTruth-processed`) |
| LLM providers | OpenAI, Anthropic, Groq, Mistral, Gemini, Ollama (OpenAI-compatible) |
| Backend | FastAPI + Pydantic + Uvicorn, on HF Spaces (Docker) |
| Frontend | Next.js (App Router) + Tailwind, on Vercel |
