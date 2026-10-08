"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { useBackendHealth } from "./components/useBackendHealth";

const load = (p: () => Promise<{ default: ComponentType }>) =>
  dynamic(p, { ssr: false, loading: () => <p className="note">loading…</p> });

const TABS = [
  {
    id: "about",
    title: "About",
    tagline: "What this project does, the concepts behind it, and a step-by-step guide to every tab.",
  },
  {
    id: "ragtruth",
    title: "RAGTruth",
    tagline: "Seed the human-labeled RAGTruth dataset as a benchmark to measure the detector against real annotations.",
  },
  {
    id: "run",
    title: "Run Eval",
    tagline: "Score an LLM's answers against a benchmark, sentence by sentence, with an NLI detector.",
  },
  {
    id: "results",
    title: "Results",
    tagline:
      "Inspect a run's domain breakdown and per-question verdicts — and, for labeled runs, the detector's F1 against human judgments.",
  },
  {
    id: "compare",
    title: "Compare",
    tagline: "See how two runs differ, and whether public source documents put grounded scores at risk of contamination.",
  },
  {
    id: "new",
    title: "New Benchmark",
    tagline: "Upload a reference PDF and generate a benchmark of grounded questions from it (needs your API key).",
  },
];

const TAB_COMPONENTS: Record<string, ComponentType> = {
  about: load(() => import("./components/AboutTab")),
  ragtruth: load(() => import("./components/RagtruthTab")),
  run: load(() => import("./components/RunEvalTab")),
  results: load(() => import("./components/ResultsTab")),
  compare: load(() => import("./components/CompareTab")),
  new: load(() => import("./components/NewBenchmarkTab")),
};

export default function Home() {
  const [active, setActive] = useState(TABS[0].id);
  const tab = TABS.find((t) => t.id === active)!;
  const health = useBackendHealth();
  const Comp = TAB_COMPONENTS[tab.id];

  return (
    <main className="wrap">
      <header className="hero">
        <h1>LLM Hallucination Eval</h1>
        <p>
          Scores an LLM&rsquo;s answers sentence-by-sentence against your own reference documents with an NLI
          entailment model, then reports how well that detector agrees with human hallucination labels from
          RAGTruth.
        </p>
        {/* This said "live · GCP Cloud Run + Neon · RAGTruth-labeled"
            unconditionally. It was markup, not a status, so it kept saying
            "live" after the Google Cloud free trial behind the backend closed.
            It now reports what the health check actually found. */}
        {health === "ok" ? (
          <span className="live">
            <b>●</b> live · GCP Cloud Run + Neon · RAGTruth-labeled
          </span>
        ) : health === "offline" ? (
          <span className="live offline">
            <b>●</b> backend offline
          </span>
        ) : (
          <span className="live checking">
            <b>●</b> {health === "waking" ? "waking the backend…" : "checking the backend…"}
          </span>
        )}

        {health === "offline" && (
          <p className="notice" role="status">
            <b>The backend for this demo is switched off.</b> It ran on Google Cloud Run
            under a Google Cloud free trial that has since ended, so seeding a benchmark,
            running an evaluation and the Results tab cannot work here. This project
            computes its numbers from your own run rather than baking figures into the
            repository, so there is no recorded result to show in their place —{" "}
            <a
              href="https://github.com/shiva-shivanibokka/LLM-Halucination-Detection#getting-started"
              target="_blank"
              rel="noopener noreferrer"
            >
              the README runs the whole stack locally
            </a>
            , which is the only way to reproduce them.
          </p>
        )}
      </header>

      <nav className="tabs" role="tablist" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.id} className="tab" role="tab" aria-selected={t.id === active} onClick={() => setActive(t.id)}>
            {t.title}
          </button>
        ))}
      </nav>

      <section className="panel" role="tabpanel">
        <div className="panel-head">
          <div className="htitle">
            <h2>{tab.title}</h2>
          </div>
        </div>
        <p className="panel-tagline">{tab.tagline}</p>
        {Comp ? <Comp /> : null}
      </section>

      <p className="footer">Built by Shivani Bokka</p>
    </main>
  );
}
