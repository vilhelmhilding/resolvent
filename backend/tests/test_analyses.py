"""Tests for the analyses CRUD API."""
import pytest

SAMPLE_ANALYSIS = {
    "latex": r"\int_{-\infty}^{\infty} e^{-x^2} dx",
    "summary": {"en": "Gaussian integral", "sv": "Gaussintegralen"},
    "intuition": {"en": "Area under bell curve", "sv": "Area under klockurvan"},
    "example": None,
    "main_viz": {"type": "function_plot", "params": {"expr": "exp(-x**2)", "xmin": -3, "xmax": 3}},
    "parts": [],
    "steps": [],
}

SAMPLE_SLIDERS = [{"name": "k", "min": 1, "max": 30, "default": 1, "step": 1}]
SAMPLE_CHAT = [{"role": "user", "content": "What is this?"}, {"role": "assistant", "content": "A Gaussian."}]


@pytest.mark.asyncio
async def test_save_requires_auth(client):
    r = await client.post("/analyses", json={"analysis": SAMPLE_ANALYSIS, "sliders": SAMPLE_SLIDERS})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_save_and_list(auth_client):
    r = await auth_client.post("/analyses", json={"analysis": SAMPLE_ANALYSIS, "sliders": SAMPLE_SLIDERS})
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert "id" in data

    listing = await auth_client.get("/analyses")
    assert listing.status_code == 200
    items = listing.json()["analyses"]
    assert len(items) == 1
    assert items[0]["id"] == data["id"]
    assert items[0]["latex"] == SAMPLE_ANALYSIS["latex"]
    assert "summary_en" in items[0]
    assert "summary_sv" in items[0]


@pytest.mark.asyncio
async def test_get_analysis_round_trip(auth_client):
    save = await auth_client.post("/analyses", json={
        "analysis": SAMPLE_ANALYSIS,
        "sliders": SAMPLE_SLIDERS,
        "chat_history": SAMPLE_CHAT,
    })
    aid = save.json()["id"]

    r = await auth_client.get(f"/analyses/{aid}")
    assert r.status_code == 200
    data = r.json()
    assert data["analysis"]["latex"] == SAMPLE_ANALYSIS["latex"]
    assert data["sliders"] == SAMPLE_SLIDERS
    assert data["chat_history"] == SAMPLE_CHAT


@pytest.mark.asyncio
async def test_get_nonexistent_analysis(auth_client):
    r = await auth_client.get("/analyses/doesnotexist")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_analysis_isolated_between_users(client):
    await client.post("/auth/register", json={"username": "user1", "password": "pass123"})
    await client.post("/auth/register", json={"username": "user2", "password": "pass123"})

    r1 = await client.post("/auth/login", json={"username": "user1", "password": "pass123"})
    session1 = r1.cookies.get("session")

    r2 = await client.post("/auth/login", json={"username": "user2", "password": "pass123"})
    session2 = r2.cookies.get("session")

    # User1 saves an analysis
    client.cookies.set("session", session1)
    save = await client.post("/analyses", json={"analysis": SAMPLE_ANALYSIS, "sliders": []})
    aid = save.json()["id"]

    # User2 cannot access it
    client.cookies.set("session", session2)
    r = await client.get(f"/analyses/{aid}")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_update_chat_history(auth_client):
    save = await auth_client.post("/analyses", json={"analysis": SAMPLE_ANALYSIS, "sliders": []})
    aid = save.json()["id"]

    new_chat = [{"role": "user", "content": "Updated?"}]
    r = await auth_client.put(f"/analyses/{aid}/chat", json={"chat_history": new_chat})
    assert r.status_code == 200

    fetched = await auth_client.get(f"/analyses/{aid}")
    assert fetched.json()["chat_history"] == new_chat


@pytest.mark.asyncio
async def test_delete_analysis(auth_client):
    save = await auth_client.post("/analyses", json={"analysis": SAMPLE_ANALYSIS, "sliders": []})
    aid = save.json()["id"]

    r = await auth_client.delete(f"/analyses/{aid}")
    assert r.status_code == 200

    r2 = await auth_client.get(f"/analyses/{aid}")
    assert r2.status_code == 404


@pytest.mark.asyncio
async def test_delete_all_analyses(auth_client):
    for _ in range(3):
        await auth_client.post("/analyses", json={"analysis": SAMPLE_ANALYSIS, "sliders": []})

    listing = await auth_client.get("/analyses")
    assert len(listing.json()["analyses"]) == 3

    await auth_client.delete("/analyses")
    listing = await auth_client.get("/analyses")
    assert listing.json()["analyses"] == []


@pytest.mark.asyncio
async def test_list_analyses_requires_auth(client):
    r = await client.get("/analyses")
    assert r.status_code == 401
