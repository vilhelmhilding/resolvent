"""Tests for the equation extractor — JSON parsing and repair logic."""
import pytest
import json
from core.equation_extractor import _parse, _fix_json_escapes, _sanitize_latex, ExtractionError


# ── _parse: clean JSON ────────────────────────────────────────────────────────

def test_parse_clean_json():
    raw = '{"ok": true, "latex": "x^2"}'
    result = _parse(raw, "test")
    assert result == {"ok": True, "latex": "x^2"}


def test_parse_strips_markdown_fences():
    raw = '```json\n{"ok": true, "latex": "x^2"}\n```'
    result = _parse(raw, "test")
    assert result["ok"] is True


def test_parse_strips_plain_fences():
    raw = '```\n{"ok": true}\n```'
    assert _parse(raw, "test") == {"ok": True}


def test_parse_finds_json_after_preamble():
    raw = 'Sure, here is the JSON:\n{"ok": true, "latex": "\\\\sin(x)"}'
    result = _parse(raw, "test")
    assert result["ok"] is True


def test_parse_extra_data_truncated():
    # Model outputs JSON and then keeps talking — only first object should be parsed
    raw = '{"ok": true, "latex": "x"} extra garbage here'
    result = _parse(raw, "test")
    assert result["ok"] is True
    assert result["latex"] == "x"


def test_parse_raises_on_garbage():
    with pytest.raises(ExtractionError, match="Invalid JSON"):
        _parse("this is not json at all", "test")


def test_parse_raises_on_empty_string():
    with pytest.raises(ExtractionError):
        _parse("", "test")


# ── _fix_json_escapes ─────────────────────────────────────────────────────────

def test_fix_json_escapes_passes_clean_string():
    clean = '{"key": "value"}'
    assert _fix_json_escapes(clean) == clean


def test_fix_json_escapes_handles_unescaped_backslash():
    broken = r'{"latex": "\int_0^\infty"}'
    fixed = _fix_json_escapes(broken)
    # Should be parseable after fix
    parsed = json.loads(fixed)
    assert "latex" in parsed


# ── _sanitize_latex ───────────────────────────────────────────────────────────

def test_sanitize_latex_fixes_double_exponent_limit():
    # \int_0^{-}^{\infty} → \int_{0^-}^{\infty}
    broken = r"\int_0^{-}^{\infty} f(x) dx"
    fixed = _sanitize_latex(broken)
    assert r"_{0^-}" in fixed
    assert r"_0^{-}^" not in fixed


def test_sanitize_latex_leaves_correct_latex_unchanged():
    correct = r"\int_{0^-}^{\infty} f(x) dx"
    assert _sanitize_latex(correct) == correct


def test_sanitize_latex_leaves_simple_integral_unchanged():
    expr = r"\int_0^1 x^2 dx"
    assert _sanitize_latex(expr) == expr
