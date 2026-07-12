"use client";

import { useEffect, useRef, useState } from "react";
import {
  getProviders,
  getRun,
  listBenchmarks,
  startRun,
  type Benchmark,
  type Providers,
  type RunDetail,
} from "@/lib/api";

const DEFAULT_THRESHOLDS = { entail: 0.5, contradict: 0.5, grounded: 0.3, partial: 0.6 };
const POLL_MS = 3000;

export default function RunEvalTab() {
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [providers, setProviders] = useState<Providers>({});
  const [benchmarkId, setBenchmarkId] = useState<number | null>(null);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [run, setRun] = useState<RunDetail | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [b, p] = await Promise.all([listBenchmarks(), getProviders()]);
        setBenchmarks(b);
        setProviders(p);
        setBenchmarkId((prev) => prev ?? b[0]?.id ?? null);
        const first = Object.keys(p)[0] ?? "";
        setProvider(first);
        setModel(p[first]?.models?.[0] ?? "");
      } catch {
        setStartError("Could not reach the backend. Check that the API is running.");
      }
    })();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function handleProviderChange(next: string) {
    setProvider(next);
    setModel(providers[next]?.models?.[0] ?? "");
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function pollRun(runId: number) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const detail = await getRun(runId);
        setRun(detail);
        if (detail.status === "completed" || detail.status === "failed") stopPolling();
      } catch {
        stopPolling();
        setStartError("Lost connection while checking run status.");
      }
    }, POLL_MS);
  }

  async function handleStart() {
    if (!benchmarkId || !provider || !model) {
      setStartError("Pick a benchmark, provider, and model first.");
      return;
    }
    setStarting(true);
    setStartError(null);
    setRun(null);
    try {
      const { run_id } = await startRun({
        benchmark_id: benchmarkId,
        provider,
        model,
        api_key: apiKey.trim() || undefined,
        entail_threshold: thresholds.entail,
        contradict_threshold: thresholds.contradict,
        grounded_ceiling: thresholds.grounded,
        partial_ceiling: thresholds.partial,
      });
      const detail = await getRun(run_id);
      setRun(detail);
      if (detail.status !== "completed" && detail.status !== "failed") pollRun(run_id);
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "Could not start the run. Try again.");
    } finally {
      setStarting(false);
    }
  }

  const running = Boolean(run && run.status !== "completed" && run.status !== "failed");
  const progress = run && run.total_cases > 0 ? run.completed_cases / run.total_cases : 0;

  return (
    <div className="demo">
      <div className="control-row">
        <div className="field">
          <label>
            <span className="lname">Benchmark</span>
          </label>
          <select value={benchmarkId ?? ""} onChange={(e) => setBenchmarkId(Number(e.target.value))}>
            {benchmarks.length === 0 && <option value="">No benchmarks yet</option>}
            {benchmarks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.case_count} cases)
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>
            <span className="lname">Provider</span>
          </label>
          <select value={provider} onChange={(e) => handleProviderChange(e.target.value)}>
            {Object.keys(providers).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>
            <span className="lname">Model</span>
          </label>
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            {(providers[provider]?.models ?? []).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>
            <span className="lname">Your API key</span>
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Needed to generate fresh answers"
            autoComplete="off"
          />
        </div>
      </div>

      <p className="note">RAGTruth benchmarks score stored answers — no key needed for those.</p>

      <div>
        <p className="section-label">Detector thresholds</p>
        <div className="control-row">
          <div className="field">
            <label>
              <span className="lname">Entail threshold</span>
              <b>{thresholds.entail.toFixed(2)}</b>
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={thresholds.entail}
              onChange={(e) => setThresholds((t) => ({ ...t, entail: Number(e.target.value) }))}
            />
          </div>
          <div className="field">
            <label>
              <span className="lname">Contradict threshold</span>
              <b>{thresholds.contradict.toFixed(2)}</b>
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={thresholds.contradict}
              onChange={(e) => setThresholds((t) => ({ ...t, contradict: Number(e.target.value) }))}
            />
          </div>
          <div className="field">
            <label>
              <span className="lname">Grounded ceiling</span>
              <b>{thresholds.grounded.toFixed(2)}</b>
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={thresholds.grounded}
              onChange={(e) => setThresholds((t) => ({ ...t, grounded: Number(e.target.value) }))}
            />
          </div>
          <div className="field">
            <label>
              <span className="lname">Partial ceiling</span>
              <b>{thresholds.partial.toFixed(2)}</b>
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={thresholds.partial}
              onChange={(e) => setThresholds((t) => ({ ...t, partial: Number(e.target.value) }))}
            />
          </div>
        </div>
      </div>

      <div>
        <button
          type="button"
          className="btn"
          onClick={handleStart}
          disabled={starting || running || benchmarks.length === 0}
        >
          {starting ? "Starting…" : running ? "Run in progress…" : "Start run"}
        </button>
      </div>

      {startError && <div className="callout err note">{startError}</div>}

      {run && (
        <div className="results">
          <div className="panel-head">
            <div className="htitle">
              <strong>
                Run #{run.id} · {run.benchmark_name}
              </strong>
            </div>
            <span className="chip">
              {run.provider}/{run.model} · {run.status}
            </span>
          </div>
          <div className="probbar">
            <div style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="note">
            {run.completed_cases} / {run.total_cases} cases
          </p>
          {run.status === "failed" && run.error && <div className="callout err note">{run.error}</div>}
          {run.status === "completed" && (
            <p className="note">
              Done. Check the <strong>Results</strong> tab for the breakdown.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
