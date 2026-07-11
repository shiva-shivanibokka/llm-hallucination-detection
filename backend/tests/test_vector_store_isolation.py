"""
Regression test for the ChromaDB cross-contamination bug.

Each VectorStore instance must be isolated: chunks added to one store must
never be visible to another. Before the fix, all instances shared a single
fixed-name collection on the process-wide chromadb.Client(), so test case N
was scored against the accumulated documents of test cases 1..N-1.
"""

from core.vector_store import VectorStore


def test_stores_are_isolated():
    a = VectorStore()
    a.add_chunks(["apples grow on trees"], source_label="case_a")

    b = VectorStore()
    # b is a brand-new store — it must not see case_a's chunk.
    assert b.count() == 0, f"contamination: new store sees {b.count()} chunks from another store"

    b.add_chunks(["zebras live on the savanna"], source_label="case_b")
    assert b.count() == 1

    hits = b.query("apples")
    assert all("apple" not in h["chunk"] for h in hits), "b retrieved a's document"

    a.close()
    b.close()


if __name__ == "__main__":
    test_stores_are_isolated()
    print("PASS")
