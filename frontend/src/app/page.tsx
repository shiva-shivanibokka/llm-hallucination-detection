"use client";

import { useEffect, useState } from "react";
import {
  createBenchmark,
  deleteBenchmark,
  generateCases,
  getProviders,
  listBenchmarks,
  type Benchmark,
  type Providers,
} from "@/lib/api";
import { extractPdfText } from "@/lib/pdf";
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Input,
  Label,
  Select,
  SectionHeading,
  Slider,
} from "@/components/ui";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function BenchmarksPage() {
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [providers, setProviders] = useState<Providers>({});
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Create-from-PDF form state
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [name, setName] = useState("");
  const [numQuestions, setNumQuestions] = useState(10);
  const [domain, setDomain] = useState("general");
  const [sourceType, setSourceType] = useState("internal");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<string[] | null>(null);

  async function refresh() {
    try {
      const [b, p] = await Promise.all([listBenchmarks(), getProviders()]);
      setBenchmarks(b);
      setProviders(p);
      if (!provider) {
        const firstProvider = Object.keys(p)[0] ?? "";
        setProvider(firstProvider);
        setModel(p[firstProvider]?.models?.[0] ?? "");
      }
    } catch {
      setListError("Could not reach the backend. Check that the API is running.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleProviderChange(nextProvider: string) {
    setProvider(nextProvider);
    setModel(providers[nextProvider]?.models?.[0] ?? "");
  }

  async function handleFile(f: File | null) {
    setFile(f);
    setExtractedText("");
    setGeneratedQuestions(null);
    setFormError(null);
    if (!f) return;
    setExtracting(true);
    try {
      const text = await extractPdfText(f);
      if (!text) {
        setFormError("No extractable text found in that PDF.");
      } else {
        setExtractedText(text);
        if (!name) {
          setName(f.name.replace(/\.pdf$/i, ""));
        }
      }
    } catch {
      setFormError("Could not read that PDF. Try a different file.");
    } finally {
      setExtracting(false);
    }
  }

  async function handleCreate() {
    if (!name.trim() || !extractedText || !provider || !model) {
      setFormError("Add a PDF, a name, and pick a provider before generating.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setGeneratedQuestions(null);
    try {
      const benchmark = await createBenchmark({
        name: name.trim(),
        description: `Generated from ${file?.name ?? "uploaded PDF"}`,
      });
      const result = await generateCases(benchmark.id, {
        reference_text: extractedText,
        num_cases: numQuestions,
        domain: domain.trim() || "general",
        source_type: sourceType,
        provider,
        model,
      });
      setGeneratedQuestions(result.questions);
      setFile(null);
      setExtractedText("");
      setName("");
      await refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to create benchmark.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this benchmark and all of its test cases?")) return;
    try {
      await deleteBenchmark(id);
      setBenchmarks((prev) => prev.filter((b) => b.id !== id));
    } catch {
      setListError("Could not delete that benchmark.");
    }
  }

  return (
    <div className="space-y-10">
      <section>
        <SectionHeading
          eyebrow="Step 1"
          title="Benchmarks"
        />
        {listError && <ErrorBanner message={listError} />}
        {!listError && loading && (
          <p className="text-sm text-[var(--text-muted)]">Loading benchmarks…</p>
        )}
        {!listError && !loading && benchmarks.length === 0 && (
          <EmptyState
            title="No benchmarks yet"
            body="Create one from a PDF below to get started."
          />
        )}
        {!listError && benchmarks.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {benchmarks.map((b) => (
              <Card key={b.id} className="flex flex-col justify-between p-4">
                <div>
                  <p className="font-medium text-[var(--text)]">{b.name}</p>
                  {b.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--text-muted)]">
                      {b.description}
                    </p>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="font-mono text-xs text-[var(--text-muted)]">
                    <span className="text-[var(--text)]">{b.case_count}</span> cases ·{" "}
                    {formatDate(b.created_at)}
                  </div>
                  <button
                    onClick={() => handleDelete(b.id)}
                    className="text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--hallucinated)]"
                  >
                    Delete
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading eyebrow="Step 2" title="Create from PDF" />
        <Card className="p-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <Label>Source PDF</Label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-[var(--text-muted)] file:mr-3 file:rounded-md file:border file:border-[var(--border)] file:bg-[var(--surface)] file:px-3 file:py-1.5 file:text-sm file:text-[var(--text)] hover:file:border-[var(--accent)]"
                />
                {extracting && (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Extracting text…</p>
                )}
                {!extracting && extractedText && (
                  <p className="mt-1 font-mono text-xs text-[var(--grounded)]">
                    {extractedText.length.toLocaleString()} characters extracted
                  </p>
                )}
              </div>

              <div>
                <Label>Benchmark name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Q3 policy handbook"
                />
              </div>

              <div>
                <Label>Domain</Label>
                <Input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="general"
                />
              </div>

              <div>
                <Label>Source type</Label>
                <Select value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
                  <option value="internal">Internal (private document)</option>
                  <option value="public">Public (contamination risk)</option>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Questions to generate (3–30)</Label>
                <Slider value={numQuestions} onChange={setNumQuestions} min={3} max={30} />
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

              <Button
                onClick={handleCreate}
                disabled={submitting || extracting || !extractedText}
                className="mt-2 w-full"
              >
                {submitting ? "Generating…" : "Create benchmark & generate questions"}
              </Button>
              {formError && <ErrorBanner message={formError} />}
            </div>
          </div>

          {generatedQuestions && (
            <div className="mt-6 border-t border-[var(--border)] pt-5">
              <p className="mb-2 font-mono text-xs uppercase tracking-widest text-[var(--text-muted)]">
                {generatedQuestions.length} questions generated
              </p>
              <ol className="space-y-1.5">
                {generatedQuestions.map((q, i) => (
                  <li key={i} className="text-sm text-[var(--text)]">
                    <span className="mr-2 font-mono text-xs text-[var(--text-muted)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {q}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
