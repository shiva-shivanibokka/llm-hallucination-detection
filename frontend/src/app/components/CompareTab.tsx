"use client";

import { useEffect, useState } from "react";
import { compare, listRuns, type CompareResult, type Run } from "@/lib/api";
import Help from "./Help";

function verdictColor(label: string): string {
  const l = label.toUpperCase();
  if (l === "GROUNDED") return "var(--ok)";
  if (l === "PARTIALLY_GROUNDED") return "var(--amber)";
  if (l === "HALLUCINATED" || l === "UNGROUNDED") return "var(--bad)";
  return "var(--muted)";
}

export default function CompareTab() {
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

  if (error) return <div className="callout err note">{error}</div>;
  if (runs.length < 2) {
    return (
      <p className="note">
        Complete at least two runs on <strong>Run Eval</strong> to compare them.
      </p>
    );
  }

  const runA = runs.find((r) => r.id === runAId);
  const runB = runs.find((r) => r.id === runBId);
  const publicSplit = result?.source_type_scores_a?.public ?? result?.source_type_scores_b?.public ?? null;

  return (
    <div className="demo">
      <div className="control-row">
        <div className="field">
          <label>
            <span className="lname">
              Run A (baseline)
              <Help text="The reference run to compare against." />
            </span>
          </label>
          <select value={runAId ?? ""} onChange={(e) => setRunAId(Number(e.target.value))}>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                #{r.id} · {r.benchmark_name} · {r.provider}/{r.model}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>
            <span className="lname">
              Run B (candidate)
              <Help text="The run compared to the baseline. Must share test cases with A (compare two runs of the same benchmark)." />
            </span>
          </label>
          <select value={runBId ?? ""} onChange={(e) => setRunBId(Number(e.target.value))}>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                #{r.id} · {r.benchmark_name} · {r.provider}/{r.model}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <p className="note">Comparing…</p>}

      {result && (
        <>
          <div className="tiles">
            <div className="tile">
              <div className="v">{result.avg_score_a.toFixed(3)}</div>
              <div className="k">A · {runA?.model}</div>
            </div>
            <div className="tile">
              <div className="v">{result.avg_score_b.toFixed(3)}</div>
              <div className="k">B · {runB?.model}</div>
            </div>
            <div className="tile">
              <div
                className="v"
                style={{
                  color:
                    result.overall_delta < 0 ? "var(--ok)" : result.overall_delta > 0 ? "var(--bad)" : "var(--text)",
                }}
              >
                {result.overall_delta > 0 ? "+" : ""}
                {result.overall_delta.toFixed(3)}
              </div>
              <div className="k">Delta (B − A)</div>
            </div>
            <div className="tile">
              <div className="v">
                {result.improved_count}/{result.regressed_count}/{result.stable_count}
              </div>
              <div className="k">Improved/regressed/stable</div>
            </div>
          </div>

          <div>
            <p className="section-label">Source-type split</p>
            <div className="tiles">
              {(["internal", "public"] as const).map((type) => {
                const a = result.source_type_scores_a[type];
                const b = result.source_type_scores_b[type];
                return (
                  <div className="tile" key={type}>
                    <div className="v">
                      {a?.avg_score != null ? a.avg_score.toFixed(3) : "—"} → {b?.avg_score != null ? b.avg_score.toFixed(3) : "—"}
                    </div>
                    <div className="k">{type}</div>
                  </div>
                );
              })}
            </div>
            {publicSplit && (
              <div className="callout note" style={{ marginTop: ".8rem" }}>
                <strong>Public source cases carry contamination risk.</strong> The reference document may already be
                in the model&rsquo;s training data, which can inflate grounded scores independent of real accuracy.
              </div>
            )}
          </div>

          <div>
            <p className="section-label">Per-question breakdown</p>
            <div className="bars">
              {result.per_case.map((c) => (
                <div
                  key={c.test_case_id}
                  className="note"
                  style={{ padding: ".7rem .85rem", background: "var(--panel-2)", borderRadius: 10, border: "1px solid var(--border)" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: ".75rem", flexWrap: "wrap" }}>
                    <span style={{ color: "var(--text)" }}>{c.question}</span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: ".78rem",
                        textTransform: "uppercase",
                        color:
                          c.verdict === "improved" ? "var(--ok)" : c.verdict === "regressed" ? "var(--bad)" : "var(--muted)",
                      }}
                    >
                      {c.verdict}
                    </span>
                  </div>
                  <p className="note" style={{ margin: ".3rem 0 0" }}>
                    <span style={{ color: verdictColor(c.label_a) }}>{c.label_a}</span> {c.score_a.toFixed(3)} →{" "}
                    <span style={{ color: verdictColor(c.label_b) }}>{c.label_b}</span> {c.score_b.toFixed(3)} ·{" "}
                    {c.domain}/{c.source_type}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
