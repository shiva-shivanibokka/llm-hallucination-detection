"use client";

// Static instruction guide — no data fetching. Explains the project and walks
// through every tab so a first-time visitor knows what to do and in what order.

export default function AboutTab() {
  return (
    <div className="demo about">
      <div className="callout note">
        <strong>What this is.</strong> A hallucination detector for LLM answers. It reads a model&rsquo;s answer one
        sentence at a time and checks each sentence against a reference document with a natural-language-inference (NLI)
        model — asking &ldquo;does the source actually support this?&rdquo; It then grades the whole answer
        <em> grounded</em>, <em>partially grounded</em>, or <em>hallucinated</em>. The headline number is how often
        that detector agrees with <strong>human</strong> hallucination labels from the RAGTruth dataset — its F1 score.
      </div>

      {/* ---- glossary ---- */}
      <div>
        <p className="section-label">The concepts</p>

        <h3>Benchmark</h3>
        <p>
          A named set of <span className="k">test cases</span>. Each case is a question paired with a reference
          document the answer must stay faithful to. A benchmark is the &ldquo;exam&rdquo; you give a model.
        </p>

        <h3>Test case</h3>
        <p>
          One question + its reference text. A case can also carry a <span className="k">gold label</span> (a human
          verdict of grounded / hallucinated) and a stored answer. When both are present — as with RAGTruth — the
          detector can be scored against the human, no live model call needed.
        </p>

        <h3>Source type — internal vs public</h3>
        <p>
          Every case is tagged <span className="k">internal</span> (a private document the model has never seen) or{" "}
          <span className="k">public</span> (a document that may already be in the model&rsquo;s training data). Public
          sources carry <strong>contamination risk</strong>: a model can look accurate simply because it memorized the
          document. The Compare tab breaks scores out by source type so you can see that gap.
        </p>

        <h3>The detector</h3>
        <p>
          A <span className="k">DeBERTa-v3 NLI</span> model. For each answer sentence it estimates entailment vs
          contradiction against the source, producing a per-sentence hallucination score. The{" "}
          <span className="k">thresholds</span> on the Run Eval tab decide where those scores tip a sentence from
          grounded to partial to hallucinated — so you can tune sensitivity.
        </p>

        <h3>The score that matters — F1 vs humans</h3>
        <p>
          On a labeled benchmark (RAGTruth), each case has a human verdict. The detector makes its own verdict, and we
          compare the two: <span className="k">precision</span> (of the answers it flagged, how many humans also
          flagged), <span className="k">recall</span> (of the answers humans flagged, how many it caught), and their
          harmonic mean, <span className="k">F1</span>. That is the real measure of whether the detector works.
        </p>

        <h3>BYOK — bring your own key</h3>
        <p>
          The server holds <strong>no</strong> provider API keys. Anything that calls a live model — generating
          questions from your PDF, or generating fresh answers to score — uses a key you paste in. It is sent straight
          to the provider for that one call and never stored. Scoring RAGTruth&rsquo;s stored answers needs no key.
        </p>
      </div>

      {/* ---- pipeline: a real ordered sequence ---- */}
      <div>
        <p className="section-label">How a run works, end to end</p>
        <h3><span className="num">01</span>Pick a benchmark</h3>
        <p>Questions + reference documents, either RAGTruth&rsquo;s labeled cases or your own from a PDF.</p>
        <h3><span className="num">02</span>Get an answer per question</h3>
        <p>RAGTruth ships answers already; for your own benchmark the chosen model generates them (needs your key).</p>
        <h3><span className="num">03</span>Score every sentence</h3>
        <p>The NLI detector checks each sentence against the source and grades the answer.</p>
        <h3><span className="num">04</span>Compare to the human label</h3>
        <p>Where a gold label exists, the detector&rsquo;s verdict is matched against it to compute precision/recall/F1.</p>
      </div>

      {/* ---- quick start ---- */}
      <div className="callout note">
        <p className="section-label" style={{ margin: "0 0 .6rem" }}>Fastest path (no API key)</p>
        <p style={{ margin: 0 }}>
          <strong>1.</strong> Open <strong>RAGTruth</strong> → Seed a benchmark. &nbsp;
          <strong>2.</strong> Open <strong>Run Eval</strong> → pick that benchmark → Start run. &nbsp;
          <strong>3.</strong> Open <strong>Results</strong> → read the detector&rsquo;s F1 against the human labels.
        </p>
      </div>

      {/* ---- tab-by-tab ---- */}
      <div>
        <p className="section-label">Every tab, and how to use it</p>

        <h3>RAGTruth</h3>
        <p>
          The zero-setup entry point. Choose a split (<span className="k">train</span> or <span className="k">test</span>)
          and how many cases to load, then <span className="k">Seed RAGTruth benchmark</span>. It pulls that many
          human-labeled cases — question, source, stored answer, and verdict — into a benchmark you can run. No key
          required.
        </p>

        <h3>Run Eval</h3>
        <p>
          Scores a benchmark. Pick the benchmark, and — only if it needs fresh answers — a provider, model, and your
          key. The <span className="k">detector thresholds</span> control grading sensitivity; the defaults are sensible,
          so leave them unless you&rsquo;re experimenting. Press <span className="k">Start run</span> and progress
          updates live. RAGTruth benchmarks score their stored answers, so those need no key.
        </p>

        <h3>Results</h3>
        <p>
          Inspect one run. Pick it from the list to see its model and status, the average score and grounded rate, a{" "}
          <span className="k">domain breakdown</span>, and every question with its verdict. For a labeled run you also
          get the big <span className="k">F1</span> readout — the detector&rsquo;s agreement with the humans.
        </p>

        <h3>Compare</h3>
        <p>
          Put two runs side by side — a baseline (A) and a candidate (B) — to see which model hallucinates less. It
          shows the score delta, how many questions improved / regressed / stayed stable, and the{" "}
          <span className="k">internal vs public</span> split that flags contamination risk. Runs must share test cases
          to be comparable, so compare two runs of the same benchmark. Needs at least two completed runs.
        </p>

        <h3>New Benchmark</h3>
        <p>
          Build a benchmark from your own document. Upload a <span className="k">PDF</span> (text is extracted in your
          browser), name it, pick a domain and source type, choose how many questions to generate, and paste your API
          key — generating questions calls the model directly. This is the one place you always need a key. Once created,
          it shows up on Run Eval like any other benchmark.
        </p>
      </div>

      <p className="note">
        Free-tier stack throughout: Next.js on Vercel, FastAPI on GCP Cloud Run, Postgres on Neon. Keys you paste are
        never persisted.
      </p>
    </div>
  );
}
