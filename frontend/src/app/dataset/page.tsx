"use client";

import { useState } from "react";
import Link from "next/link";
import { seedRagtruth, type SeedRagtruthResult } from "@/lib/api";
import { Button, Card, ErrorBanner, Input, Label, SectionHeading, Select } from "@/components/ui";

export default function DatasetPage() {
  const [split, setSplit] = useState("train");
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
      setError(e instanceof Error ? e.message : "Failed to seed RAGTruth.");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <SectionHeading eyebrow="Ground truth" title="RAGTruth" />

      <p className="text-sm leading-relaxed text-[var(--text-muted)]">
        RAGTruth is a human-labeled hallucination dataset: each answer was reviewed
        by annotators and marked grounded or hallucinated against its source
        document. Seeding it as a benchmark and running the detector against it
        measures something a synthetic benchmark can&rsquo;t — how often the
        detector agrees with an actual human judgment. That agreement rate is the
        F1 score shown on the Results page once a run completes.
      </p>

      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Split</Label>
            <Select value={split} onChange={(e) => setSplit(e.target.value)}>
              <option value="train">train</option>
              <option value="test">test</option>
            </Select>
          </div>
          <div>
            <Label>Number of cases</Label>
            <Input
              type="number"
              min={1}
              max={2000}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            />
          </div>
        </div>
        <Button onClick={handleSeed} disabled={seeding} className="mt-4 w-full">
          {seeding ? "Seeding…" : "Seed RAGTruth benchmark"}
        </Button>
        {error && (
          <div className="mt-3">
            <ErrorBanner message={error} />
          </div>
        )}
      </Card>

      {seeded && (
        <Card className="p-5" style={{ borderColor: "var(--grounded)" }}>
          <p className="text-sm font-medium text-[var(--text)]">
            Seeded benchmark #{seeded.benchmark_id} with {seeded.added} labeled cases.
          </p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Next: pick it on{" "}
            <Link href="/run" className="text-[var(--accent)] underline underline-offset-2">
              Run Eval
            </Link>{" "}
            to score it, then check the detector&rsquo;s precision, recall, and F1
            against the human labels on{" "}
            <Link href="/results" className="text-[var(--accent)] underline underline-offset-2">
              Results
            </Link>
            .
          </p>
        </Card>
      )}
    </div>
  );
}
