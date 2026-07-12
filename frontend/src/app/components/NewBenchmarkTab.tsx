"use client";

import { useEffect, useState } from "react";
import { createBenchmark, generateCases, getProviders, type Providers } from "@/lib/api";
import { extractPdfText } from "@/lib/pdf";

const DOMAINS = ["general", "legal", "medical", "finance", "technical", "news", "other"];

export default function NewBenchmarkTab() {
  const [providers, setProviders] = useState<Providers>({});
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [name, setName] = useState("");
  const [numQuestions, setNumQuestions] = useState(10);
  const [domain, setDomain] = useState(DOMAINS[0]);
  const [sourceType, setSourceType] = useState<"internal" | "public">("internal");
  const [apiKey, setApiKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<string[] | null>(null);
  const [generatedFor, setGeneratedFor] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const p = await getProviders();
        setProviders(p);
        const first = Object.keys(p)[0] ?? "";
        setProvider(first);
        setModel(p[first]?.models?.[0] ?? "");
      } catch {
        setLoadError("Could not reach the backend. Check that the API is running.");
      }
    })();
  }, []);

  function handleProviderChange(next: string) {
    setProvider(next);
    setModel(providers[next]?.models?.[0] ?? "");
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
        setFormError("No extractable text found in that PDF. Try a different file.");
      } else {
        setExtractedText(text);
        if (!name) setName(f.name.replace(/\.pdf$/i, ""));
      }
    } catch {
      setFormError("Could not read that PDF. Try a different file.");
    } finally {
      setExtracting(false);
    }
  }

  async function handleCreate() {
    if (!apiKey.trim()) {
      setFormError(
        "Add your API key first — generating questions calls the model provider directly, and there is no server key."
      );
      return;
    }
    if (!name.trim() || !extractedText || !provider || !model) {
      setFormError("Upload a PDF, name the benchmark, and pick a provider and model first.");
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
        domain,
        source_type: sourceType,
        provider,
        model,
        api_key: apiKey.trim(),
      });
      setGeneratedQuestions(result.questions);
      setGeneratedFor(benchmark.name);
      setFile(null);
      setExtractedText("");
      setName("");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not create the benchmark. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="demo">
      {loadError && <div className="callout err note">{loadError}</div>}

      <div className="control-row">
        <div className="field" style={{ flexBasis: "100%" }}>
          <label>
            <span className="lname">Source PDF</span>
          </label>
          <input type="file" accept="application/pdf" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
          {extracting && <span className="note">Extracting text…</span>}
          {!extracting && extractedText && (
            <span className="note">{extractedText.length.toLocaleString()} characters extracted.</span>
          )}
        </div>

        <div className="field">
          <label>
            <span className="lname">Benchmark name</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Q3 policy handbook"
          />
        </div>

        <div className="field">
          <label>
            <span className="lname">Domain</span>
          </label>
          <select value={domain} onChange={(e) => setDomain(e.target.value)}>
            {DOMAINS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>
            <span className="lname">Questions to generate</span>
            <b>{numQuestions}</b>
          </label>
          <input
            type="range"
            min={3}
            max={30}
            step={1}
            value={numQuestions}
            onChange={(e) => setNumQuestions(Number(e.target.value))}
          />
        </div>

        <div className="field">
          <label>
            <span className="lname">Source type</span>
          </label>
          <div className="seg">
            <button type="button" aria-pressed={sourceType === "internal"} onClick={() => setSourceType("internal")}>
              Internal
            </button>
            <button type="button" aria-pressed={sourceType === "public"} onClick={() => setSourceType("public")}>
              Public
            </button>
          </div>
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
            placeholder="Required — never stored"
            autoComplete="off"
          />
        </div>
      </div>

      <div>
        <button
          type="button"
          className="btn"
          onClick={handleCreate}
          disabled={submitting || extracting || !extractedText}
        >
          {submitting ? "Generating…" : "Create benchmark from PDF"}
        </button>
      </div>

      {formError && <div className="callout err note">{formError}</div>}

      {generatedQuestions && (
        <div className="results">
          <p className="section-label">
            {generatedQuestions.length} question{generatedQuestions.length === 1 ? "" : "s"} generated for{" "}
            {generatedFor}
          </p>
          <div className="bars">
            {generatedQuestions.map((q, i) => (
              <div
                key={i}
                className="note"
                style={{ padding: ".6rem .85rem", background: "var(--panel-2)", borderRadius: 10, border: "1px solid var(--border)" }}
              >
                <strong>{String(i + 1).padStart(2, "0")}.</strong> {q}
              </div>
            ))}
          </div>
        </div>
      )}

      {!generatedQuestions && !formError && <p className="note">Upload a PDF to generate your first benchmark.</p>}
    </div>
  );
}
