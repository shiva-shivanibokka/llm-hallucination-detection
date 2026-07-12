"""
ingestor/vector_store.py

ChromaDB wrapper. Stores text chunks as embeddings using sentence-transformers.
One in-memory collection per process — ephemeral, resets on restart.
"""

import logging
import uuid
from typing import Optional

import chromadb
from chromadb.utils import embedding_functions

EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
TOP_K = 5

_log = logging.getLogger(__name__)


class VectorStore:
    def __init__(self) -> None:
        # chromadb.Client() is process-shared, so every VectorStore must use a
        # UNIQUE collection name — otherwise per-test-case stores accumulate each
        # other's chunks (and concurrent runs collide). See tests/test_vector_store_isolation.py.
        self._client = chromadb.Client()
        self._name = f"src_{uuid.uuid4().hex}"
        self._ef = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=EMBED_MODEL
        )
        self._collection = self._client.get_or_create_collection(
            name=self._name,
            embedding_function=self._ef,
            metadata={"hnsw:space": "cosine"},
        )

    def add_chunks(self, chunks: list[str], source_label: str = "unknown") -> int:
        if not chunks:
            return 0
        ids = [str(uuid.uuid4()) for _ in chunks]
        metadatas = [{"source": source_label} for _ in chunks]
        self._collection.add(documents=chunks, ids=ids, metadatas=metadatas)
        return len(chunks)

    def query(self, text: str, k: int = TOP_K) -> list[dict]:
        n = min(k, self._collection.count())
        if n == 0:
            return []
        results = self._collection.query(
            query_texts=[text],
            n_results=n,
            include=["documents", "distances"],
        )
        chunks = results["documents"][0]
        distances = results["distances"][0]
        return [
            {"chunk": chunk, "similarity": 1.0 - dist}
            for chunk, dist in zip(chunks, distances)
        ]

    def count(self) -> int:
        return self._collection.count()

    def close(self) -> None:
        """Delete this store's collection to free memory on the shared client."""
        try:
            self._client.delete_collection(self._name)
        except Exception:  # noqa: BLE001 — cleanup is best-effort, but log the leak
            _log.warning("vector_store_close_failed: leaked collection %s", self._name)
