"""Tests for the authentication system."""
import pytest


@pytest.mark.asyncio
async def test_register_success(client):
    r = await client.post("/auth/register", json={"username": "alice", "password": "secret99"})
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert data["username"] == "alice"
    assert "user_id" in data
    assert "session" in r.cookies


@pytest.mark.asyncio
async def test_register_duplicate_username(client):
    await client.post("/auth/register", json={"username": "bob", "password": "pass123"})
    r = await client.post("/auth/register", json={"username": "bob", "password": "different"})
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_register_username_too_short(client):
    r = await client.post("/auth/register", json={"username": "ab", "password": "pass123"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_register_password_too_short(client):
    r = await client.post("/auth/register", json={"username": "charlie", "password": "abc"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_register_username_invalid_chars(client):
    r = await client.post("/auth/register", json={"username": "bad name!", "password": "pass123"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_login_success(client):
    await client.post("/auth/register", json={"username": "dave", "password": "mypassword"})
    # New client without cookies to test fresh login
    r = await client.post("/auth/login", json={"username": "dave", "password": "mypassword"})
    assert r.status_code == 200
    assert r.json()["ok"] is True
    assert "session" in r.cookies


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    await client.post("/auth/register", json={"username": "eve", "password": "correct"})
    r = await client.post("/auth/login", json={"username": "eve", "password": "wrong"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_login_unknown_user(client):
    r = await client.post("/auth/login", json={"username": "nobody", "password": "pass"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_me_authenticated(auth_client):
    r = await auth_client.get("/auth/me")
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert data["username"] == "testuser"


@pytest.mark.asyncio
async def test_me_unauthenticated(client):
    r = await client.get("/auth/me")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_logout_clears_session(auth_client):
    # Confirm we're logged in
    assert (await auth_client.get("/auth/me")).status_code == 200
    # Logout
    r = await auth_client.post("/auth/logout")
    assert r.status_code == 200
    # Session cookie is deleted — /me should now return 401
    # httpx keeps old cookies; manually clear
    auth_client.cookies.clear()
    assert (await auth_client.get("/auth/me")).status_code == 401


@pytest.mark.asyncio
async def test_login_case_insensitive_username(client):
    await client.post("/auth/register", json={"username": "Frank", "password": "pass123"})
    r = await client.post("/auth/login", json={"username": "frank", "password": "pass123"})
    assert r.status_code == 200
