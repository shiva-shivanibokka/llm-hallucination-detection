"""Shared pytest fixtures. DB tests skip cleanly when DATABASE_URL is unset."""

import os

import pytest


@pytest.fixture
def db():
    if not os.getenv("DATABASE_URL"):
        pytest.skip("DATABASE_URL not set — DB integration tests require Postgres")
    from db.database import get_connection, init_db

    init_db()
    with get_connection() as conn:
        # Start clean so each test is isolated.
        conn.execute(
            "TRUNCATE run_metrics, run_results, eval_runs, test_cases, benchmarks "
            "RESTART IDENTITY CASCADE"
        )
        conn.commit()
        yield conn
