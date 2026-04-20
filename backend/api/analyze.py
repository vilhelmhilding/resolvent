import asyncio
import base64
import json
import re
import traceback
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.equation_extractor import extract_stage1, extract_stage2_a, extract_stage2_b, extract_stage2_c, ExtractionError
from core.color_registry import assign_colors
from core.visualization_engine import build_slider_config

router = APIRouter()

_LOG = Path(__file__).parent.parent.parent / "analysis.log"


def _log(payload: dict) -> None:
    entry = {"time": datetime.now().isoformat(), **payload}
    with _LOG.open("a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


class AnalyzeRequest(BaseModel):
    image: str


def _order_parts(parts: list, full_latex: str) -> list:
    def sort_key(p: dict) -> int:
        idx = full_latex.find(p.get("latex", ""))
        return idx if idx >= 0 else len(full_latex)
    return sorted(parts, key=sort_key)


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/analyze")
async def analyze(payload: AnalyzeRequest):
    m = re.match(r"^data:(image/(?:png|jpe?g));base64,(.+)$", payload.image)
    media_type = m.group(1) if m else None
    if media_type == "image/jpg":
        media_type = "image/jpeg"

    async def generate():
        if not m:
            yield _sse({"ok": False, "error": "Invalid image data."})
            return
        try:
            image_bytes = base64.b64decode(m.group(2))
        except Exception:
            yield _sse({"ok": False, "error": "Could not decode image."})
            return

        try:
            s1 = await extract_stage1(image_bytes, media_type)
        except ExtractionError as e:
            _log({"ok": False, "error": str(e)})
            yield _sse({"ok": False, "error": str(e)})
            return
        except Exception as e:
            traceback.print_exc()
            _log({"ok": False, "error": f"Internal error: {e}"})
            yield _sse({"ok": False, "error": f"Internal error: {e}"})
            return

        yield _sse({"type": "identified", "latex": s1["latex"], "example": s1.get("example")})

        try:
            s2a = await extract_stage2_a(s1)
        except ExtractionError as e:
            _log({"ok": False, "error": str(e)})
            yield _sse({"ok": False, "error": str(e)})
            return
        except Exception as e:
            traceback.print_exc()
            _log({"ok": False, "error": f"Internal error: {e}"})
            yield _sse({"ok": False, "error": f"Internal error: {e}"})
            return

        sliders_partial = build_slider_config({**s2a, "parts": []})
        yield _sse({
            "type":      "main_viz_ready",
            "summary":   s2a["summary"],
            "intuition": s2a["intuition"],
            "example":   s2a.get("example"),
            "main_viz":  s2a["main_viz"],
            "sliders":   sliders_partial,
        })

        stage_results = await asyncio.gather(
            extract_stage2_b(s1, s2a),
            extract_stage2_c(s1, s2a),
            return_exceptions=True,
        )
        s2b_result, s2c_result = stage_results

        if isinstance(s2b_result, Exception):
            e = s2b_result
            _log({"ok": False, "error": str(e)})
            yield _sse({"ok": False, "error": str(e)})
            return

        s2b = s2b_result
        if isinstance(s2c_result, Exception):
            traceback.print_exc()
            _log({"warning": "stage2c failed", "error": str(s2c_result)})
            s2c = {"steps": []}
        else:
            s2c = s2c_result

        analysis = {**s2a, "parts": s2b["parts"]}
        analysis["parts"] = _order_parts(analysis["parts"], analysis["latex"])
        assign_colors(analysis["parts"])
        sliders = build_slider_config(analysis)

        result = {
            "ok": True,
            "analysis": {
                "latex":     analysis["latex"],
                "summary":   analysis.get("summary", {}),
                "intuition": analysis.get("intuition", {}),
                "example":   analysis.get("example"),
                "main_viz":  analysis.get("main_viz"),
                "steps":     s2c.get("steps", []),
                "parts": [
                    {
                        "latex":            p["latex"],
                        "category":         p.get("category", {}),
                        "name":             p.get("name", {}),
                        "explanation":      p.get("explanation", {}),
                        "insight":          p.get("insight", {}),
                        "animation_effect": p.get("animation_effect", {}),
                        "viz":              p.get("viz"),
                        "color":            p.get("color", ""),
                    }
                    for p in analysis["parts"]
                ],
            },
            "sliders": sliders,
        }
        _log(result)
        yield _sse({"type": "complete", **result})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
