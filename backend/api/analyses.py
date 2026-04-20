import aiosqlite
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.auth import get_current_user
from core.database import pack, unpack, expires_at_30d, get_db, new_id, utcnow

router = APIRouter()


# ── Models ────────────────────────────────────────────────────────────────────

class SaveRequest(BaseModel):
    analysis: dict
    sliders: list
    chat_history: list = []


class ChatUpdateRequest(BaseModel):
    chat_history: list


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/analyses")
async def save_analysis(
    body: SaveRequest,
    claims: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    aid        = new_id()
    latex      = body.analysis.get("latex", "")
    summary    = body.analysis.get("summary", {})
    summary_en = summary.get("en", "") if isinstance(summary, dict) else ""
    summary_sv = summary.get("sv", "") if isinstance(summary, dict) else ""
    data       = pack({"analysis": body.analysis, "sliders": body.sliders, "chat_history": body.chat_history})
    await db.execute(
        "INSERT INTO analyses(id,user_id,created_at,expires_at,latex,summary_en,summary_sv,data) VALUES(?,?,?,?,?,?,?,?)",
        (aid, claims["sub"], utcnow(), expires_at_30d(), latex, summary_en, summary_sv, data),
    )
    await db.commit()
    return {"ok": True, "id": aid}


@router.get("/analyses")
async def list_analyses(
    claims: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    # Lazily purge expired rows on each list call
    await db.execute("DELETE FROM analyses WHERE expires_at < ?", (utcnow(),))
    await db.commit()
    async with db.execute(
        "SELECT id, latex, summary_en, summary_sv, created_at, expires_at"
        " FROM analyses WHERE user_id=? ORDER BY created_at DESC",
        (claims["sub"],),
    ) as cur:
        rows = await cur.fetchall()
    return {"ok": True, "analyses": [dict(r) for r in rows]}


@router.get("/analyses/{aid}")
async def get_analysis(
    aid: str,
    claims: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    async with db.execute(
        "SELECT data FROM analyses WHERE id=? AND user_id=?",
        (aid, claims["sub"]),
    ) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Analysis not found")
    return {"ok": True, **unpack(row["data"])}


@router.put("/analyses/{aid}/chat")
async def update_chat(
    aid: str,
    body: ChatUpdateRequest,
    claims: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    async with db.execute(
        "SELECT data FROM analyses WHERE id=? AND user_id=?",
        (aid, claims["sub"]),
    ) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Analysis not found")
    stored = unpack(row["data"])
    stored["chat_history"] = body.chat_history
    await db.execute("UPDATE analyses SET data=? WHERE id=?", (pack(stored), aid))
    await db.commit()
    return {"ok": True}


@router.delete("/analyses/{aid}")
async def delete_one(
    aid: str,
    claims: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    await db.execute("DELETE FROM analyses WHERE id=? AND user_id=?", (aid, claims["sub"]))
    await db.commit()
    return {"ok": True}


@router.delete("/analyses")
async def delete_all(
    claims: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    await db.execute("DELETE FROM analyses WHERE user_id=?", (claims["sub"],))
    await db.commit()
    return {"ok": True}
