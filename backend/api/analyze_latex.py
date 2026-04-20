import asyncio
import json
import traceback
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.equation_extractor import extract_stage1_text, extract_stage2_a, extract_stage2_b, extract_stage2_c, ExtractionError
from core.color_registry import assign_colors
from core.visualization_engine import build_slider_config
from api.analyze import _log, _order_parts, _sse

router = APIRouter()


class AnalyzeLatexRequest(BaseModel):
    latex: str


@router.post("/analyze-latex")
async def analyze_latex(payload: AnalyzeLatexRequest):
    latex = payload.latex.strip()

    async def generate():
        if not latex:
            yield _sse({"ok": False, "error": "No LaTeX provided."})
            return

        try:
            s1 = await extract_stage1_text(latex)
        except ExtractionError as e:
            _log({"ok": False, "error": str(e)})
            yield _sse({"ok": False, "error": str(e)})
            return
        except Exception as e:
            traceback.print_exc()
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
