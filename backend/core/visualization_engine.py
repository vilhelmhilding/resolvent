# Copyright (c) 2026 Vilhelm Hilding. MIT License.
"""Builds animation slider configuration from analysis data."""
import re


def detect_variables(analysis: dict) -> list:
    found: set[str] = set()

    def scan(viz: dict | None) -> None:
        if not viz or not isinstance(viz, dict):
            return
        vtype = viz.get("type", "")
        blob = str(viz.get("params", {}))
        # Strip the constant-normalization idiom "k*0+<value>" before scanning for k
        blob_stripped = re.sub(r"\bk\s*\*\s*0\s*\+", "", blob)
        if re.search(r"\bk\b", blob_stripped):
            found.add("k")
        if vtype != "parametric_curve" and re.search(r"\bt\b", blob):
            found.add("t")

    scan(analysis.get("main_viz"))
    for part in analysis.get("parts", []):
        scan(part.get("viz"))
    return sorted(found)


def build_slider_config(analysis: dict) -> list:
    vars_used = detect_variables(analysis)

    # anim_var="k" means discrete series: any `t` found in viz expressions is a
    # model error (wrote t instead of x as spatial variable). Strip it.
    if analysis.get("anim_var") == "k":
        vars_used = [v for v in vars_used if v != "t"]

    defaults: dict[str, dict] = {
        "k": {"min": 1,  "max": 30, "default": 1,  "step": 1},
        "t": {"min": 0,  "max": 30, "default": 0,  "step": 0.1},
    }

    main_viz = analysis.get("main_viz") or {}
    mp = main_viz.get("params", {}) if isinstance(main_viz, dict) else {}
    if isinstance(mp, dict):
        if "tmax" in mp:
            tmax = float(mp["tmax"])
            defaults["t"]["max"] = round(tmax, 4)
            defaults["t"]["step"] = round(tmax / 60, 4)
        if "tmin" in mp:
            tmin = float(mp["tmin"])
            defaults["t"]["min"] = round(tmin, 4)
            defaults["t"]["default"] = round(tmin, 4)

        expr = str(mp.get("expr", ""))
        if (
            main_viz.get("type") == "function_plot"
            and re.search(r"\bt\b", expr)
            and not re.search(r"\bx\b", expr)
            and "xmin" in mp and "xmax" in mp
        ):
            t_lo = float(mp["xmin"])
            t_hi = float(mp["xmax"])
            defaults["t"]["min"] = round(t_lo, 4)
            defaults["t"]["max"] = round(t_hi, 4)
            defaults["t"]["default"] = round(t_lo, 4)
            defaults["t"]["step"] = round((t_hi - t_lo) / 60, 4)

    return [
        {"name": v, **defaults.get(v, {"min": 0, "max": 10, "default": 0, "step": 0.1})}
        for v in vars_used
    ]
