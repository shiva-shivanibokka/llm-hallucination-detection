"""
eval/runner.py

Runs a full benchmark against a model and writes results to the database.

For each test case:
  1. Build a per-case in-memory vector store from the reference document.
  2. Generate a grounded response (LLM sees the reference document).
  3. Score the response with the NLI detector against the reference.
  4. Write the result (incl. a binary predicted_label) to run_results.

At the end: aggregate stats -> complete_run, and — when the benchmark carries
gold labels (RAGTruth) — detector-vs-human metrics -> save_run_metrics.

Runs synchronously in a FastAPI background task; progress is polled via
GET /runs/{run_id}. LLM provider keys come from the server environment only.
"""

from dataclasses import asdict

from core.detector import (
    HallucinationDetector,
    DEFAULT_ENTAIL_THRESHOLD,
    DEFAULT_CONTRADICT_THRESHOLD,
    DEFAULT_GROUNDED_CEILING,
    DEFAULT_PARTIAL_CEILING,
)
from core.generator import generate_grounded
from core.ingestor import extract_text_chunks
from core.logging_config import get_logger
from core.vector_store import VectorStore
from db.database import get_connection
from db.models import (
    add_run_result,
    complete_run,
    fail_run,
    get_run,
    get_test_cases,
    save_run_metrics,
)
from eval.scoring import binary_metrics, label_to_binary

log = get_logger(__name__)


def run_benchmark(
    run_id: int,
    entail_threshold: float = DEFAULT_ENTAIL_THRESHOLD,
    contradict_threshold: float = DEFAULT_CONTRADICT_THRESHOLD,
    grounded_ceiling: float = DEFAULT_GROUNDED_CEILING,
    partial_ceiling: float = DEFAULT_PARTIAL_CEILING,
) -> None:
    """Execute a benchmark run end-to-end. Writes results to the DB as it goes."""
    # Load the NLI model BEFORE touching the DB — otherwise the read transaction
    # below sits idle-in-transaction for the whole (multi-minute) model load,
    # holding a scarce pool connection that Neon/pgbouncer may kill.
    detector = HallucinationDetector()

    with get_connection() as conn:
        run = get_run(conn, run_id)
        if not run:
            log.warning("run_not_found", extra={"run_id": run_id})
            return
        test_cases = get_test_cases(conn, run["benchmark_id"])

    provider, model = run["provider"], run["model"]
    if not test_cases:
        with get_connection() as conn:
            fail_run(conn, run_id, "Benchmark has no test cases.")
        return

    log.info("run_started", extra={"run_id": run_id, "cases": len(test_cases),
                                   "provider": provider, "model": model})
    scores: list[float] = []
    grounded_verdicts = 0
    label_pairs: list[tuple[str, str]] = []  # (predicted, gold) when labeled

    try:
        for tc in test_cases:
            # Generation + NLI scoring happen with NO DB connection held.
            response, analysis = _score_case(
                tc, detector, provider, model,
                entail_threshold, contradict_threshold,
                grounded_ceiling, partial_ceiling, run_id,
            )
            predicted = label_to_binary(analysis["overall_label"])

            with get_connection() as conn:  # short-lived write per case
                add_run_result(
                    conn,
                    run_id=run_id,
                    test_case_id=tc["id"],
                    response=response,
                    overall_label=analysis["overall_label"],
                    hallucination_score=analysis["overall_hallucination_score"],
                    grounded_count=analysis["grounded_count"],
                    ungrounded_count=analysis["ungrounded_count"],
                    contradicted_count=analysis["contradicted_count"],
                    total_sentences=analysis["total_sentences"],
                    sentence_results=analysis["sentence_results"],
                    predicted_label=predicted,
                )

            scores.append(analysis["overall_hallucination_score"])
            if analysis["overall_label"] == "GROUNDED":
                grounded_verdicts += 1
            if tc.get("gold_label") in ("hallucinated", "grounded"):
                label_pairs.append((predicted, tc["gold_label"]))

        avg_score = sum(scores) / len(scores) if scores else 0.0
        grounded_pct = grounded_verdicts / len(test_cases)
        with get_connection() as conn:
            complete_run(conn, run_id, avg_score, grounded_pct)
            # Detector-vs-human metrics only when every scored case is labeled.
            if label_pairs and len(label_pairs) == len(test_cases):
                metrics = binary_metrics(label_pairs)
                save_run_metrics(conn, run_id, metrics)
                log.info("run_metrics", extra={"run_id": run_id, **metrics})

        log.info("run_completed", extra={"run_id": run_id, "avg_score": avg_score})

    except Exception as e:  # noqa: BLE001 — mark the run failed, don't crash the worker
        log.exception("run_failed", extra={"run_id": run_id})
        with get_connection() as conn:
            fail_run(conn, run_id, str(e))


# Result shape returned to the loop; mirrors detector.AnalysisResult as a dict.
_FAILED_ANALYSIS = {
    "overall_label": "HALLUCINATED",
    "overall_hallucination_score": 1.0,
    "grounded_count": 0,
    "ungrounded_count": 0,
    "contradicted_count": 0,
    "total_sentences": 0,
    "sentence_results": [],
}


def _score_case(tc, detector, provider, model, entail, contradict,
                grounded_ceil, partial_ceil, run_id):
    """Generate + score one case. On generation failure, return a fully-
    hallucinated result WITHOUT running NLI on the error text."""
    store = VectorStore()
    try:
        chunks = extract_text_chunks(tc["reference_text"])
        if chunks:
            store.add_chunks(chunks, source_label=f"test_case_{tc['id']}")

        # Labeled datasets (RAGTruth) ship a pre-generated answer whose gold
        # label annotates THAT text — score it directly, no generation. Only
        # user benchmarks (no stored answer) call the LLM.
        stored_answer = tc.get("answer")
        if stored_answer:
            response = stored_answer
        else:
            try:
                response = generate_grounded(
                    question=tc["question"], vector_store=store,
                    provider=provider, model=model,
                )
            except Exception as e:  # noqa: BLE001 — one bad case must not fail the run
                log.warning("generation_failed",
                            extra={"run_id": run_id, "case_id": tc["id"], "err": str(e)})
                return f"[generation failed: {e}]", dict(_FAILED_ANALYSIS)

        result = detector.analyze(
            response, store,
            entail_threshold=entail, contradict_threshold=contradict,
            grounded_ceiling=grounded_ceil, partial_ceiling=partial_ceil,
        )
        analysis = {
            "overall_label": result.overall_label,
            "overall_hallucination_score": result.overall_hallucination_score,
            "grounded_count": result.grounded_count,
            "ungrounded_count": result.ungrounded_count,
            "contradicted_count": result.contradicted_count,
            "total_sentences": result.total_sentences,
            "sentence_results": [asdict(sr) for sr in result.sentence_results],
        }
        return response, analysis
    finally:
        store.close()
