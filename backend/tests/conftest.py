"""Shared fixtures for the Resolvent test suite."""
import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

# Point at a temp in-memory-style DB for every test run
os.environ.setdefault("DB_PATH", "/tmp/resolvent_test.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-unit-tests-only")
os.environ.setdefault("ANTHROPIC_API_KEY", "dummy-key-for-tests")

from main import app
from core.database import init_db


@pytest_asyncio.fixture(scope="function")
async def client():
    """Fresh ASGI client + fresh database per test."""
    import os, pathlib
    db = pathlib.Path(os.environ["DB_PATH"])
    if db.exists():
        db.unlink()
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    if db.exists():
        db.unlink()


@pytest_asyncio.fixture
async def auth_client(client):
    """Client with a registered + logged-in user."""
    await client.post("/auth/register", json={"username": "testuser", "password": "password123"})
    return client
