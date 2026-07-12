-- Core schema: benchmarks, test cases, eval runs, per-case results.

CREATE TABLE IF NOT EXISTS benchmarks (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        TEXT        NOT NULL UNIQUE,
    description TEXT        NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS test_cases (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    benchmark_id   BIGINT      NOT NULL REFERENCES benchmarks(id) ON DELETE CASCADE,
    question       TEXT        NOT NULL,
    reference_text TEXT        NOT NULL,
    domain         TEXT        NOT NULL DEFAULT 'general',
    source_type    TEXT        NOT NULL DEFAULT 'internal',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_test_cases_benchmark ON test_cases(benchmark_id);

CREATE TABLE IF NOT EXISTS eval_runs (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    benchmark_id BIGINT      NOT NULL REFERENCES benchmarks(id) ON DELETE CASCADE,
    provider     TEXT        NOT NULL,
    model        TEXT        NOT NULL,
    status       TEXT        NOT NULL DEFAULT 'pending',
    avg_score    REAL,
    grounded_pct REAL,
    run_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_eval_runs_benchmark ON eval_runs(benchmark_id);

CREATE TABLE IF NOT EXISTS run_results (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    run_id              BIGINT  NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
    test_case_id        BIGINT  NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
    response            TEXT    NOT NULL,
    overall_label       TEXT    NOT NULL,
    hallucination_score REAL    NOT NULL,
    grounded_count      INTEGER NOT NULL DEFAULT 0,
    ungrounded_count    INTEGER NOT NULL DEFAULT 0,
    contradicted_count  INTEGER NOT NULL DEFAULT 0,
    total_sentences     INTEGER NOT NULL DEFAULT 0,
    sentence_results    JSONB   NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_run_results_run ON run_results(run_id);
