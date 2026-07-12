# ADR 0001 — Split frontend (Vercel) from model backend (HF Spaces); Postgres; RAGTruth

**Status:** Accepted · 2026-07-11

## Context

The platform scores an LLM's answers for hallucination using a local NLI model
(DeBERTa-v3-large, ~1.6 GB) plus sentence-transformers embeddings and ChromaDB,
persists benchmarks/runs, and must deploy on free tiers with a web UI.

## Decision 1 — Two services, not one

The frontend is a **Next.js app on Vercel**; the scoring API is a **FastAPI
service on a Hugging Face Docker Space**.

*Why:* Vercel's free tier runs serverless/static workloads (250 MB unzipped
function limit, ephemeral filesystem) — it cannot host a multi-GB torch model or
a long-lived scoring process. HF Spaces gives a free, persistent CPU container
that keeps the model warm. Splitting them lets each run where it fits and scales
independently.

*Tradeoff:* cross-origin calls and a network hop; mitigated by scoped CORS and a
server-side token proxy in Next.js so the API token never reaches the browser.

## Decision 2 — Neon Postgres, not SQLite

*Why:* SQLite is a local file — on an ephemeral Space it is wiped on rebuild and
cannot be shared if the backend ever scales past one instance. Neon (free tier)
gives durable, managed Postgres with a real connection story (pooling, JSONB,
concurrent runs). It is explicitly **not** Supabase, per project constraint.

*Tradeoff:* a managed dependency and network latency per query; acceptable for
this workload and handled with a small psycopg connection pool.

## Decision 3 — RAGTruth as the benchmark

*Why:* The original tool generated its own questions with an LLM and had no gold
labels, so it could only report self-referential scores. RAGTruth is a
human-annotated hallucination corpus (query + retrieved context + an LLM answer
+ span-level labels). Scoring **RAGTruth's own answer** against its context lets
us report the detector's **precision/recall/F1 vs human judgments** — a real,
defensible quality metric.

*Consequence:* labeled runs skip generation and score the stored answer; user
benchmarks (no stored answer) generate then score. One `answer`-present branch in
the runner encodes this.

## Decision 4 — Mapping the 3-way label to the binary gold space

The detector emits `GROUNDED` / `PARTIALLY_GROUNDED` / `HALLUCINATED`; RAGTruth
labels are binary (`hallucinated` / `grounded`, positive = hallucinated). We map
`PARTIALLY_GROUNDED → hallucinated` (a partially grounded answer contains
hallucinated content). The mapping is a single documented function
(`eval/scoring.label_to_binary`, `partial_is_hallucinated` toggle) so the
threshold is explicit and tunable, not buried in the runner.

## What happens at 10× load

Today: one Space, one small pool, background-task runs. At 10× concurrent runs
the bottlenecks, in order, are (1) the single CPU Space's NLI throughput —
addressed by moving scoring to a queue + worker (or GPU Space) and returning run
IDs immediately (the API already does async background runs); (2) Postgres
connections — the pool caps at 5, and Neon's pooled endpoint absorbs more; (3)
provider rate limits — per-provider concurrency limits and retries. The
frontend/DB split means each can scale without touching the others.
