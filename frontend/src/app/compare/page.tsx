"use client";

import { useEffect, useState } from "react";
import { compare, listRuns, type CompareResult, type Run } from "@/lib/api";
import {
  Card,
  EmptyState,
  ErrorBanner,
  SectionHeading,
  Select,
  Stat,
  VerdictBadge,
} from "@/components/ui";

// The backend's /compare response nests richer shapes than the generic
// CompareResult type in api.ts declares for these two fields — narrow them
// here rather than widening the shared client type for a single page.
interface SourceTypeBucket {
  total: number;
  avg_score: number | null;
  grounded: number;
  hallucinated: number;
}
type SourceTypeScores = Record<string, SourceTypeBucket | null>;

interface PerCaseRow {
  test_case_id: number;
  question: string;
  domain: string;
  source_type: string;
  score_a: number;
  label_a: string;
  score_b: number;
  label_b: string;
  delta: number;
  verdict: "improved" | "regressed" | "stable";
}

const VERDICT_TEXT: Record<PerCaseRow["verdict"], string> = {
  improved: "var(--grounded)",
  regressed: "var(--hallucinated)",
  stable: "var(--text-muted)",
};

export default function ComparePage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [runAId, setRunAId] = useState<number | null>(null);
  const [runBId, setRunBId] = useState<number | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await listRuns();
        setRuns(r);
        setRunAId(r[1]?.id ?? r[0]?.id ?? null);
        setRunBId(r[0]?.id ?? null);
      } catch {
        setError("Could not reach the backend. Check that the API is running.");
      }
    })();
  }, []);

  useEffect(() => {
    if (!runAId || !runBId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const r = await compare(runAId, runBId);
        if (!cancelled) setResult(r);
      } catch {
        if (!cancelled) setError("Could not compare those runs — do they share any test cases?");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runAId, runBId]);

  const runA = runs.find((r) => r.id === runAId);
  const runB = runs.find((r) => r.id === runBId);
  const sourceA = (result?.source_type_scores_a as unknown as SourceTypeScores) ?? {};
  const sourceB = (result?.source_type_scores_b as unknown as SourceTypeScores) ?? {};
  const perCase = (result?.per_case as unknown as PerCaseRow[]) ?? [];

  return (
    <div className="space-y-8">
      <SectionHeading eyebrow="A / B" title="Compare" />

      {error && <ErrorBanner message={error} />}

      {!error && runs.length < 2 && (
        <EmptyState title="Need two runs" body="Complete at least two runs to compare them." />
      )}

      {runs.length >= 2 && (
        <div className="grid gap-4 sm:grid-cols-2 sm:max-w-xl">
          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">
              Run A (baseline)
            </label>
            <Select value={runAId ?? ""} onChange={(e) => setRunAId(Number(e.target.value))}>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  #{r.id} · {r.benchmark_name} · {r.provider}/{r.model}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">
              Run B (candidate)
            </label>
            <Select value={runBId ?? ""} onChange={(e) => setRunBId(Number(e.target.value))}>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  #{r.id} · {r.benchmark_name} · {r.provider}/{r.model}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}

      {loading && <p className="text-sm text-[var(--text-muted)]">Comparing…</p>}

      {result && (
        <>
          <Card className="p-5">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <Stat
                label={`A · ${runA?.model ?? ""}`}
                value={result.avg_score_a.toFixed(3)}
                sub="avg hallucination score"
              />
              <Stat
                label={`B · ${runB?.model ?? ""}`}
                value={result.avg_score_b.toFixed(3)}
                sub="avg hallucination score"
              />
              <Stat
                label="Delta (B − A)"
                value={
                  <span
                    style={{
                      color:
                        result.overall_delta < 0
                          ? "var(--grounded)"
                          : result.overall_delta > 0
                            ? "var(--hallucinated)"
                            : "var(--text)",
                    }}
                  >
                    {result.overall_delta > 0 ? "+" : ""}
                    {result.overall_delta.toFixed(3)}
                  </span>
                }
                sub="negative is better"
              />
              <Stat
                label="Improved / regressed / stable"
                value={`${result.improved_count} / ${result.regressed_count} / ${result.stable_count}`}
              />
            </div>
          </Card>

          <section>
            <SectionHeading title="Source-type split" />
            <div className="grid gap-3 sm:grid-cols-2">
              {(["internal", "public"] as const).map((type) => {
                const a = sourceA[type];
                const b = sourceB[type];
                return (
                  <Card key={type} className="p-4">
                    <div className="flex items-center gap-2">
                      <p className="font-medium capitalize text-[var(--text)]">{type}</p>
                      {type === "public" && (
                        <span className="rounded-full bg-[var(--partial-soft)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--partial)]">
                          possible contamination
                        </span>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-4 font-mono text-sm text-[var(--text)]">
                      <div>
                        A: {a?.avg_score !== null && a?.avg_score !== undefined ? a.avg_score.toFixed(3) : "—"}{" "}
                        <span className="text-[var(--text-muted)]">({a?.total ?? 0})</span>
                      </div>
                      <div>
                        B: {b?.avg_score !== null && b?.avg_score !== undefined ? b.avg_score.toFixed(3) : "—"}{" "}
                        <span className="text-[var(--text-muted)]">({b?.total ?? 0})</span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>

          <section>
            <SectionHeading title="Per-question breakdown" />
            <div className="space-y-2">
              {perCase.map((c) => (
                <Card key={c.test_case_id} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="min-w-0 flex-1 text-sm text-[var(--text)]">{c.question}</p>
                    <span
                      className="font-mono text-xs font-medium uppercase tracking-wide"
                      style={{ color: VERDICT_TEXT[c.verdict] }}
                    >
                      {c.verdict}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-xs text-[var(--text-muted)]">
                    <VerdictBadge label={c.label_a} />
                    <span>{c.score_a.toFixed(3)}</span>
                    <span>→</span>
                    <VerdictBadge label={c.label_b} />
                    <span>{c.score_b.toFixed(3)}</span>
                    <span className="ml-auto">{c.domain} · {c.source_type}</span>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
