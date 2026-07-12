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
import {
  Button,
  Card,
  ErrorBanner,
  Label,
  ProgressBar,
  SectionHeading,
  Select,
  Slider,
} from "@/components/ui";

const DEFAULT_THRESHOLDS = {
  entail: 0.5,
  contradict: 0.5,
  grounded: 0.3,
  partial: 0.6,
};

const POLL_MS = 3000;

export default function RunPage() {
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [providers, setProviders] = useState<Providers>({});
  const [benchmarkId, setBenchmarkId] = useState<number | null>(null);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
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
        const firstProvider = Object.keys(p)[0] ?? "";
        setProvider(firstProvider);
        setModel(p[firstProvider]?.models?.[0] ?? "");
      } catch {
        setStartError("Could not reach the backend. Check that the API is running.");
      }
    })();
  }, []);

  function handleProviderChange(nextProvider: string) {
    setProvider(nextProvider);
    setModel(providers[nextProvider]?.models?.[0] ?? "");
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

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
        if (detail.status === "completed" || detail.status === "failed") {
          stopPolling();
        }
      } catch {
        stopPolling();
        setStartError("Lost connection while polling run status.");
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
        entail_threshold: thresholds.entail,
        contradict_threshold: thresholds.contradict,
        grounded_ceiling: thresholds.grounded,
        partial_ceiling: thresholds.partial,
      });
      const detail = await getRun(run_id);
      setRun(detail);
      if (detail.status !== "completed" && detail.status !== "failed") {
        pollRun(run_id);
      }
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "Failed to start run.");
    } finally {
      setStarting(false);
    }
  }

  const running = run && run.status !== "completed" && run.status !== "failed";

  return (
    <div className="space-y-8">
      <SectionHeading eyebrow="Evaluate" title="Run Eval" />

      <Card className="p-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <Label>Benchmark</Label>
              <Select
                value={benchmarkId ?? ""}
                onChange={(e) => setBenchmarkId(Number(e.target.value))}
              >
                {benchmarks.length === 0 && <option value="">No benchmarks available</option>}
                {benchmarks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.case_count} cases)
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Provider</Label>
              <Select value={provider} onChange={(e) => handleProviderChange(e.target.value)}>
                {Object.keys(providers).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Model</Label>
              <Select value={model} onChange={(e) => setModel(e.target.value)}>
                {(providers[provider]?.models ?? []).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <p className="font-mono text-xs uppercase tracking-widest text-[var(--text-muted)]">
              Detector thresholds
            </p>
            <div>
              <Label>Entail threshold</Label>
              <Slider
                value={thresholds.entail}
                onChange={(v) => setThresholds((t) => ({ ...t, entail: v }))}
                min={0}
                max={1}
                step={0.05}
              />
            </div>
            <div>
              <Label>Contradict threshold</Label>
              <Slider
                value={thresholds.contradict}
                onChange={(v) => setThresholds((t) => ({ ...t, contradict: v }))}
                min={0}
                max={1}
                step={0.05}
              />
            </div>
            <div>
              <Label>Grounded ceiling</Label>
              <Slider
                value={thresholds.grounded}
                onChange={(v) => setThresholds((t) => ({ ...t, grounded: v }))}
                min={0}
                max={1}
                step={0.05}
              />
            </div>
            <div>
              <Label>Partial ceiling</Label>
              <Slider
                value={thresholds.partial}
                onChange={(v) => setThresholds((t) => ({ ...t, partial: v }))}
                min={0}
                max={1}
                step={0.05}
              />
            </div>
          </div>
        </div>

        <Button
          onClick={handleStart}
          disabled={starting || Boolean(running) || benchmarks.length === 0}
          className="mt-5 w-full"
        >
          {starting ? "Starting…" : running ? "Run in progress…" : "Start run"}
        </Button>
        {startError && <div className="mt-3"><ErrorBanner message={startError} /></div>}
      </Card>

      {run && (
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text)]">
                Run #{run.id} · {run.benchmark_name}
              </p>
              <p className="font-mono text-xs text-[var(--text-muted)]">
                {run.provider} / {run.model}
              </p>
            </div>
            <span
              className="rounded-full px-2.5 py-1 font-mono text-xs uppercase tracking-wide"
              style={{
                color:
                  run.status === "completed"
                    ? "var(--grounded)"
                    : run.status === "failed"
                      ? "var(--hallucinated)"
                      : "var(--accent)",
                background:
                  run.status === "completed"
                    ? "var(--grounded-soft)"
                    : run.status === "failed"
                      ? "var(--hallucinated-soft)"
                      : "var(--accent-soft)",
              }}
            >
              {run.status}
            </span>
          </div>

          <div className="mt-4">
            <ProgressBar
              value={run.total_cases > 0 ? run.completed_cases / run.total_cases : 0}
            />
            <p className="mt-1 font-mono text-xs text-[var(--text-muted)]">
              {run.completed_cases} / {run.total_cases} cases
            </p>
          </div>

          {run.status === "failed" && run.error && (
            <div className="mt-4">
              <ErrorBanner message={run.error} />
            </div>
          )}

          {run.status === "completed" && (
            <p className="mt-4 text-sm text-[var(--text-muted)]">
              Done. View the breakdown on{" "}
              <a href="/results" className="text-[var(--accent)] underline underline-offset-2">
                Results
              </a>
              .
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
