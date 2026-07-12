"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";

const load = (p: () => Promise<{ default: ComponentType }>) =>
  dynamic(p, { ssr: false, loading: () => <p className="note">loading…</p> });

const TABS = [
  {
    id: "new",
    title: "New Benchmark",
    tagline: "Upload a reference PDF and generate a benchmark of grounded questions from it.",
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
    id: "ragtruth",
    title: "RAGTruth",
    tagline: "Seed the human-labeled RAGTruth dataset as a benchmark to measure the detector against real annotations.",
  },
];

const TAB_COMPONENTS: Record<string, ComponentType> = {
  new: load(() => import("./components/NewBenchmarkTab")),
  run: load(() => import("./components/RunEvalTab")),
  results: load(() => import("./components/ResultsTab")),
  compare: load(() => import("./components/CompareTab")),
  ragtruth: load(() => import("./components/RagtruthTab")),
};

export default function Home() {
  const [active, setActive] = useState(TABS[0].id);
  const tab = TABS.find((t) => t.id === active)!;
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
        <span className="live">
          <b>●</b> live · GCP Cloud Run + Neon · RAGTruth-labeled
        </span>
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
