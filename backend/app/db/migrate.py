"""Tiny startup migration: add projects.user_id to databases created before accounts."""
from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection


def ensure_project_owner_column(conn: Connection) -> None:
    columns = {c["name"] for c in inspect(conn).get_columns("projects")}
    if "user_id" not in columns:
        conn.execute(text("ALTER TABLE projects ADD COLUMN user_id VARCHAR(36)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_projects_user_id ON projects (user_id)"))