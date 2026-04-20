# Copyright (c) 2026 Vilhelm Hilding. MIT License.
import traceback
from fastapi import APIRouter
from pydantic import BaseModel

from core.anthropic_client import call_text

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    analysis_data: dict = {}
    history: list = []
    lang: str = "en"


def _viz_desc(v: dict | None) -> str:
    if not v:
        return "no visualization"
    t = v.get("type", "")
    p = v.get("params", {})
    if t == "function_plot":
        return f"function_plot of `{p.get('expr','')}` on [{p.get('xmin')}, {p.get('xmax')}]"
    if t == "parametric_curve":
        return f"parametric_curve x={p.get('x','')}, y={p.get('y','')} t∈[{p.get('tmin')},{p.get('tmax')}]"
    if t == "unit_circle":
        return f"unit_circle, real={p.get('real','')}, imag={p.get('imag','')}"
    if t == "scalar":
        return f"scalar sequence value={p.get('value','')}"
    if t == "spiral_sum":
        return f"spiral_sum term_real={p.get('term_real','')}, term_imag={p.get('term_imag','')}"
    if t == "complex_point":
        return f"complex_point real={p.get('real','')}, imag={p.get('imag','')}"
    return t


@router.post("/chat")
async def chat(payload: ChatRequest):
    user_message = payload.message.strip()
    if not user_message:
        return {"ok": False, "error": "Empty message."}

    analysis  = payload.analysis_data
    lang      = payload.lang
    lang_name = "Swedish" if lang == "sv" else "English"

    parts_text = "\n".join(
        f"  {i+1}. ${p['latex']}$ — "
        f"{p.get('name', {}).get(lang, '')} "
        f"({p.get('category', {}).get(lang, '') if isinstance(p.get('category'), dict) else p.get('category', '')}) "
        f"| viz: {_viz_desc(p.get('viz'))}"
        for i, p in enumerate(analysis.get("parts", []))
    )

    system = f"""You are a helpful math tutor. A student has submitted a mathematical expression for analysis and wants to ask follow-up questions.

Expression (LaTeX): {analysis.get('latex', '')}
Summary: {analysis.get('summary', {}).get(lang, '')}
Intuition: {analysis.get('intuition', {}).get(lang, '')}
Main visualization: {_viz_desc(analysis.get('main_viz'))}
Sub-expressions (with their visualizations):
{parts_text}

IMPORTANT: Always reply in {lang_name}.
Be concise but thorough. Use $...$ for inline math and $$...$$ for display math. Do not use markdown headings (###) or bullet formatting — write in plain prose."""

    messages = [
        {"role": h["role"], "content": h["content"]}
        for h in payload.history[-10:]
        if h.get("role") in ("user", "assistant") and h.get("content")
    ]
    messages.append({"role": "user", "content": user_message})

    try:
        reply = await call_text(system, messages, stage="chat")
    except Exception as e:
        traceback.print_exc()
        return {"ok": False, "error": f"Could not generate reply: {e}"}

    return {"ok": True, "reply": reply}
