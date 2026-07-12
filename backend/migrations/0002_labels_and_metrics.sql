-- Labeled-benchmark support (RAGTruth) + run failure reasons + detector metrics.

-- Gold hallucination label + the annotated model answer (for labeled datasets).
ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS gold_label TEXT;   -- 'hallucinated' | 'grounded' | NULL
ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS answer     TEXT;   -- reference answer (RAGTruth), nullable

-- Persist run failure reason + which dataset a run came from.
ALTER TABLE eval_runs ADD COLUMN IF NOT EXISTS error   TEXT;
ALTER TABLE eval_runs ADD COLUMN IF NOT EXISTS dataset TEXT;

-- Binary prediction mapped from overall_label, for label-vs-detector metrics.
ALTER TABLE run_results ADD COLUMN IF NOT EXISTS predicted_label TEXT;  -- 'hallucinated' | 'grounded'

-- Detector-vs-human-label metrics per run (only when the benchmark is labeled).
CREATE TABLE IF NOT EXISTS run_metrics (
    run_id    BIGINT PRIMARY KEY REFERENCES eval_runs(id) ON DELETE CASCADE,
    precision REAL,
    recall    REAL,
    f1        REAL,
    accuracy  REAL,
    n         INTEGER NOT NULL DEFAULT 0
);
