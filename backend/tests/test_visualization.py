"""Tests for the visualization engine — slider detection and configuration."""
import pytest
from core.visualization_engine import detect_variables, build_slider_config


def make_analysis(main_viz=None, parts=None, anim_var=None):
    return {
        "latex": "expr",
        "anim_var": anim_var,
        "main_viz": main_viz,
        "parts": parts or [],
    }


# ── detect_variables ──────────────────────────────────────────────────────────

def test_detects_k_in_main_viz():
    analysis = make_analysis(main_viz={"type": "scalar", "params": {"value": "1/k"}})
    assert "k" in detect_variables(analysis)


def test_detects_t_in_function_plot():
    analysis = make_analysis(main_viz={"type": "function_plot", "params": {"expr": "sin(x + t)"}})
    assert "t" in detect_variables(analysis)


def test_parametric_curve_t_not_detected_as_animation():
    # t in parametric_curve is the curve parameter, not an animation variable
    analysis = make_analysis(main_viz={"type": "parametric_curve", "params": {"x": "cos(t)", "y": "sin(t)"}})
    assert "t" not in detect_variables(analysis)


def test_k_normalization_idiom_not_false_positive():
    # "k*0+5" should not register as k being an animation variable
    analysis = make_analysis(main_viz={"type": "function_plot", "params": {"expr": "k*0+5"}})
    assert "k" not in detect_variables(analysis)


def test_detects_variables_in_parts():
    analysis = make_analysis(
        main_viz={"type": "function_plot", "params": {"expr": "x"}},
        parts=[{"viz": {"type": "scalar", "params": {"value": "1/k"}}}],
    )
    assert "k" in detect_variables(analysis)


def test_detects_nothing_for_static_expression():
    analysis = make_analysis(main_viz={"type": "complex_point", "params": {"real": "0.5", "imag": "0.866"}})
    assert detect_variables(analysis) == []


# ── build_slider_config ───────────────────────────────────────────────────────

def test_k_slider_defaults():
    analysis = make_analysis(
        main_viz={"type": "scalar", "params": {"value": "1/k"}},
        anim_var="k",
    )
    sliders = build_slider_config(analysis)
    assert len(sliders) == 1
    s = sliders[0]
    assert s["name"] == "k"
    assert s["min"] == 1
    assert s["max"] == 30
    assert s["step"] == 1


def test_t_slider_uses_tmax_from_main_viz():
    analysis = make_analysis(
        main_viz={"type": "function_plot", "params": {"expr": "sin(x + t)", "tmin": 0, "tmax": 6.28}},
        anim_var="t",
    )
    sliders = build_slider_config(analysis)
    assert len(sliders) == 1
    s = sliders[0]
    assert s["name"] == "t"
    assert abs(s["max"] - 6.28) < 0.01


def test_anim_var_k_strips_stray_t():
    # When anim_var=k, any t in viz is a model error and must be stripped
    analysis = make_analysis(
        main_viz={"type": "function_plot", "params": {"expr": "sin(t + k)"}},
        anim_var="k",
    )
    sliders = build_slider_config(analysis)
    names = [s["name"] for s in sliders]
    assert "t" not in names
    assert "k" in names


def test_no_sliders_for_static_expression():
    analysis = make_analysis(
        main_viz={"type": "function_plot", "params": {"expr": "sin(x)"}},
    )
    sliders = build_slider_config(analysis)
    assert sliders == []
