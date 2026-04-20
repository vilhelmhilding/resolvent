import uuid

import bcrypt
import aiosqlite
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from pydantic import BaseModel

from core.database import get_db, new_id, utcnow

router = APIRouter(prefix="/auth")

# In-memory session store — cleared on every server restart (auto-logout)
_SESSIONS: dict[str, dict] = {}


def _new_session(user_id: str, username: str) -> str:
    sid = uuid.uuid4().hex
    _SESSIONS[sid] = {"sub": user_id, "username": username}
    return sid


def _set_cookie(response: Response, sid: str) -> None:
    response.set_cookie(
        "session", sid,
        httponly=True, samesite="lax",
        max_age=60 * 60 * 24 * 90, path="/",
    )


def get_current_user(session: str = Cookie(default=None)) -> dict:
    if not session or session not in _SESSIONS:
        raise HTTPException(401, "Not authenticated")
    return _SESSIONS[session]


# ── Request models ────────────────────────────────────────────────────────────

class AuthRequest(BaseModel):
    username: str
    password: str


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/register")
async def register(
    body: AuthRequest,
    response: Response,
    db: aiosqlite.Connection = Depends(get_db),
):
    uname = body.username.strip()
    if not (3 <= len(uname) <= 20) or not uname.replace("_", "").isalnum():
        raise HTTPException(400, "Username: 3–20 chars, letters/numbers/underscore only")
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    uid = new_id()
    pw_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    try:
        await db.execute(
            "INSERT INTO users(id, username, password_hash, created_at) VALUES (?,?,?,?)",
            (uid, uname, pw_hash, utcnow()),
        )
        await db.commit()
    except aiosqlite.IntegrityError:
        raise HTTPException(409, "Username already taken")

    _set_cookie(response, _new_session(uid, uname))
    return {"ok": True, "user_id": uid, "username": uname}


@router.post("/login")
async def login(
    body: AuthRequest,
    response: Response,
    db: aiosqlite.Connection = Depends(get_db),
):
    async with db.execute(
        "SELECT id, username, password_hash FROM users WHERE username=? COLLATE NOCASE",
        (body.username.strip(),),
    ) as cur:
        row = await cur.fetchone()

    if not row or not bcrypt.checkpw(body.password.encode(), row["password_hash"].encode()):
        raise HTTPException(401, "Invalid username or password")

    _set_cookie(response, _new_session(row["id"], row["username"]))
    return {"ok": True, "user_id": row["id"], "username": row["username"]}


@router.post("/logout")
async def logout(response: Response, session: str = Cookie(default=None)):
    if session:
        _SESSIONS.pop(session, None)
    response.delete_cookie("session", path="/")
    return {"ok": True}


@router.get("/me")
async def me(claims: dict = Depends(get_current_user)):
    return {"ok": True, "user_id": claims["sub"], "username": claims["username"]}
