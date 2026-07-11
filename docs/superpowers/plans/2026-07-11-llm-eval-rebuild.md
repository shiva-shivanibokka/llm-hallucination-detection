# LLM Eval Platform — Production Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the local Gradio+FastAPI hallucination tool into a deployed, credible portfolio platform: a Next.js frontend on Vercel calling a FastAPI backend on a Hugging Face Docker Space, scoring an LLM's answers against the **real, human-labeled RAGTruth benchmark**, with run history in Neon Postgres, auth, observability, tests, and CI.

**Architecture:** Two deployed services. **Vercel** hosts a Next.js App Router frontend (5 screens) that talks over HTTPS to a **Hugging Face Docker Space** running FastAPI + the DeBERTa NLI detector + per-case ChromaDB. Persistent state (benchmarks, test cases, runs, results) lives in **Neon Postgres**. LLM provider keys live server-side in HF Secrets; the public API is guarded by a bearer token. RAGTruth provides real questions, reference passages, and gold hallucination labels, so the platform reports the detector's agreement with human judgments (precision/recall/F1), not just self-generated scores.

**Tech Stack:** Python 3.12, FastAPI, Pydantic, psycopg 3, transformers/torch (DeBERTa-v3-large NLI), sentence-transformers + ChromaDB, `datasets` (RAGTruth), pytest + ruff; Next.js 15 (App Router, TypeScript) + Tailwind on Vercel; Neon Postgres; Docker (HF Spaces); GitHub Actions.

## Global Constraints

- **Free tier only.** Vercel Hobby, HF Spaces free CPU, Neon free tier. No paid compute, no Supabase.
- **Secrets never in code or client.** Provider API keys live only in HF Space Secrets (server-side). The Next.js client never holds a provider key; it sends a single app bearer token (`APP_API_TOKEN`) to the backend.
- **Pinned dependencies.** All Python deps pinned to exact versions in `requirements.txt` (no `>=`). The pin set must not reproduce the local `import sentence_transformers` segfault (torch / onnxruntime / protobuf compatible).
- **Postgres, not SQLite.** All persistence via `DATABASE_URL` (Neon). No `sqlite3` in the shipped backend.
- **Repo rename:** target repo name is `llm-hallucination-detection` (current name misspells "Hallucination"). Rename on GitHub as the final step; update README/clone URLs.
- **Every backend change ships with a test** runnable in CI (CI env imports `sentence_transformers` cleanly; heavy model tests are marked `@pytest.mark.slow` and skipped by default).
- **TDD, DRY, YAGNI, frequent commits.**

---

## File Structure (target)

```
llm-hallucination-detection/
├── backend/
│   ├── api/main.py                FastAPI app: routes, auth, CORS, /health
│   ├── core/
│   │   ├── detector.py            NLI scoring (unchanged logic, kept)
│   │   ├── generator.py           LLM wrapper (keys from env/secrets only)
│   │   ├── ingestor.py            text chunking (URL/PDF paths trimmed to what's used)
│   │   └── vector_store.py        ChromaDB, per-instance collection (already fixed)
│   ├── db/
│   │   ├── database.py            psycopg pool, DATABASE_URL, init/migrate
│   │   └── models.py              CRUD (Postgres SQL)
│   ├── eval/
│   │   ├── runner.py              run a benchmark end-to-end
│   │   └── scoring.py             detector-vs-gold-label metrics (P/R/F1)
│   ├── data/ragtruth.py          RAGTruth loader → benchmarks/test_cases
│   ├── migrations/               *.sql schema files, applied in order
│   ├── tests/                    pytest (unit + label-metric + isolation)
│   ├── Dockerfile                HF Space image (non-root)
│   ├── requirements.txt          pinned
│   └── README.md                 HF Space card (metadata header + usage)
├── frontend/                     Next.js app (deploys to Vercel)
│   ├── app/                      App Router: /, /run, /results, /compare, /dataset
│   ├── lib/api.ts                typed API client (bearer token, base URL from env)
│   ├── components/               shared UI
│   └── ... (next config, tailwind, tsconfig, package.json)
├── docs/
│   ├── adr/0001-frontend-backend-split.md
│   └── superpowers/plans/2026-07-11-llm-eval-rebuild.md
├── .github/workflows/ci.yml      lint + test backend, build frontend
└── README.md                     root: what/why/architecture/deploy
```

Note the top-level `backend/` + `frontend/` split is new — Task 1 moves the existing Python packages under `backend/` so the two deployables are cleanly separated.

---

## PHASE A — Foundation & cleanup (existing repo)

### Task 1: Restructure into backend/ + delete dead code

**Files:**
- Move: `api/ core/ db/ eval/` → `backend/api/ backend/core/ backend/db/ backend/eval/`
- Move: `tests/` → `backend/tests/`
- Delete: `detector/`, `llm/`, `ingestor/` (byte-identical dead duplicates), `app.py` (Gradio, replaced by Next.js)
- Delete unused functions in `backend/core/generator.py`: `generate_ungrounded`, `extract_claims`, `get_models_for_provider`, `get_all_providers`, `MODEL_TO_PROVIDER`
- Delete unused functions in `backend/core/ingestor.py`: `extract_url_chunks`, `_fetch_with_requests`, `_fetch_with_playwright`, `extract_pdf_chunks` (PDF read happens client-side today; keep only `extract_text_chunks` + helpers). Drop `beautifulsoup4`, `playwright` from requirements.
- Modify: `requirements.txt` → `backend/requirements.txt`

**Interfaces:**
- Produces: package root is now `backend/` (run backend with `cd backend && uvicorn api.main:app`). Import paths within backend stay `core.*`, `db.*`, `eval.*`.

- [ ] **Step 1: Move packages** — `git mv` each of `api core db eval tests` under `backend/`.
- [ ] **Step 2: Delete dead trees** — `git rm -r detector llm ingestor app.py`.
- [ ] **Step 3: Remove unused functions** listed above (verify with grep that nothing imports them first: `grep -rn "generate_ungrounded\|extract_claims\|extract_url_chunks\|extract_pdf_chunks\|MODEL_TO_PROVIDER\|get_all_providers\|get_models_for_provider" backend/`). Expected: no hits after removal.
- [ ] **Step 4: Run isolation test** — `cd backend && PYTHONPATH=. python tests/test_vector_store_isolation.py` (in a clean env; on the dev machine it may segfault — see Task 2). Expected in clean env: `PASS`.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "refactor: split into backend/, delete dead duplicate trees and unused functions"`.

### Task 2: Pin dependencies and resolve the local segfault

**Root cause (from audit):** `import sentence_transformers` segfaults on the dev machine — a native DLL conflict among torch / onnxruntime / protobuf. Unpinned `>=` deps let incompatible native wheels resolve.

**Files:**
- Modify: `backend/requirements.txt` (exact pins)
- Create: `backend/constraints.txt` (optional transitive pins if needed)

**Interfaces:**
- Produces: a dependency set where `python -c "import sentence_transformers"` exits 0.

- [ ] **Step 1: Write the failing check** — `backend/tests/test_env_imports.py`:
```python
import subprocess, sys
def test_sentence_transformers_imports_without_crash():
    r = subprocess.run([sys.executable, "-c", "import sentence_transformers"],
                       capture_output=True)
    assert r.returncode == 0, f"segfault/import failure: rc={r.returncode} {r.stderr[-500:]}"
```
- [ ] **Step 2: Run it** — `cd backend && pytest tests/test_env_imports.py -v`. Expected: FAIL (rc=139) on the current machine.
- [ ] **Step 3: Pin a compatible set** in `requirements.txt`. Resolve versions empirically in a fresh venv until Step 4 passes; start from:
```
torch==2.6.0
transformers==4.46.3
sentence-transformers==3.3.1
chromadb==0.5.23
onnxruntime==1.19.2
protobuf==5.28.3
tokenizers==0.20.3
huggingface-hub==0.26.2
openai==1.57.4
pypdf==5.1.0
fastapi==0.115.6
uvicorn==0.34.0
pydantic==2.10.4
python-multipart==0.0.19
python-dotenv==1.0.1
psycopg[binary]==3.2.3
datasets==3.2.0
```
  (Pin the exact combination that resolves the segfault in a fresh venv: `python -m venv .v && .v/Scripts/pip install -r requirements.txt`. If torch 2.6+onnxruntime still conflict, drop torch to `2.5.1` or set `onnxruntime==1.20.1` and re-test. Record the working combination.)
- [ ] **Step 4: Verify** — `pytest tests/test_env_imports.py -v`. Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -am "fix: pin deps to a native-compatible set (resolves sentence_transformers segfault)"`.

### Task 3: Structured logging + surface failures (I2)

**Files:**
- Create: `backend/core/logging_config.py`
- Modify: `backend/eval/runner.py`, `backend/db/models.py` (`fail_run` stores reason), `backend/db/database.py` schema (`eval_runs.error` column — folded into Phase B schema)

**Interfaces:**
- Produces: `get_logger(name) -> logging.Logger` emitting JSON lines (ts, level, logger, msg, extra).
- Produces: failed runs persist their error; `GET /runs/{id}` returns `error` field.

- [ ] **Step 1: Failing test** — `backend/tests/test_fail_run_stores_reason.py`: create a run, call `fail_run(conn, run_id, "boom")`, assert `get_run(...)["error"] == "boom"` and `status == "failed"`. (Uses the Postgres test DB from Phase B; if Phase B not yet done, run this task after Task 5.)
- [ ] **Step 2: Run it** — Expected: FAIL (`error` not stored / column missing).
- [ ] **Step 3: Implement** — add `error TEXT` to `eval_runs` (migration in Task 5); update `fail_run`:
```python
def fail_run(conn, run_id, reason):
    conn.execute("UPDATE eval_runs SET status='failed', error=%s, completed_at=now() WHERE id=%s",
                 (reason[:2000], run_id))
    conn.commit()
```
  In `runner.py`, replace the swallowed per-case error string with a logged warning and a stored sentinel that scoring treats as fully-hallucinated (do not score `[ERROR: ...]` text as a real answer):
```python
except Exception as e:
    log.warning("generation_failed", extra={"run_id": run_id, "case_id": tc["id"], "err": str(e)})
    response = None  # scoring: None -> overall HALLUCINATED, score 1.0, no NLI on error text
```
  Update `detector.analyze` call site to short-circuit when `response is None`.
- [ ] **Step 4: Verify** — test passes; add `backend/tests/test_runner_error_case.py` asserting a generation failure yields a `HALLUCINATED` result row with score `1.0` and does not raise.
- [ ] **Step 5: Commit** — `git commit -am "feat: structured logging + persist run failure reasons; stop scoring error text"`.

---

## PHASE B — Persistence on Neon Postgres

### Task 4: Postgres connection layer

**Files:**
- Modify: `backend/db/database.py`

**Interfaces:**
- Produces: `get_connection()` → psycopg connection from a module-level `ConnectionPool` opened on `DATABASE_URL`; `init_db()` applies `migrations/*.sql` in filename order (idempotent). Fails loudly at startup if `DATABASE_URL` is unset.

- [ ] **Step 1: Failing test** — `backend/tests/test_db_connection.py`: with `DATABASE_URL` unset, `get_connection()` raises `RuntimeError("DATABASE_URL not set")`; with it set (CI service Postgres), a `SELECT 1` returns `1`.
- [ ] **Step 2: Run it** — Expected: FAIL.
- [ ] **Step 3: Implement**:
```python
import os
from psycopg_pool import ConnectionPool
from psycopg.rows import dict_row

_DSN = os.getenv("DATABASE_URL")
_pool = None

def _get_pool():
    global _pool
    if not _DSN:
        raise RuntimeError("DATABASE_URL not set")
    if _pool is None:
        _pool = ConnectionPool(_DSN, min_size=1, max_size=5, kwargs={"row_factory": dict_row})
    return _pool

def get_connection():
    return _get_pool().connection()   # context manager: `with get_connection() as conn:`
```
  `init_db()` reads each file in `migrations/` sorted, executes it inside a transaction, tracks applied files in a `schema_migrations(filename TEXT PRIMARY KEY)` table.
- [ ] **Step 4: Verify** — Expected: PASS (against CI Postgres service).
- [ ] **Step 5: Commit** — `git commit -am "feat: Neon/Postgres connection pool + migration runner"`.

### Task 5: Postgres schema + migrate CRUD

**Files:**
- Create: `backend/migrations/0001_init.sql`, `backend/migrations/0002_labels_and_metrics.sql`
- Modify: `backend/db/models.py` (Postgres SQL: `SERIAL`/`IDENTITY`, `now()`, `%s` params, `RETURNING *` already OK; `get_connection()` usage stays `with ... as conn`)

**Interfaces:**
- Consumes: `get_connection()` (Task 4).
- Produces: same `models.py` function names/signatures as today, plus:
  - `test_cases` gains `gold_label TEXT NULL` (`'hallucinated'|'grounded'|NULL`) and `answer TEXT NULL` (RAGTruth model answer, when present).
  - `run_results` gains `predicted_label TEXT` (mapped from `overall_label` to the binary gold space).
  - `eval_runs` gains `error TEXT NULL`, `dataset TEXT NULL`.

- [ ] **Step 1: Write `0001_init.sql`** — the four tables from `db/database.py` translated to Postgres (`id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, FKs `ON DELETE CASCADE`, unique on `benchmarks.name`). Write `0002_labels_and_metrics.sql` adding the columns above + a `run_metrics(run_id BIGINT PK REFERENCES eval_runs ON DELETE CASCADE, precision REAL, recall REAL, f1 REAL, accuracy REAL, n INT)` table.
- [ ] **Step 2: Failing test** — `backend/tests/test_models_crud.py`: create benchmark → add case (with `gold_label`) → create run → add result (with `predicted_label`) → assert round-trips via `get_*`. Run: Expected FAIL (SQL not yet Postgres-valid).
- [ ] **Step 3: Port each CRUD function** in `models.py` to psycopg (`%s` placeholders, `conn.execute(...).fetchone()` returns dict via `dict_row`). Remove `json.loads`/`json.dumps` for `sentence_results` in favor of a `JSONB` column (store dict directly).
- [ ] **Step 4: Verify** — `pytest tests/test_models_crud.py -v`. Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat: Postgres schema + label/metric columns; port CRUD to psycopg"`.

---

## PHASE C — Real dataset (RAGTruth) + labeled evaluation

### Task 6: RAGTruth loader

**Files:**
- Create: `backend/data/ragtruth.py`
- Create: `backend/tests/test_ragtruth_loader.py`

**Background:** RAGTruth annotates LLM responses in RAG settings with span-level hallucination labels. We derive a per-case binary gold label: a case is `hallucinated` if its response has ≥1 annotated hallucination span, else `grounded`. Each case stores `question` (the RAG prompt/query), `reference_text` (the retrieved context), `answer` (the model response RAGTruth annotated), and `gold_label`.

**Interfaces:**
- Produces: `load_ragtruth(split: str, limit: int|None) -> list[RagCase]` where `RagCase = {question, reference_text, answer, gold_label, domain, source_type}`.
- Produces: `seed_ragtruth_benchmark(conn, name, split, limit) -> {benchmark_id, added}` — creates a benchmark and inserts the cases.

- [ ] **Step 1: Failing test** — assert `load_ragtruth("train", limit=5)` returns 5 `RagCase`s, each with non-empty `question`/`reference_text` and `gold_label in {"hallucinated","grounded"}`. Mark `@pytest.mark.slow` (network/dataset download).
- [ ] **Step 2: Run it** — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** using `datasets.load_dataset` for RAGTruth (resolve the current canonical HF dataset id at build time, e.g. `wandb/RAGTruth-processed` or `ParticleMedia/RAGTruth`; pin the id + revision in the module and document it in the ADR). Map fields → `RagCase`; derive `gold_label` from the presence of hallucination annotations; set `source_type="public"` (RAGTruth is public → contamination-aware) and `domain` from RAGTruth's task type (QA/Summary/Data2txt → `general`).
- [ ] **Step 4: Verify** — `pytest tests/test_ragtruth_loader.py -v -m slow`. Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat: RAGTruth loader with binary gold labels"`.

### Task 7: Detector-vs-gold metrics + endpoint

**Files:**
- Create: `backend/eval/scoring.py`
- Modify: `backend/eval/runner.py` (write `predicted_label`, compute metrics at end of run when gold labels exist), `backend/api/main.py` (`GET /runs/{id}/metrics`)

**Interfaces:**
- Consumes: run results with `predicted_label` + test cases with `gold_label`.
- Produces: `binary_metrics(pairs: list[tuple[str,str]]) -> {precision,recall,f1,accuracy,n}` where each pair is `(predicted, gold)` over labels `{"hallucinated","grounded"}` (positive class = `hallucinated`).
- Produces: mapping `overall_label → predicted binary`: `HALLUCINATED`/`PARTIALLY_GROUNDED` → `hallucinated`; `GROUNDED` → `grounded` (document this threshold choice in the ADR; make the partial mapping configurable).

- [ ] **Step 1: Failing test** — `backend/tests/test_scoring.py`:
```python
from eval.scoring import binary_metrics
def test_f1_on_known_pairs():
    pairs = [("hallucinated","hallucinated"),("hallucinated","grounded"),
             ("grounded","grounded"),("grounded","hallucinated")]
    m = binary_metrics(pairs)
    assert m["n"] == 4
    assert round(m["precision"],3) == 0.5 and round(m["recall"],3) == 0.5
    assert round(m["f1"],3) == 0.5 and round(m["accuracy"],3) == 0.5
```
- [ ] **Step 2: Run it** — Expected: FAIL.
- [ ] **Step 3: Implement** `binary_metrics` (TP/FP/FN counts, guard div-by-zero → 0.0). In `runner.py`, after the loop, if all cases have `gold_label`, compute metrics over `(predicted_label, gold_label)` and persist to `run_metrics`. Add `GET /runs/{id}/metrics` returning the row (or 404 if none).
- [ ] **Step 4: Verify** — `pytest tests/test_scoring.py -v`. Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat: detector-vs-human-label metrics (P/R/F1) + /runs/{id}/metrics"`.

### Task 8: Seed endpoint / CLI

**Files:**
- Modify: `backend/api/main.py` (`POST /datasets/ragtruth/seed` — auth-guarded)
- Create: `backend/scripts/seed_ragtruth.py` (idempotent CLI for one-time seeding)

**Interfaces:**
- Consumes: `seed_ragtruth_benchmark` (Task 6).
- Produces: `POST /datasets/ragtruth/seed {split, limit}` → `{benchmark_id, added}`.

- [ ] **Step 1: Failing test** — `test_seed_endpoint.py` (mock `load_ragtruth` to return 3 cases): POST creates a benchmark with 3 labeled cases. Expected: FAIL.
- [ ] **Step 2–4:** implement endpoint + CLI, verify test passes.
- [ ] **Step 5: Commit** — `git commit -am "feat: RAGTruth seed endpoint + CLI"`.

---

## PHASE D — Auth, health, container, deploy

### Task 9: Bearer-token auth + server-side keys (C4)

**Files:**
- Modify: `backend/api/main.py` (auth dependency on all mutating + run endpoints), `backend/core/generator.py` (remove `api_key` from request-driven paths; keys come only from env/HF Secrets), request models (drop `api_key` fields)

**Interfaces:**
- Produces: `require_token(authorization: str = Header(...))` dependency; rejects with 401 unless `Authorization: Bearer <APP_API_TOKEN>` matches env `APP_API_TOKEN`. Read endpoints (`GET`) may stay open for the demo but rate-limited; mutating endpoints require the token.
- Tighten CORS: `allow_origins=[FRONTEND_ORIGIN]` from env, not `*`.

- [ ] **Step 1: Failing test** — `test_auth.py`: `POST /benchmarks` without header → 401; with correct bearer → 201. Set `APP_API_TOKEN` in the test env.
- [ ] **Step 2: Run it** — Expected: FAIL (no auth yet).
- [ ] **Step 3: Implement** the dependency + attach to mutating routes; remove `api_key` from `StartRunRequest`/`GenerateCasesRequest`; `generator._get_client` resolves keys only from `os.getenv(env_key)`. Replace `allow_origins=["*"]`.
- [ ] **Step 4: Verify** — Expected: PASS. Add a test that a run uses env keys (mock `_call_llm`).
- [ ] **Step 5: Commit** — `git commit -am "feat: bearer-token auth, server-side provider keys, scoped CORS"`.

### Task 10: /health + startup config validation

**Files:** Modify `backend/api/main.py`.

**Interfaces:**
- Produces: `GET /health` → `{status:"ok", db:"ok"|"down", model:"loaded"|"lazy"}` (200 only if DB reachable). Lifespan fails fast if `DATABASE_URL` or `APP_API_TOKEN` missing.

- [ ] **Step 1: Failing test** — `test_health.py`: `GET /health` returns 200 with `status:"ok"` when DB up. Expected: FAIL.
- [ ] **Step 2–4:** implement, verify.
- [ ] **Step 5: Commit** — `git commit -am "feat: /health endpoint + fail-fast config validation"`.

### Task 11: Dockerfile for HF Spaces

**Files:** Create `backend/Dockerfile`, `backend/README.md` (HF Space card with YAML metadata header: `sdk: docker`, `app_port: 7860`).

**Interfaces:**
- Produces: an image that runs `uvicorn api.main:app --host 0.0.0.0 --port 7860`, non-root user, model weights cached at build or first run.

- [ ] **Step 1:** Write Dockerfile:
```dockerfile
FROM python:3.12-slim
RUN useradd -m app
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV HF_HOME=/app/.cache TRANSFORMERS_CACHE=/app/.cache
RUN chown -R app:app /app
USER app
EXPOSE 7860
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "7860"]
```
- [ ] **Step 2:** Build locally (or in CI): `docker build -t llm-eval-backend backend/`. Expected: build succeeds.
- [ ] **Step 3:** Smoke-run with `DATABASE_URL`/`APP_API_TOKEN` set: `docker run -e ... -p 7860:7860 llm-eval-backend`, then `curl :7860/health` → 200.
- [ ] **Step 4:** Commit — `git commit -am "feat: HF Spaces Dockerfile + Space card"`.

---

## PHASE E — Next.js frontend on Vercel

### Task 12: Scaffold + typed API client

**Files:** Create `frontend/` via `npx create-next-app@latest frontend --ts --tailwind --app --eslint`. Create `frontend/lib/api.ts`, `frontend/.env.example` (`NEXT_PUBLIC_API_BASE`, and server-only `APP_API_TOKEN` used via a Next Route Handler proxy so the token isn't shipped to the browser).

**Interfaces:**
- Produces: `api.ts` exports typed functions mirroring the backend: `listBenchmarks()`, `createBenchmark()`, `listCases(id)`, `startRun(body)`, `getRun(id)`, `getResults(id)`, `getMetrics(id)`, `compare(a,b)`, `seedRagtruth(body)`. Mutating calls route through a Next.js Route Handler (`app/api/proxy/[...path]/route.ts`) that injects `Authorization: Bearer ${process.env.APP_API_TOKEN}` server-side.

- [ ] **Step 1:** Scaffold, add Tailwind base, commit the clean scaffold.
- [ ] **Step 2:** Write `lib/api.ts` types + fetchers; write the proxy route handler that forwards to `NEXT_PUBLIC_API_BASE` with the bearer token from a server env var.
- [ ] **Step 3:** Add a component test / typecheck: `cd frontend && npm run build` and `npx tsc --noEmit`. Expected: pass.
- [ ] **Step 4:** Commit — `git commit -am "feat(frontend): Next.js scaffold + typed API client with server-side token proxy"`.

### Task 13–16: Screens (one task each)

Each screen is a Task with: create `app/<route>/page.tsx` (+ any `components/`), wire to `lib/api.ts`, and a lightweight test (`npm run build` typecheck + one React Testing Library render assertion). Screens:

- [ ] **Task 13 — Benchmarks (`/`):** list benchmarks (name, case count), create-from-PDF (PDF text extracted client-side with `pdfjs-dist`, POST to `generate-cases`), delete. Commit.
- [ ] **Task 14 — Run Eval (`/run`):** pick benchmark + provider/model, Start → poll `getRun` for progress bar; no API key field (keys are server-side). Commit.
- [ ] **Task 15 — Results (`/results`):** pick a run → summary, domain breakdown, **and the P/R/F1 metric card** from `/runs/{id}/metrics` when the benchmark is labeled (RAGTruth). Per-question list with verdict bars. Commit.
- [ ] **Task 16 — Compare + Dataset (`/compare`, `/dataset`):** compare two runs (delta, improved/regressed, source-type split); `/dataset` seeds/browses the RAGTruth benchmark and shows the detector-vs-human scoreboard. Commit.

### Task 17: Vercel deploy config

**Files:** `frontend/vercel.json` (if needed), README deploy notes.

- [ ] **Step 1:** Set Vercel project root to `frontend/`, env vars `NEXT_PUBLIC_API_BASE` (HF Space URL) + `APP_API_TOKEN` (server-only).
- [ ] **Step 2:** Deploy preview; verify `/health`-backed flows work against the live HF Space.
- [ ] **Step 3:** Commit deploy notes.

---

## PHASE F — CI, docs, rename

### Task 18: GitHub Actions CI

**Files:** Create `.github/workflows/ci.yml`.

**Interfaces:** On every PR: (job 1) spin a Postgres service, `pip install -r backend/requirements.txt`, `ruff check backend`, `pytest backend -m "not slow"` with `DATABASE_URL` pointing at the service. (job 2) `cd frontend && npm ci && npm run build && npx tsc --noEmit`.

- [ ] **Step 1:** Write `ci.yml` with the two jobs + Postgres service container + `APP_API_TOKEN` test env.
- [ ] **Step 2:** Push branch, confirm both jobs green. Expected: green.
- [ ] **Step 3:** Commit.

### Task 19: ADR + README rewrite

**Files:** Create `docs/adr/0001-frontend-backend-split.md`; rewrite root `README.md`.

- [ ] **Step 1:** ADR covers: why split frontend (Vercel) from model backend (HF Spaces) instead of one server; why Neon Postgres over SQLite; why RAGTruth; the `overall_label → binary` mapping choice; "what happens at 10× load" paragraph.
- [ ] **Step 2:** README: what/why, architecture diagram, live links, local dev (both services), deploy steps, the headline metric (detector F1 vs RAGTruth human labels).
- [ ] **Step 3:** Commit.

### Task 20: Rename repo

- [ ] **Step 1:** `gh repo rename llm-hallucination-detection` (or via GitHub UI). Update README clone URLs, Vercel/HF remotes.
- [ ] **Step 2:** Commit any URL updates.

---

## PHASE G — Re-audit (user's final step)

- [ ] Run `repo-bug-audit` across the rebuilt repo; triage findings.
- [ ] For any real bug, use `superpowers:systematic-debugging` (root cause before fix), as in the C2 fix.
- [ ] Confirm CI green, both deploys live, metrics endpoint returns real F1.

---

## Self-Review

- **Spec coverage:** C3→Phase E + Task 11/17; C4→Task 9; C5→Phase C; I1→Task 1; I2→Task 3; I4→Tasks 2/18; I5→Tasks 11/17/19; N1→Task 20; N2→Task 19. C2 already fixed pre-plan. All audit findings mapped.
- **Placeholder scan:** dataset HF id (Task 6) and exact pin combination (Task 2) are the two "resolve at build time" items — both have an explicit resolution procedure and acceptance test, not a vague TODO.
- **Type consistency:** `gold_label`/`predicted_label` use `{"hallucinated","grounded"}` everywhere; `binary_metrics` positive class = `hallucinated` consistently across Task 7 and the runner.
- **Open risk:** the local segfault (Task 2) may force backend test execution onto CI until a compatible pin set is found; the plan front-loads Task 2 so all later backend tasks run in a clean env.
```
