"""
core/ingestor.py

Handles extraction and chunking of source documents from plain text strings.
(PDF/URL fetching happens client-side; server only chunks raw text.)

All sources are split into overlapping sentence-level chunks before embedding.
"""

import re

CHUNK_SIZE = 300
CHUNK_OVERLAP = 50


def _split_into_chunks(
    text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP
) -> list[str]:
    """Split text into overlapping word-count chunks."""
    words = text.split()
    if not words:
        return []
    chunks = []
    start = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk = " ".join(words[start:end])
        if chunk.strip():
            chunks.append(chunk.strip())
        if end >= len(words):
            break
        start += chunk_size - overlap
    return chunks


def _clean(text: str) -> str:
    """Collapse whitespace and remove control characters."""
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def extract_text_chunks(text: str) -> list[str]:
    """Chunk plain text directly."""
    cleaned = _clean(text)
    return _split_into_chunks(cleaned)


