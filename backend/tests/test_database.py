"""Tests for database encryption, compression, and schema."""
import pytest
import json
import os

os.environ.setdefault("DB_PATH", "/tmp/resolvent_test.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-unit-tests-only")

from core.database import pack, unpack, init_db, DB_PATH


def test_pack_unpack_round_trip():
    original = {"analysis": {"latex": r"\int e^x dx"}, "sliders": [{"name": "k"}], "chat_history": []}
    packed = pack(original)
    result = unpack(packed)
    assert result == original


def test_pack_produces_bytes():
    data = {"foo": "bar"}
    packed = pack(data)
    assert isinstance(packed, bytes)


def test_pack_is_encrypted_not_plain_json():
    data = {"secret": "value"}
    packed = pack(data)
    assert b'"secret"' not in packed
    assert b"value" not in packed


def test_pack_different_data_different_bytes():
    a = pack({"x": 1})
    b = pack({"x": 2})
    assert a != b


def test_unpack_rejects_corrupted_data():
    with pytest.raises(Exception):
        unpack(b"this is not valid ciphertext")


def test_unicode_survives_round_trip():
    data = {"text": "Fourier-serien för en fyrkantvåg: $c_k = \\frac{2}{i\\pi k}$"}
    assert unpack(pack(data)) == data


def test_large_payload_round_trip():
    data = {"items": [{"latex": "x^2", "value": i} for i in range(200)]}
    assert unpack(pack(data)) == data


@pytest.mark.asyncio
async def test_init_db_creates_tables():
    import pathlib, aiosqlite
    db_path = pathlib.Path("/tmp/resolvent_schema_test.db")
    if db_path.exists():
        db_path.unlink()

    import os
    os.environ["DB_PATH"] = str(db_path)
    # Re-import to pick up new path
    import importlib, core.database as db_mod
    importlib.reload(db_mod)
    await db_mod.init_db()

    async with aiosqlite.connect(db_path) as db:
        async with db.execute("SELECT name FROM sqlite_master WHERE type='table'") as cur:
            tables = {row[0] for row in await cur.fetchall()}

    assert "users" in tables
    assert "analyses" in tables
    db_path.unlink()
    os.environ["DB_PATH"] = "/tmp/resolvent_test.db"
