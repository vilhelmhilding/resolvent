# Copyright (c) 2026 Vilhelm Hilding. MIT License.
"""FastAPI entry point."""
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.analyze import router as analyze_router
from api.analyze_latex import router as analyze_latex_router
from api.chat import router as chat_router
from api.auth import router as auth_router
from api.analyses import router as analyses_router
from core.database import init_db
from config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Resolvent API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["POST", "GET", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
    allow_credentials=True,
)

app.include_router(analyze_router)
app.include_router(analyze_latex_router)
app.include_router(chat_router)
app.include_router(auth_router)
app.include_router(analyses_router)


@app.get("/health")
async def health():
    return {"ok": True}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
