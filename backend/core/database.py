import base64
import gzip
import hashlib
import json
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import aiosqlite
from cryptography.fernet import Fernet

import os
DB_PATH = Path(os.environ.get("DB_PATH", str(Path(__file__).parent.parent.parent / "resolvent.db")))

_SCHEMA = [
    """CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY,
        username      TEXT UNIQUE NOT NULL COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        created_at    TEXT NOT NULL
    )""",
    """CREATE TABLE IF NOT EXISTS analyses (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        latex      TEXT NOT NULL,
        summary_en TEXT NOT NULL,
        summary_sv TEXT NOT NULL DEFAULT '',
        data       BLOB NOT NULL
    )""",
    "CREATE INDEX IF NOT EXISTS idx_analyses_user    ON analyses(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_analyses_expires ON analyses(expires_at)",
]

_MIGRATIONS = [
    "ALTER TABLE analyses ADD COLUMN summary_sv TEXT NOT NULL DEFAULT ''",
]


def _make_fernet() -> Fernet:
    from config import settings
    # Derive a 32-byte key from secret_key via SHA-256, then base64-urlsafe encode
    raw = hashlib.sha256(settings.secret_key.encode()).digest()
    key = base64.urlsafe_b64encode(raw)
    return Fernet(key)


async def init_db() -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        for stmt in _SCHEMA:
            await db.execute(stmt)
        for migration in _MIGRATIONS:
            try:
                await db.execute(migration)
            except Exception:
                pass  # column already exists
        await db.commit()


async def get_db():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        yield db


def pack(obj: dict) -> bytes:
    """Gzip-compress then Fernet-encrypt a dict."""
    compressed = gzip.compress(json.dumps(obj, ensure_ascii=False).encode(), compresslevel=6)
    return _make_fernet().encrypt(compressed)


def unpack(data: bytes) -> dict:
    """Fernet-decrypt then gzip-decompress back to a dict."""
    compressed = _make_fernet().decrypt(data)
    return json.loads(gzip.decompress(compressed).decode())


def new_id() -> str:
    return uuid.uuid4().hex


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def expires_at_30d() -> str:
    return (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
