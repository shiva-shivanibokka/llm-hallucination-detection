"use client";

import { useState } from "react";
import { seedRagtruth, type SeedRagtruthResult } from "@/lib/api";

export default function RagtruthTab() {
  const [split, setSplit] = useState<"train" | "test">("train");
  const [limit, setLimit] = useState(50);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState<SeedRagtruthResult | null>(null);

  async function handleSeed() {
    setSeeding(true);
    setError(null);
    setSeeded(null);
    try {
      const result = await seedRagtruth({ split, limit });
      setSeeded(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not seed RAGTruth. Try again.");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="demo">
      <div className="callout note">
        RAGTruth is a human-labeled hallucination dataset — each stored answer was reviewed by annotators and marked
        grounded or hallucinated against its source document. Seeding it as a benchmark and running the detector
        against it measures something a synthetic benchmark can&rsquo;t: how often the detector agrees with an
        actual human judgment. That agreement is the F1 score on the <strong>Results</strong> tab.
      </div>

      <div className="control-row">
        <div className="field">
          <label>
            <span className="lname">Split</span>
          </label>
          <select value={split} onChange={(e) => setSplit(e.target.value as "train" | "test")}>
            <option value="train">train</option>
            <option value="test">test</option>
          </select>
        </div>
        <div className="field">
          <label>
            <span className="lname">Number of cases</span>
            <b>{limit}</b>
          </label>
          <input type="range" min={1} max={200} step={1} value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
        </div>
      </div>

      <div>
        <button type="button" className="btn" onClick={handleSeed} disabled={seeding}>
          {seeding ? "Seeding…" : "Seed RAGTruth benchmark"}
        </button>
      </div>

      {error && <div className="callout err note">{error}</div>}

      {seeded && (
        <div className="readout">
          <div className="lbl">Seeded benchmark #{seeded.benchmark_id}</div>
          <div className="big">{seeded.added}</div>
          <div className="lbl">labeled cases added</div>
          <p className="note" style={{ marginTop: ".8rem" }}>
            Next: pick it on <strong>Run Eval</strong> to score it, then check the detector&rsquo;s precision,
            recall, and F1 against the human labels on <strong>Results</strong>.
          </p>
        </div>
      )}
    </div>
  );
}
