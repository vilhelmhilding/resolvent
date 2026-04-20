"""Async Anthropic SDK wrapper with prompt caching."""
import base64
import json
from collections.abc import AsyncIterator
from datetime import datetime
from pathlib import Path
from anthropic import AsyncAnthropic
from config import settings

_client: AsyncAnthropic | None = None
_LOG = Path(__file__).parent.parent.parent / "analysis.log"


def get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


def _log_truncation(stage: str, max_tokens: int, preview: str) -> None:
    entry = {
        "time": datetime.now().isoformat(),
        "error": "max_tokens_truncation",
        "stage": stage,
        "max_tokens": max_tokens,
        "response_preview": preview[:200],
    }
    with _LOG.open("a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


async def call_with_image(
    image_bytes: bytes,
    media_type: str,
    prompt: str,
    max_tokens: int | None = None,
    stage: str = "call_with_image",
) -> str:
    b64 = base64.standard_b64encode(image_bytes).decode("utf-8")
    mt = max_tokens or settings.max_tokens
    response = await get_client().messages.create(
        model=settings.anthropic_model,
        max_tokens=mt,
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt, "cache_control": {"type": "ephemeral"}},
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
            ],
        }],
    )
    text = response.content[0].text.strip()
    if response.stop_reason == "max_tokens":
        _log_truncation(stage, mt, text)
    return text


async def stream_text(
    system: str,
    messages: list,
    max_tokens: int = 1200,
    stage: str = "stream_text",
) -> AsyncIterator[str]:
    async with get_client().messages.stream(
        model=settings.anthropic_model,
        max_tokens=max_tokens,
        system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
        messages=messages,
    ) as stream:
        async for text in stream.text_stream:
            yield text
        final = await stream.get_final_message()
        if final.stop_reason == "max_tokens":
            preview = "".join(
                b.text for b in final.content if hasattr(b, "text")
            )
            _log_truncation(stage, max_tokens, preview)


async def call_text(
    system: str,
    messages: list,
    max_tokens: int = 1200,
    stage: str = "call_text",
) -> str:
    response = await get_client().messages.create(
        model=settings.anthropic_model,
        max_tokens=max_tokens,
        system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
        messages=messages,
    )
    text = response.content[0].text.strip()
    if response.stop_reason == "max_tokens":
        _log_truncation(stage, max_tokens, text)
    return text
