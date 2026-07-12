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
import Help from "./Help";

function verdictColor(label: string): string {
  const l = label.toUpperCase();
  if (l === "GROUNDED") return "var(--ok)";
  if (l === "PARTIALLY_GROUNDED") return "var(--amber)";
  if (l === "HALLUCINATED" || l === "UNGROUNDED") return "var(--bad)";
  return "var(--muted)";
}

function scoreColor(score: number): string {
  if (score < 0.3) return "var(--ok)";
  if (score < 0.6) return "var(--amber)";
  return "var(--bad)";
}

export default function ResultsTab() {
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
        // Settle independently — a failure in one shouldn't blank the others.
        const [d, res, m] = await Promise.allSettled([
          getDomains(runId),
          getResults(runId),
          getMetrics(runId),
        ]);
        if (cancelled) return;
        setDomains(d.status === "fulfilled" ? d.value : []);
        setResults(res.status === "fulfilled" ? res.value : []);
        setMetrics(m.status === "fulfilled" ? m.value : null);
        if (d.status === "rejected" && res.status === "rejected") {
          setError("Could not load results for that run.");
        }
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

  if (error) return <div className="callout err note">{error}</div>;
  if (runs.length === 0) {
    return (
      <p className="note">
        Run an evaluation on the <strong>Run Eval</strong> tab to see results here.
      </p>
    );
  }

  return (
    <div className="demo">
      <div className="field" style={{ maxWidth: 420 }}>
        <label>
          <span className="lname">
            Run
            <Help text="Pick a completed run to inspect its scores, per-question verdicts, and — for labeled runs — F1 vs human labels." />
          </span>
        </label>
        <select value={runId ?? ""} onChange={(e) => setRunId(Number(e.target.value))}>
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              #{r.id} · {r.benchmark_name} · {r.provider}/{r.model}
            </option>
          ))}
        </select>
      </div>

      {run && (
        <div className="tiles">
          <div className="tile">
            <div className="v">{run.model}</div>
            <div className="k">Model</div>
          </div>
          <div className="tile">
            <div className="v">{run.status}</div>
            <div className="k">Status</div>
          </div>
          <div className="tile">
            <div className="v">{run.avg_score !== null ? run.avg_score.toFixed(3) : "—"}</div>
            <div className="k">Avg score</div>
          </div>
          <div className="tile">
            <div className="v">{run.grounded_pct !== null ? `${(run.grounded_pct * 100).toFixed(1)}%` : "—"}</div>
            <div className="k">Grounded rate</div>
          </div>
        </div>
      )}

      {run?.status === "failed" && run.error && <div className="callout err note">{run.error}</div>}

      {metrics && (
        <div className="readout">
          <div className="lbl">Detector agreement with human labels</div>
          <div className="big">{metrics.f1.toFixed(3)}</div>
          <div className="lbl">F1</div>
          <div className="tiles" style={{ marginTop: "1rem" }}>
            <div className="tile">
              <div className="v">{metrics.precision.toFixed(3)}</div>
              <div className="k">Precision</div>
            </div>
            <div className="tile">
              <div className="v">{metrics.recall.toFixed(3)}</div>
              <div className="k">Recall</div>
            </div>
            <div className="tile">
              <div className="v">{metrics.accuracy.toFixed(3)}</div>
              <div className="k">Accuracy</div>
            </div>
            <div className="tile">
              <div className="v">{metrics.n}</div>
              <div className="k">N</div>
            </div>
          </div>
        </div>
      )}

      {loading && <p className="note">Loading…</p>}

      {!loading && domains.length > 0 && (
        <div>
          <p className="section-label">Domain breakdown</p>
          <div className="bars">
            {domains.map((d) => (
              <div key={d.domain}>
                <div className="bar-row">
                  <span className="name">{d.domain}</span>
                  <div className="bar-track">
                    <div
                      className="fill"
                      style={{ width: `${Math.round(d.avg_score * 100)}%`, background: scoreColor(d.avg_score) }}
                    />
                  </div>
                </div>
                <p className="note" style={{ margin: ".25rem 0 0", textAlign: "right" }}>
                  {d.total} cases · {d.grounded} grounded · {d.partial} partial · {d.hallucinated} hallucinated
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div>
          <p className="section-label">Per-question results</p>
          <div className="bars">
            {results.map((r) => (
              <div
                key={r.test_case_id}
                className="note"
                style={{ padding: ".75rem .9rem", background: "var(--panel-2)", borderRadius: 10, border: "1px solid var(--border)" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: ".75rem", flexWrap: "wrap" }}>
                  <strong style={{ color: "var(--text)" }}>{r.question}</strong>
                  <span
                    className="pill"
                    style={{
                      background: `color-mix(in srgb, ${verdictColor(r.overall_label)} 22%, transparent)`,
                      color: verdictColor(r.overall_label),
                    }}
                  >
                    {r.overall_label.replace(/_/g, " ").toLowerCase()}
                  </span>
                </div>
                <p className="note" style={{ margin: ".4rem 0 0" }}>
                  {r.domain} · {r.source_type}
                </p>
                <div className="probbar" style={{ margin: ".5rem 0 0", maxWidth: 260 }}>
                  <div style={{ width: `${Math.round(r.hallucination_score * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
