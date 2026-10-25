"""Tiny startup migration: add newer project columns to databases created earlier."""
from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection


def ensure_project_owner_column(conn: Connection) -> None:
    columns = {c["name"] for c in inspect(conn).get_columns("projects")}
    if "user_id" not in columns:
        conn.execute(text("ALTER TABLE projects ADD COLUMN user_id VARCHAR(36)"))
    if "pinned" not in columns:
        conn.execute(text("ALTER TABLE projects ADD COLUMN pinned BOOLEAN NOT NULL DEFAULT FALSE"))
    if "sort_order" not in columns:
        conn.execute(text("ALTER TABLE projects ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_projects_user_id ON projects (user_id)"))

def ensure_failure_classification_columns(conn: Connection) -> None:
    """Add Phase 11 classification columns to the failures table."""
    try:
        columns = {c["name"] for c in inspect(conn).get_columns("failures")}
        if "fingerprint_hash" not in columns:
            conn.execute(text("ALTER TABLE failures ADD COLUMN fingerprint_hash VARCHAR(32)"))
        if "category" not in columns:
            conn.execute(text("ALTER TABLE failures ADD COLUMN category VARCHAR(60)"))
        if "occurrence_count" not in columns:
            conn.execute(text("ALTER TABLE failures ADD COLUMN occurrence_count VARCHAR(10) NOT NULL DEFAULT '1'"))
        if "root_cause_hint" not in columns:
            conn.execute(text("ALTER TABLE failures ADD COLUMN root_cause_hint TEXT"))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_failures_fingerprint ON failures (fingerprint_hash)"
        ))
    except Exception:
        pass  # Table may not exist yet; create_all will handle it