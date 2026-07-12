"""
db/database.py

Postgres (Neon) connection management + migration runner.

Connections come from a lazily-opened psycopg connection pool keyed on the
DATABASE_URL env var. The app fails loudly at startup if DATABASE_URL is unset
rather than limping along and failing on the first query.

Usage:
    with get_connection() as conn:
        conn.execute(...)          # dict rows via dict_row
        conn.commit()

Migrations: init_db() applies every backend/migrations/*.sql file in filename
order exactly once, tracked in the schema_migrations table.
"""

import os
from pathlib import Path

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

MIGRATIONS_DIR = Path(__file__).parent.parent / "migrations"

_pool: ConnectionPool | None = None


def _dsn() -> str:
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        raise RuntimeError(
            "DATABASE_URL not set. Point it at your Neon (or local) Postgres, "
            "e.g. postgresql://user:pass@host/db?sslmode=require"
        )
    return dsn


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        # min_size=0: don't hold a connection open while idle, so Neon (free tier)
        # can autosuspend and not burn compute hours when the backend is idle.
        _pool = ConnectionPool(
            _dsn(),
            min_size=0,
            max_size=5,
            kwargs={"row_factory": dict_row, "autocommit": False},
            open=True,
        )
    return _pool


def get_connection():
    """Context manager yielding a pooled connection (dict rows)."""
    return get_pool().connection()


def _applied_migrations(conn) -> set[str]:
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY)"
    )
    conn.commit()
    rows = conn.execute("SELECT filename FROM schema_migrations").fetchall()
    return {r["filename"] for r in rows}


def init_db() -> None:
    """Apply all pending migration files in order. Safe to call on every startup."""
    if not MIGRATIONS_DIR.is_dir():
        raise RuntimeError(f"migrations dir missing: {MIGRATIONS_DIR}")

    with get_connection() as conn:
        done = _applied_migrations(conn)
        for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
            if path.name in done:
                continue
            sql = path.read_text(encoding="utf-8")
            conn.execute(sql)
            conn.execute(
                "INSERT INTO schema_migrations (filename) VALUES (%s)", (path.name,)
            )
            conn.commit()
