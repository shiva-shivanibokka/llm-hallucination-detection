"use client";

import { useEffect, useRef, useState } from "react";
import { createBenchmark, deleteBenchmark, generateCases, getProviders, type Providers } from "@/lib/api";
import { extractPdfText } from "@/lib/pdf";
import { getApiKey, setApiKey as persistApiKey } from "@/lib/keyStore";
import Help from "./Help";

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
  // Key persists across tab switches (in-memory), cleared on refresh/close.
  const [apiKey, setApiKey] = useState(getApiKey);
  function updateApiKey(v: string) {
    setApiKey(v);
    persistApiKey(v);
  }
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<string[] | null>(null);
  const [generatedFor, setGeneratedFor] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
      try {
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
        if (fileRef.current) fileRef.current.value = ""; // let the same PDF be re-picked
      } catch (genError) {
        // Generation failed — roll back the empty benchmark so it doesn't
        // linger in the Run Eval list and trap you into a "no test cases" error.
        await deleteBenchmark(benchmark.id).catch(() => {});
        throw genError;
      }
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
            <span className="lname">
              Source PDF
              <Help text="The reference document. Its text is extracted in your browser, then the model writes questions grounded in it." />
            </span>
          </label>
          <input ref={fileRef} type="file" accept="application/pdf" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
          {extracting && <span className="note">Extracting text…</span>}
          {!extracting && extractedText && (
            <span className="note">{extractedText.length.toLocaleString()} characters extracted.</span>
          )}
        </div>

        <div className="field">
          <label>
            <span className="lname">
              Benchmark name
              <Help text="A label for this benchmark, shown in the Run Eval and Results lists." />
            </span>
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
            <span className="lname">
              Domain
              <Help text="A topic tag for these cases, used to group scores in the Results domain breakdown." />
            </span>
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
            <span className="lname">
              Questions to generate
              <Help text="How many questions the model writes from the document. Each becomes one test case." />
            </span>
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
            <span className="lname">
              Source type
              <Help text="Internal = a private document the model hasn't seen. Public = may be in the model's training data (contamination risk)." />
            </span>
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
            <span className="lname">
              Provider
              <Help text="Which LLM service writes the questions from your document." />
            </span>
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
            <span className="lname">
              Model
              <Help text="The specific model from the chosen provider used to write the questions." />
            </span>
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
            <span className="lname">
              Your API key
              <Help text="Your provider key, used to generate questions. Required here. Kept in memory for this session and cleared on refresh — never stored." />
            </span>
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => updateApiKey(e.target.value)}
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
