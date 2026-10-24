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