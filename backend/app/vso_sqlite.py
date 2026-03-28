"""SQLite file vso.db at project root (see scripts/init_vso_sqlite.py)."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any
from uuid import UUID

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
VSO_DB_PATH = PROJECT_ROOT / "vso.db"


def _connect() -> sqlite3.Connection:
    VSO_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(VSO_DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def ensure_chats_table() -> None:
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                domain_name TEXT,
                request TEXT NOT NULL,
                response TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_chats_user ON chats(user_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_chats_created ON chats(created_at DESC)")
        conn.commit()


def list_chats(user_id: UUID, limit: int = 50) -> list[dict[str, Any]]:
    ensure_chats_table()
    uid = str(user_id)
    with _connect() as conn:
        cur = conn.execute(
            """
            SELECT id, user_id, domain_name, request, response, created_at
            FROM chats
            WHERE user_id = ?
            ORDER BY datetime(created_at) DESC
            LIMIT ?
            """,
            (uid, limit),
        )
        rows = cur.fetchall()
    return [dict(r) for r in rows]


def insert_chat(user_id: UUID, domain_name: str | None, request_json: str, response_preview: str) -> int:
    ensure_chats_table()
    uid = str(user_id)
    with _connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO chats (user_id, domain_name, request, response)
            VALUES (?, ?, ?, ?)
            """,
            (uid, domain_name or "", request_json, response_preview),
        )
        conn.commit()
        return int(cur.lastrowid or 0)


def delete_chat(user_id: UUID, chat_id: int) -> bool:
    ensure_chats_table()
    uid = str(user_id)
    with _connect() as conn:
        cur = conn.execute("DELETE FROM chats WHERE id = ? AND user_id = ?", (chat_id, uid))
        conn.commit()
        return cur.rowcount > 0


def get_chat_by_id(user_id: UUID, chat_id: int) -> dict[str, Any] | None:
    ensure_chats_table()
    uid = str(user_id)
    with _connect() as conn:
        cur = conn.execute(
            """
            SELECT id, user_id, domain_name, request, response, created_at
            FROM chats WHERE id = ? AND user_id = ?
            """,
            (chat_id, uid),
        )
        r = cur.fetchone()
    return dict(r) if r else None


def parse_messages_from_request(request: str) -> list[dict[str, str]]:
    try:
        data = json.loads(request)
        if isinstance(data, list):
            return [{"role": str(m.get("role", "")), "content": str(m.get("content", ""))} for m in data]
    except (json.JSONDecodeError, TypeError):
        pass
    return []
