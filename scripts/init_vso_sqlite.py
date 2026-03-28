#!/usr/bin/env python3
"""Create local SQLite database vso.db with table `history` at the project root."""

from pathlib import Path

import sqlite3

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "vso.db"

DDL = """
CREATE TABLE IF NOT EXISTS history (
  "time" TEXT NOT NULL,
  domain TEXT NOT NULL,
  status TEXT NOT NULL,
  score INTEGER NOT NULL,
  as_prev TEXT,
  since_prev TEXT
);

CREATE INDEX IF NOT EXISTS idx_history_time ON history("time");
CREATE INDEX IF NOT EXISTS idx_history_domain ON history(domain);

CREATE TABLE IF NOT EXISTS chats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  domain_name TEXT,
  request TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chats_user ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_created ON chats(created_at);
"""


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.executescript(DDL)
        conn.commit()
    finally:
        conn.close()
    print(f"OK: {DB_PATH}")


if __name__ == "__main__":
    main()
