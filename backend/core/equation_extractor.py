"""Three-stage extraction pipeline.

Stage 1  (image call):  LaTeX + example + anim_var + bare part list  (~300 tokens output)
Stage 2a (text call):   summary / intuition / main_viz               (~500 tokens output)
Stage 2b (text call):   all parts — receives main_viz for consistency (~2000 tokens output)

2a and 2b run sequentially so 2b knows what formula main_viz chose, but the backend
streams a 'main_viz_ready' SSE event as soon as 2a finishes so the canvas renders
~4 s before parts arrive.
"""
import asyncio
import json
import math as _math
import re

from core.anthropic_client import call_with_image, call_text


# ── Stage 1 (text-only) prompt ────────────────────────────────────────────────
_PROMPT_S1_TEXT = r"""CRITICAL INSTRUCTION: Respond with ONLY a JSON object. No preamble. Your very first character must be `{`.

LANGUAGE RULE — MANDATORY: "en" fields must be entirely in English. "sv" fields must be entirely in Swedish. No mixing.

You receive a mathematical expression as LaTeX. Prepare it for educational visualization.

IDEALIZATION: For abstract/general expressions ALWAYS choose the standard textbook example that most clearly reveals the concept. Set "example" listing EVERY chosen value with $...$-wrapped math. Only "example":null for fully concrete expressions.

Canonical choices:
- Fourier series with unknown c_k (any form): ALWAYS use the square wave. c_k = 2/(iπk) for odd k, 0 for even k; Ω=2π. Example: "$f(t) = \text{square wave}$, $c_k = \frac{2}{i\pi k}$ (odd $k$), $\Omega = 2\pi$"
- Abstract wavefunction ψ: use $\psi(x) = e^{-x^2/2}\cos(3x)$
- Abstract Fourier/Laplace transform (f or g unknown): use $f(x) = e^{-x^2/2}\cos(5x)$ (Gaussian wavepacket)
- Abstract operator on function: choose the most revealing concrete function
- Unknown parameters (m, ω, λ, a): choose the simplest non-trivial value (1, 2, π, etc.)

"anim_var": choose the PRIMARY animation that best reveals the expression's nature:
- "k" for any series or sum written as Σ over k/n (Fourier series, Taylor series, power series, partial sums)
- "t" for pure time evolution equations (wave equation, heat equation, PDE solutions, f(x,t))
- null only if the expression is fully static (no natural animation exists)

PARTS — identify 3–10 leaf-level sub-expressions (atoms, not compound + its constituents):
- latex must be a verbatim substring of the input latex
- PRIORITIZE: main functions/fields, key composite terms, physically/mathematically meaningful quantities, constants with meaning (π, ħ, i)
- Skip: operators (H, L, ∇², ∂/∂x, d/dt), differentials (dx, dt), integral/sum symbols (∫, ∑), standalone bounds/indices, bare numeric constants, the LHS/solution function

Return ONLY this JSON (no fences):
{"example":{"sv":"<Swedish listing>","en":"<English listing>"},"anim_var":null,"parts":[{"latex":"<verbatim>"}]}
For fully concrete expressions use "example":null."""


# ── Stage 1 prompt ────────────────────────────────────────────────────────────
_PROMPT_S1 = r"""Extract the central math expression from this image. Handle ANY area of mathematics. Transcribe EXACTLY what is written — same variable names, same symbols, no renaming.

LANGUAGE RULE — MANDATORY: "en" fields must be entirely in English. "sv" fields must be entirely in Swedish. No mixing.

OCR WARNINGS — distinguish carefully:
- \pi (pi symbol) vs n or \eta or \nu — \pi has a distinctive two-legged arch
- \mu vs u, \nu vs v, \alpha vs a, \omega vs w
- \infty (figure-eight on its side) vs oo
- Limits like 0^- or 0^+ MUST use braces: \int_{0^-}^{\infty} NOT \int_0^{-}^{\infty}

IDEALIZATION: For abstract/general expressions ALWAYS choose the standard textbook example that most clearly reveals the concept. Set "example" listing EVERY chosen value with $...$-wrapped math. Only "example":null for fully concrete expressions.

Canonical choices:
- Fourier series with unknown c_k (any form: Σc_k e^{ikΩt}, Σ(a_n cos+b_n sin), etc.): ALWAYS use the square wave. c_k = 2/(iπk) for odd k, 0 for even k; a_n=0, b_n=4/(nπ) for odd n; Ω=2π. Example: "$f(t) = \text{square wave}$, $c_k = \frac{2}{i\pi k}$ (odd $k$), $0$ (even $k$), $\Omega = 2\pi$"
- Abstract wavefunction ψ: use $\psi(x) = e^{-x^2/2}\cos(3x)$
- Abstract Fourier/Laplace transform (f or g unknown): use $f(x) = e^{-x^2/2}\cos(5x)$ (Gaussian wavepacket)
- Abstract operator on function: choose the most revealing concrete function
- Unknown parameters (m, ω, λ, a): choose the simplest non-trivial value (1, 2, π, etc.)

"anim_var": choose the PRIMARY animation that best reveals the expression's nature:
- "k" for any series or sum written as Σ over k/n (Fourier series, Taylor series, power series, partial sums) — even if t also appears in the terms. The build-up of partial sums IS the story.
- "t" for pure time evolution equations (wave equation, heat equation, PDE solutions, f(x,t) where adding more modes is NOT the point)
- null only if the expression is fully static (no natural animation exists)

PARTS — identify 3–10 leaf-level sub-expressions (atoms, not compound + its constituents):
- latex must be a verbatim substring of the full latex
- PRIORITIZE: main functions/fields in the integrand or body (ψ, f, φ, A, …), key composite terms, physically/mathematically meaningful quantities, constants with meaning (π, ħ, i)
- DEPRIORITIZE: boundary terms, operators acting on functions without standalone meaning
- Skip: operators (H, L, ∇², ∂/∂x, d/dt), differentials (dx, dt, d³r), integral/sum symbols (∫, ∑), standalone bounds/indices, bare numeric constants (2, 6…), the LHS/solution function (x(t), y(x), f(x), φ(t) — the thing being solved for)

Return ONLY this JSON (no fences, no extra text):
{"ok":true,"latex":"<LaTeX>","example":{"sv":"<Swedish listing>","en":"<English listing>"},"anim_var":null,"parts":[{"latex":"<verbatim>"}]}
For fully concrete expressions use "example":null instead of the object.
If no clear math: {"ok":false,"error":"<reason>"}"""


# ── Stage 2a system prompt (summary + main_viz) ───────────────────────────────
_SYSTEM_S2A = r"""CRITICAL INSTRUCTION: Respond with ONLY a JSON object. No preamble, no reasoning, no markdown. Your very first character must be `{`.

LANGUAGE RULE — MANDATORY: Every JSON field keyed "en" must be written entirely in English. Every field keyed "sv" must be written entirely in Swedish. No mixing. No Swedish words in "en" fields. No English words in "sv" fields. Mathematical symbols ($...$) are language-neutral and exempt.

You analyze a mathematical expression and produce its summary, intuition, and main educational visualization.

You receive:
- Expression: the LaTeX formula
- Example: the concrete idealization — use these EXACT values in ALL viz (never substitute your own)
- Animation variable: "t" (time/temporal), "k" (discrete growing index), or none

In all text fields (summary, intuition): wrap every mathematical symbol in $...$. Plain prose words must NOT be wrapped.

VIZ TYPES:
- function_plot: params {"expr":"JS","xmin":n,"xmax":n,"tmin":n,"tmax":n,"ymin":n,"ymax":n}  All params except expr/xmin/xmax are optional. x is ALWAYS the horizontal axis. Use t only as a SECOND variable for animation. When expr uses t: include tmin/tmax. For POLES/SINGULARITIES/ASYMPTOTES: ALWAYS set ymin/ymax to show the interesting range (e.g. ymin=-3, ymax=3) — without this, poles dominate auto-range and compress smooth regions to a flat line. For well-behaved functions: omit ymin/ymax.
- scalar: params {"value":"JS in k"}  for k-indexed sequences or constants (constant: "k*0+<value>")
- spiral_sum: params {"term_real":"JS in k","term_imag":"JS in k"}
- unit_circle: params {"real":"JS in k","imag":"JS in k"}  The sweep variable is ALWAYS `k` (k=1..30) — NEVER the expression's own variables (x, ξ, t, n, ω, etc.). Translate the rotation angle to k. NEVER use t here.
- complex_point: params {"real":"JS in k","imag":"JS in k"}  ALWAYS use k. For i: real="0", imag="1".
- parametric_curve: params {"x":"JS in t","y":"JS in t","tmin":n,"tmax":n}  always static. For |z|=r: x="r*cos(t)", y="r*sin(t)", tmin=0, tmax=6.2832.

DOMAIN RULES (function_plot xmin/xmax):
  sin/cos without PI: -6.28 to 6.28 | sin(PI*x)/cos(PI*x) or poles at integers: -2.5 to 2.5
  exp(x): -3 to 3 | log(x)/sqrt(x): 0.01 to 5 | polynomial or rational: -3 to 3 | default: -5 to 5

MAIN_VIZ — use null ONLY when the expression is a purely abstract vector/tensor identity, a conservation law with no concrete computable formula, or a structural equation where every term is an abstract symbol with no known value. For everything else, choose a meaningful visualization. Do NOT use scalar "k*0+1" as a placeholder — if nothing is plottable, use null.
SERIES RULE: If the expression IS a series (Σ over k/n), the main_viz is ALWAYS a function_plot showing partial sum convergence (rule 6), even if the terms are complex exponentials. spiral_sum is NEVER the main_viz for a function series — it belongs in sub-parts only.
ANIMATION: If anim_var is "t" or "k", main_viz MUST include that variable so it animates.
1. Concrete real function of x → function_plot with the exact formula. Time-dependent → include t.
2. Contour on |z|=r → parametric_curve (tmin=0, tmax=6.2832)
3. Concrete real series → scalar; complex series → spiral_sum
4. Concrete complex number → complex_point
5. PDE/time-evolution (Schrödinger, wave, heat, diffusion) → function_plot with x and t, ALWAYS set tmin/tmax so motion stays within [xmin,xmax]. wave: "sin(x-t)+0.5*sin(2*x-2*t)", xmin=-6.28,xmax=6.28,tmin=0,tmax=6.28; heat: "exp(-x*x/(0.5+t))", xmin=-5,xmax=5,tmin=0.01,tmax=4; Schrödinger wavepacket: "exp(-(x-t)*(x-t)/(1+0.1*t*t))*cos(5*(x-t))", xmin=-8,xmax=8,tmin=-6,tmax=6
6. ANY SERIES CONVERGING TO A FUNCTION (Fourier, Taylor, power, binomial, etc.) → function_plot with partial sum growing with k, showing convergence. Always use `x` as the horizontal axis argument. Examples:
   - Square-wave Fourier (standard for abstract Fourier series): "var s=0; for(var i=1;i<=k;i+=2) s+=sin(i*2*PI*x)/i; s*4/PI", xmin=-1, xmax=1
   - Complex Fourier g(t)=Σc_k e^{ikΩt}: show REAL PART using the square-wave idealization: "var s=0; for(var i=1;i<=k;i+=2) s+=sin(i*2*PI*x)/i; s*4/PI", xmin=-1, xmax=1
   - Fourier series in x (e.g. f(x)=Σ sin/cos): adapt the loop to the actual terms, xmin=-6.28, xmax=6.28
   - Taylor exp: "var s=0; for(var i=0;i<=k;i++) s+=pow(x,i)/factorial(i); s", xmin=-3, xmax=3
   - Taylor cos: "var s=0; for(var i=0;i<=k;i++) s+=pow(-1,i)*pow(x,2*i)/factorial(2*i); s", xmin=-6.28, xmax=6.28
   CRITICAL: `x` is always the function argument (never `t`). `k` is the partial sum cutoff. The curve must change as k increases — if k is not in the expression, the build-up is broken.
7. Pure numeric convergent series (no x-dependence, just numbers) → spiral_sum if complex (term_real="cos(k)/k", term_imag="sin(k)/k") or scalar if real (value="1/(k*k)")
8. Complex expression/kernel → unit_circle if bounded rotation, complex_point if single value
9. Fourier/Laplace transform → if the equation involves time: function_plot with a propagating wavepacket: "exp(-(x-t)*(x-t)/(1+0.1*t*t))*cos(5*(x-t))", xmin=-8,xmax=8,tmin=-6,tmax=6. If purely static (no time variable): function_plot with the concrete example function, e.g. "exp(-x*x/2)*cos(5*x)", xmin=-5,xmax=5.
10. Eigenvalue/spectral → function_plot with representative eigenfunction (e.g. "sin(3*x)")
11. Probability formula → scalar showing concrete calculation building over k scenarios
12. Linear algebra → function_plot of geometric effect or scalar (dot product)
13. Combinatorics/discrete → scalar using factorial(n) or gamma(n+1)
14. Abstract → function_plot with most natural concrete representative from the example

JS: sin, cos, tan, exp, log, sqrt, abs, pow, PI, E, floor, ceil, round, min, max, factorial, gamma. With or without "Math." prefix. Multi-statement: semicolons, last expression is the return value.

Return ONLY this JSON (no fences):
{"summary":{"sv":"<1 sentence>","en":"<1 sentence>"},"intuition":{"sv":"<2-3 sentences>","en":"<2-3 sentences>"},"main_viz":{"type":"<type>","params":{...}}}"""


# ── Stage 2b system prompt (parts analysis) ───────────────────────────────────
_SYSTEM_S2B = r"""CRITICAL INSTRUCTION: Respond with ONLY a JSON object. No preamble, no reasoning, no markdown. Your very first character must be `{`.

LANGUAGE RULE — MANDATORY: Every JSON field keyed "en" must be written entirely in English. Every field keyed "sv" must be written entirely in Swedish. No mixing. No Swedish words in "en" fields. No English words in "sv" fields. Mathematical symbols ($...$) are language-neutral and exempt.

You analyze sub-expressions of a mathematical formula to produce educational visualizations for each part.

You receive:
- Expression: the full LaTeX formula
- Example: the concrete idealization — use these EXACT values (never substitute your own)
- Animation variable: "t" (time/temporal), "k" (discrete growing index), or none
- Main viz: the visualization already chosen for the whole expression — use the SAME idealization (same formula, same parameter values) in all parts
- Parts: ordered list of sub-expression LaTeX strings to analyze

In all text fields (names, explanations): wrap every mathematical symbol in $...$. Plain prose words must NOT be wrapped.

VIZ TYPES:
- function_plot: params {"expr":"JS","xmin":n,"xmax":n,"tmin":n,"tmax":n,"ymin":n,"ymax":n}  All params except expr/xmin/xmax are optional. x is ALWAYS the horizontal axis. Use t only as a SECOND variable for animation. When expr uses t: include tmin/tmax. For POLES/SINGULARITIES/ASYMPTOTES: ALWAYS set ymin/ymax.
- scalar: params {"value":"JS in k"}  for k-indexed sequences or constants (constant: "k*0+<value>")
- spiral_sum: params {"term_real":"JS in k","term_imag":"JS in k"}
- unit_circle: params {"real":"JS in k","imag":"JS in k"}  The sweep variable is ALWAYS `k` (k=1..30) — NEVER the expression's own variables (x, ξ, t, n, ω, etc.). Translate the rotation angle to k. NEVER use t here.
- complex_point: params {"real":"JS in k","imag":"JS in k"}  ALWAYS use k. For i: real="0", imag="1".
- parametric_curve: params {"x":"JS in t","y":"JS in t","tmin":n,"tmax":n}  always static.

PARTS — analyze each sub-expression from the input list IN ORDER (output array must match input order exactly):
- category: mathematical category in CAPS (bilingual, e.g. sv:"FUNKTION" en:"FUNCTION")
- name: short descriptive name, 3–6 words
- explanation: 1–2 sentences on its mathematical role
- viz: visualization or null

CONSISTENCY RULE: All parts use the SAME idealized parameter values as main_viz (same c_k formula, same Ω, same concrete numbers). This means SAME VALUES, NOT SAME VIZ TYPE. A single-mode term u_k(t)=c_k·e^{ikΩt} is a phasor (unit_circle), even if main_viz is a function_plot of the full series — do NOT copy the series loop formula to a single-mode sub-part.
- If anim_var="t": every time-dependent sub-part MUST include t in its viz expr
- If anim_var="k": every k-dependent sub-part MUST use scalar (NOT function_plot for k-indexed quantities)
- A sub-part rendered as static when the quantity actually varies is WRONG

DECISION for viz — ask: "Does this sub-expression have a concrete plottable shape, value, or trajectory?"
viz ≠ null (PLOT): functions with concrete formulas (ψ(x,t), sin(kx), e^{-x²}), numeric constants (π, ħ, i), k-indexed sequences (aₖ=1/k²), concrete terms from the idealization
viz = null (TEXT ONLY): differential operators acting on functions (H, L, ∇², ∂/∂x, d/dt, Â), independent variables of the equation (t, x, r, θ), differentials/measures (dx, dt, d³r), integral/sum symbols (∫, ∑), bounds/indices/notation
IMPORTANT EXCEPTION: complex exponential kernels like e^{iθ} or e^{-ip·r/ħ} are NEVER operators — they are plottable rotating phasors. ALWAYS give them unit_circle viz (real="cos(k*PI/10)", imag="-sin(k*PI/10)"), even if labeled "kernel" or "phase factor".

Concrete viz rules when viz ≠ null:
- k-indexed sequence (anim_var="k" and sub-expr depends on k) → scalar, NEVER function_plot
- single rotating phasor / mode (e.g. c_k·e^{ikΩt}, u_k(t), a_k·e^{iθ_k}) → unit_circle. This applies even if main_viz is function_plot — a single mode is a phasor, NOT a function_plot with the series loop. NEVER spiral_sum for a single mode.
- complex exponential e^{±iθ} or phase-factor kernel → unit_circle. SIGN RULE: e^{+iθ} rotates counterclockwise → imag="+sin(θ)". e^{-iθ} rotates clockwise → imag="-sin(θ)". Read the sign directly from the exponent. Example: e^{+ikΩt} → real="cos(k*PI/5)", imag="+sin(k*PI/5)". e^{-ikΩt} → real="cos(k*PI/5)", imag="-sin(k*PI/5)". NEVER parametric_curve. NEVER viz=null.
- accumulation of many complex terms (partial sum of series) → spiral_sum
- numeric complex (i, 1+2i) → complex_point with exact values
- real constant (π, e, φ, √2, physical constants, abstract parameters) → viz=null. Constants have no shape to plot; their value is clear from the explanation text.
- abstract function (ψ, f, φ) → function_plot with the concrete example value
- function of x only → function_plot, x as horizontal axis. NEVER k or t as horizontal axis.
- POLES/SINGULARITIES → ALWAYS set ymin/ymax

INSIGHT — for each part, state the KEY mathematical insight: the non-obvious property, role, or behavior that makes this sub-expression significant. NOT a repeat of the explanation. 1 sentence. Example: "The $1/k$ decay ensures convergence — without it, partial sums would grow without bound."

ANIMATION_EFFECT — if anim_var is "k" or "t": describe concretely and specifically what changes in the visualization as the variable advances. Tie it to what the viewer actually sees. Example: "As $k$ increases, each new odd harmonic is added, visibly sharpening the corners of the square-wave approximation." If the sub-expression is not animated (anim_var=none, or this part does not vary with the anim variable): {"sv":"","en":""}.

JS: sin, cos, tan, exp, log, sqrt, abs, pow, PI, E, floor, ceil, round, min, max, factorial, gamma. With or without "Math." prefix. Multi-statement: semicolons, last expression is the return value.

Return ONLY this JSON (no fences):
{"parts":[{"category":{"sv":"<CAPS>","en":"<CAPS>"},"name":{"sv":"<name>","en":"<name>"},"explanation":{"sv":"<1-2 sentences>","en":"<1-2 sentences>"},"insight":{"sv":"<1 sentence>","en":"<1 sentence>"},"animation_effect":{"sv":"<1 sentence or empty>","en":"<1 sentence or empty>"},"viz":<viz_or_null>}]}"""


# ── Stage 2c system prompt (derivation steps) ────────────────────────────────
_SYSTEM_S2C = r"""CRITICAL INSTRUCTION: Respond with ONLY a JSON object. No preamble, no reasoning, no markdown. Your very first character must be `{`.

LANGUAGE RULE — MANDATORY: Every JSON field keyed "en" must be written entirely in English. Every field keyed "sv" must be written entirely in Swedish. No mixing. No Swedish words in "en" fields. No English words in "sv" fields. Mathematical symbols ($...$) are language-neutral and exempt.

You generate 3–6 step-by-step derivation/expansion steps for a mathematical expression shown to a student.

MANDATORY: You MUST always return at least 3 steps. Never return an empty steps array. Every mathematical expression — no matter how simple — has a derivation, expansion, definition, or worked example that can be shown step by step. If the expression is a bare constant or trivial, show its definition, properties, and a worked application.

You receive:
- Expression: the full LaTeX formula
- Example: the concrete idealization used for visualization (if any)

Each step is one clean LaTeX line (a transformation, substitution, or expansion) plus a 1-sentence bilingual note explaining WHAT was done.

SOLUTION RULE — MANDATORY: If the expression admits a concrete solution or closed-form result (integral with numeric bounds, ODE with initial conditions, eigenvalue problem, algebraic equation, summable series, evaluatable limit, etc.), the FINAL step MUST be that exact solution — a single clean LaTeX line with the numerical or symbolic answer. No exceptions. If the example idealization produces a concrete number or formula, show it. "Cannot be solved" is only acceptable for abstract structural equations where every term is a symbol with no known value.

Focus by type:
- Series (Fourier, Taylor, power): (1) write the general term, (2) apply example values to get concrete coefficients, (3) expand first 3–4 terms explicitly, (4) final: closed-form sum or convergence result
- Transforms (Fourier, Laplace, Z): (1) write the definition integral, (2) substitute example function, (3) key simplification step, (4) final: explicit transform result
- ODEs/PDEs: (1) write general form, (2) separation of variables or ansatz, (3) characteristic equation/eigenvalues, (4) general solution, (5) final: particular solution if initial conditions given
- Integrals (definite): (1) identify method, (2) antiderivative, (3) apply bounds, (4) final: exact numerical value
- Integrals (indefinite): (1) identify method, (2) key step, (3) final: antiderivative + C
- Eigenvalue/spectral: (1) eigenvalue equation, (2) apply to example eigenfunction, (3) final: explicit eigenvalue
- Algebraic/limit: (1) set up, (2–3) key steps, (4) final: exact value
- Abstract/structural: (1) full definition, (2) concrete instantiation, (3) physical/geometric meaning

In all LaTeX fields: write correct LaTeX (\\frac, \\sum, \\int, \\infty, \\hbar, etc.).
In all note text: wrap every mathematical symbol in $...$. Plain prose words must NOT be wrapped.

Return ONLY this JSON (no fences):
{"steps":[{"latex":"<LaTeX>","note":{"sv":"<1 sentence>","en":"<1 sentence>"}}]}"""


# ── Viz validator ─────────────────────────────────────────────────────────────
def _eval_simple_expr(expr: str, x: float, k: float = 15.0, t: float = 1.0):
    """Evaluate a simple JS math expression at a scalar x. Returns None if unevaluable."""
    if any(kw in expr for kw in ['var ', 'for(', 'for (', ';', 'factorial', 'gamma']):
        return None
    e = re.sub(r'\bMath\.', '', expr)
    safe = {
        '__builtins__': {},
        'sin': _math.sin, 'cos': _math.cos, 'tan': _math.tan,
        'exp': _math.exp, 'log': _math.log, 'sqrt': _math.sqrt,
        'abs': abs, 'pow': _math.pow,
        'floor': _math.floor, 'ceil': _math.ceil, 'round': round,
        'min': min, 'max': max,
        'PI': _math.pi, 'E': _math.e,
        'x': x, 'k': k, 't': t,
    }
    try:
        return float(eval(e, safe))
    except Exception:
        return None


def _validate_function_plot(viz: dict | None) -> bool:
    """Returns True if the viz looks valid (or can't be checked), False if clearly broken."""
    if not viz or viz.get('type') != 'function_plot':
        return True
    p = viz.get('params', {})
    expr = str(p.get('expr', ''))
    try:
        xmin = float(p.get('xmin', -5))
        xmax = float(p.get('xmax', 5))
    except (TypeError, ValueError):
        return True

    step = (xmax - xmin) / 39
    ys = []
    for i in range(40):
        v = _eval_simple_expr(expr, xmin + i * step)
        if v is not None and _math.isfinite(v):
            ys.append(v)

    if len(ys) < 8:
        return False  # Almost all NaN/Inf

    mean = sum(ys) / len(ys)
    variance = sum((y - mean) ** 2 for y in ys) / len(ys)
    return variance > 1e-10  # False = flat constant line (broken expression)


# ── Helpers ───────────────────────────────────────────────────────────────────
class ExtractionError(Exception):
    pass


def _fix_json_escapes(raw: str) -> str:
    """Escape bare LaTeX backslashes (e.g. \\pi) inside JSON string values."""
    out, i, n, in_str = [], 0, len(raw), False
    while i < n:
        ch = raw[i]
        if not in_str:
            out.append(ch)
            if ch == '"': in_str = True
            i += 1
        elif ch == '\\':
            nch = raw[i + 1] if i + 1 < n else ''
            if nch in '"\\\\/bfnrt':
                out.append(ch); out.append(nch); i += 2
            elif nch == 'u' and i + 5 < n and all(c in '0123456789abcdefABCDEF' for c in raw[i + 2:i + 6]):
                out.append(ch); out.append(nch); i += 2
            else:
                out.append('\\\\'); i += 1
        elif ch == '"':
            out.append(ch); in_str = False; i += 1
        else:
            out.append(ch); i += 1
    return ''.join(out)


def _parse(raw: str, label: str) -> dict:
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.MULTILINE).strip()

    def _try(s: str) -> dict | None:
        try:
            return json.loads(s)
        except json.JSONDecodeError as e:
            if 'Extra data' in str(e) and e.pos:
                try:
                    return json.loads(s[:e.pos])
                except json.JSONDecodeError:
                    pass
        return None

    for attempt in (cleaned, _fix_json_escapes(cleaned)):
        result = _try(attempt)
        if result is not None:
            return result

    # Fallback: model prepended reasoning text — find first '{' and retry
    brace = cleaned.find('{')
    if brace > 0:
        tail = cleaned[brace:]
        for attempt in (tail, _fix_json_escapes(tail)):
            result = _try(attempt)
            if result is not None:
                return result

    raise ExtractionError(f"Invalid JSON from {label}: could not parse response.\nRaw: {raw[:300]}")


def _user(text: str) -> list:
    return [{"role": "user", "content": text}]


def _sanitize_latex(latex: str) -> str:
    # Fix double-exponent from mis-transcribed limits like \int_0^{-}^{\infty}
    # → \int_{0^-}^{\infty}  (lower limit containing a superscript must use braces)
    return re.sub(r'_(\w+)\^\{([+-])\}(\^)', r'_{\1^\2}\3', latex)


# ── Stage 1 ───────────────────────────────────────────────────────────────────
async def _stage1(image_bytes: bytes, media_type: str) -> dict:
    raw = await call_with_image(image_bytes, media_type, _PROMPT_S1, max_tokens=1200, stage="stage1")
    data = _parse(raw, "stage1")
    if not data.get("ok"):
        raise ExtractionError(data.get("error", "No clear expression identified."))
    if not data.get("latex") or not data.get("parts"):
        raise ExtractionError("Incomplete stage1 response.")
    data["latex"] = _sanitize_latex(data["latex"])
    return data


# ── Stage 2a: summary + main_viz ──────────────────────────────────────────────
async def _stage2a(s1: dict) -> dict:
    latex    = s1["latex"]
    example  = s1.get("example")
    anim_var = s1.get("anim_var")

    base_msg = (
        f"Expression: {latex}\n"
        f"Example: {json.dumps(example) if example else 'null'}\n"
        f"Animation variable: {anim_var or 'none'}"
    )
    msg = base_msg
    for attempt in range(2):
        raw = await call_text(_SYSTEM_S2A, _user(msg), max_tokens=1500, stage="stage2a")
        data = _parse(raw, "stage2a")
        if not {"summary", "intuition", "main_viz"}.issubset(data):
            raise ExtractionError("Incomplete stage2a response.")
        if _validate_function_plot(data.get("main_viz")):
            return data
        if attempt == 0:
            msg = (
                base_msg
                + "\n\nWARNING: The previous function_plot expression evaluated to a "
                  "flat line or almost entirely NaN/Infinity. Please choose a correct, "
                  "non-trivial formula — or use null if nothing is genuinely plottable."
            )
    return data  # Return last attempt regardless


# ── Stage 2b: parts analysis ───────────────────────────────────────────────────
async def _stage2b(s1: dict, s2a: dict) -> dict:
    latex    = s1["latex"]
    example  = s1.get("example")
    anim_var = s1.get("anim_var")
    parts    = [p["latex"] for p in s1["parts"]]
    main_viz = s2a["main_viz"]

    msg = (
        f"Expression: {latex}\n"
        f"Example: {json.dumps(example) if example else 'null'}\n"
        f"Animation variable: {anim_var or 'none'}\n"
        f"Main viz chosen: {json.dumps(main_viz)}\n"
        f"Parts: {json.dumps(parts)}"
    )
    raw = await call_text(_SYSTEM_S2B, _user(msg), max_tokens=5000, stage="stage2b")
    data = _parse(raw, "stage2b")
    if "parts" not in data:
        raise ExtractionError("Incomplete stage2b response.")
    return data


# ── Stage 2c: derivation steps ────────────────────────────────────────────────
async def _stage2c(s1: dict, s2a: dict) -> dict:
    latex   = s1["latex"]
    example = s1.get("example")
    base_msg = (
        f"Expression: {latex}\n"
        f"Example: {json.dumps(example) if example else 'null'}"
    )
    msg = base_msg
    for attempt in range(2):
        raw = await call_text(_SYSTEM_S2C, _user(msg), max_tokens=2500, stage="stage2c")
        data = _parse(raw, "stage2c")
        if "steps" not in data:
            raise ExtractionError("Incomplete stage2c response.")
        if data["steps"]:
            return data
        if attempt == 0:
            msg = (
                base_msg
                + "\n\nWARNING: You returned an empty steps array. This is not allowed. "
                  "You MUST return at least 3 steps. Every expression has a derivation, "
                  "definition, or worked example. Please try again."
            )
    return data


# ── Public entry points ───────────────────────────────────────────────────────
async def extract_stage1(image_bytes: bytes, media_type: str) -> dict:
    return await _stage1(image_bytes, media_type)


async def extract_stage2_a(s1: dict) -> dict:
    """Returns {latex, summary, intuition, example, anim_var, main_viz}."""
    data = await _stage2a(s1)
    return {
        "latex":     s1["latex"],
        "example":   s1.get("example"),
        "anim_var":  s1.get("anim_var"),
        "summary":   data["summary"],
        "intuition": data["intuition"],
        "main_viz":  data["main_viz"],
    }


async def extract_stage2_b(s1: dict, s2a: dict) -> dict:
    """Returns {parts: [...]} with full part objects ready for the response."""
    part_lats  = [p["latex"] for p in s1["parts"]]
    data       = await _stage2b(s1, s2a)
    parts_data = data.get("parts", [])
    return {
        "parts": [
            {
                "latex":            pl,
                "category":         pd.get("category", {}),
                "name":             pd.get("name", {}),
                "explanation":      pd.get("explanation", {}),
                "insight":          pd.get("insight", {}),
                "animation_effect": pd.get("animation_effect", {}),
                "viz":              pd.get("viz"),
            }
            for pl, pd in zip(part_lats, parts_data)
        ]
    }


async def extract_stage2_c(s1: dict, s2a: dict) -> dict:
    """Returns {steps: [{latex, note}]} — derivation steps."""
    return await _stage2c(s1, s2a)


async def extract_stage1_text(latex: str) -> dict:
    """Text-only stage1: takes LaTeX directly, returns same structure as image stage1."""
    latex = _sanitize_latex(latex.strip())
    raw   = await call_text(_PROMPT_S1_TEXT, _user(f"Expression: {latex}"), max_tokens=800, stage="stage1_text")
    data  = _parse(raw, "stage1_text")
    if not data.get("parts"):
        raise ExtractionError("Could not identify sub-expressions.")
    return {
        "latex":    latex,
        "example":  data.get("example"),
        "anim_var": data.get("anim_var"),
        "parts":    data["parts"],
    }


