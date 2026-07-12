"use client";

import { useEffect, useState } from "react";
import {
  getDomains,
  getMetrics,
  getResults,
  listRuns,
  type DomainScore,
  type Run,
  type RunMetrics,
  type RunResult,
} from "@/lib/api";
import {
  Card,
  EmptyState,
  ErrorBanner,
  ScoreTrack,
  SectionHeading,
  Select,
  Stat,
  VerdictBadge,
} from "@/components/ui";

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export default function ResultsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [runId, setRunId] = useState<number | null>(null);
  const [domains, setDomains] = useState<DomainScore[]>([]);
  const [results, setResults] = useState<RunResult[]>([]);
  const [metrics, setMetrics] = useState<RunMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await listRuns();
        setRuns(r);
        setRunId(r[0]?.id ?? null);
      } catch {
        setError("Could not reach the backend. Check that the API is running.");
      }
    })();
  }, []);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [d, res, m] = await Promise.all([
          getDomains(runId),
          getResults(runId),
          getMetrics(runId),
        ]);
        if (cancelled) return;
        setDomains(d);
        setResults(res);
        setMetrics(m);
      } catch {
        if (!cancelled) setError("Could not load results for that run.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const run = runs.find((r) => r.id === runId) ?? null;

  return (
    <div className="space-y-8">
      <SectionHeading eyebrow="Inspect" title="Results" />

      {error && <ErrorBanner message={error} />}

      {!error && runs.length === 0 && (
        <EmptyState title="No runs yet" body="Start one from the Run Eval page." />
      )}

      {runs.length > 0 && (
        <div className="max-w-sm">
          <Select value={runId ?? ""} onChange={(e) => setRunId(Number(e.target.value))}>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                #{r.id} · {r.benchmark_name} · {r.provider}/{r.model}
              </option>
            ))}
          </Select>
        </div>
      )}

      {run && (
        <Card className="p-5">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat label="Model" value={run.model} sub={run.provider} />
            <Stat label="Benchmark" value={run.benchmark_name} />
            <Stat label="Status" value={run.status} />
            <Stat
              label="Hallucination score"
              value={run.avg_score !== null ? run.avg_score.toFixed(3) : "—"}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat
              label="Grounded rate"
              value={run.grounded_pct !== null ? pct(run.grounded_pct) : "—"}
            />
          </div>
          {run.status === "failed" && run.error && (
            <div className="mt-4">
              <ErrorBanner message={run.error} />
            </div>
          )}
        </Card>
      )}

      {metrics && (
        <Card className="p-5" style={{ borderColor: "var(--accent)" }}>
          <SectionHeading eyebrow="Vs. human labels" title="Detector metrics" />
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat label="Precision" value={metrics.precision.toFixed(3)} />
            <Stat label="Recall" value={metrics.recall.toFixed(3)} />
            <Stat label="F1" value={metrics.f1.toFixed(3)} />
            <Stat label="Accuracy" value={metrics.accuracy.toFixed(3)} sub={`n = ${metrics.n}`} />
          </div>
        </Card>
      )}

      {loading && <p className="text-sm text-[var(--text-muted)]">Loading…</p>}

      {!loading && domains.length > 0 && (
        <section>
          <SectionHeading title="Domain breakdown" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {domains.map((d) => (
              <Card key={d.domain} className="p-4">
                <p className="font-medium text-[var(--text)]">{d.domain}</p>
                <p className="mt-0.5 font-mono text-xs text-[var(--text-muted)]">
                  {d.total} cases · {d.grounded} grounded · {d.partial} partial ·{" "}
                  {d.hallucinated} hallucinated
                </p>
                <div className="mt-3">
                  <ScoreTrack score={d.avg_score} />
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {!loading && results.length > 0 && (
        <section>
          <SectionHeading title="Per-question results" />
          <div className="space-y-3">
            {results.map((r) => (
              <Card key={r.test_case_id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--text)]">{r.question}</p>
                    <p className="mt-1 font-mono text-xs text-[var(--text-muted)]">
                      {r.domain} · {r.source_type}
                    </p>
                  </div>
                  <VerdictBadge label={r.overall_label} />
                </div>
                {r.response && (
                  <p className="mt-3 line-clamp-3 text-sm text-[var(--text-muted)]">
                    {r.response}
                  </p>
                )}
                <div className="mt-3 max-w-sm">
                  <ScoreTrack score={r.hallucination_score} />
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
