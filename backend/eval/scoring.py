"""
eval/scoring.py

Compare the detector's predictions against gold human labels (RAGTruth).

Positive class = "hallucinated". The detector's 3-way overall_label is mapped to
the binary gold space via label_to_binary(); PARTIALLY_GROUNDED counts as
hallucinated by default (a partially-grounded answer contains hallucinated
content). The threshold is documented in docs/adr/0001-*.md.
"""

HALLUCINATED = "hallucinated"
GROUNDED = "grounded"


def label_to_binary(overall_label: str, partial_is_hallucinated: bool = True) -> str:
    """Map the detector's overall_label to the binary gold space."""
    if overall_label == "GROUNDED":
        return GROUNDED
    if overall_label == "PARTIALLY_GROUNDED":
        return HALLUCINATED if partial_is_hallucinated else GROUNDED
    return HALLUCINATED  # HALLUCINATED, UNGROUNDED, or anything unexpected


def binary_metrics(pairs: list[tuple[str, str]]) -> dict:
    """
    pairs: list of (predicted, gold), each in {"hallucinated","grounded"}.
    Returns precision/recall/f1/accuracy for the positive class "hallucinated",
    plus n. Empty or degenerate inputs yield 0.0 rather than dividing by zero.
    """
    tp = fp = fn = tn = 0
    for predicted, gold in pairs:
        pred_pos = predicted == HALLUCINATED
        gold_pos = gold == HALLUCINATED
        if pred_pos and gold_pos:
            tp += 1
        elif pred_pos and not gold_pos:
            fp += 1
        elif not pred_pos and gold_pos:
            fn += 1
        else:
            tn += 1

    n = len(pairs)
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
    accuracy = (tp + tn) / n if n else 0.0
    return {
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "accuracy": round(accuracy, 4),
        "n": n,
    }
