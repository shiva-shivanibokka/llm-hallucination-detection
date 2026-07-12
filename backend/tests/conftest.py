"""Shared pytest fixtures. DB tests skip cleanly when DATABASE_URL is unset."""

import os

import pytest


@pytest.fixture
def db():
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        pytest.skip("DATABASE_URL not set — DB integration tests require Postgres")
    # These tests TRUNCATE every table. Refuse to run against a managed/prod
    # database (e.g. Neon) unless explicitly allowed — pointing them at prod
    # wipes real data. CI runs them against a throwaway localhost Postgres.
    if ("neon.tech" in dsn or "supabase" in dsn) and os.getenv("ALLOW_DESTRUCTIVE_DB_TESTS") != "1":
        pytest.skip(
            "refusing to run destructive DB tests against a managed database; "
            "use a throwaway Postgres, or set ALLOW_DESTRUCTIVE_DB_TESTS=1 to override"
        )
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
