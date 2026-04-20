<p align="center">
  <img src="frontend/public/logo.svg" width="72" height="36" alt="Resolvent logo"/>
</p>

<h1 align="center">Resolvent</h1>

<p align="center">
  <a href="https://github.com/vilhelmhilding/resolvent/actions/workflows/test.yml"><img src="https://github.com/vilhelmhilding/resolvent/actions/workflows/test.yml/badge.svg" alt="Tests"/></a>
  <a href="https://github.com/vilhelmhilding/resolvent/actions/workflows/docker.yml"><img src="https://github.com/vilhelmhilding/resolvent/actions/workflows/docker.yml/badge.svg" alt="Docker Build"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"/></a>
  <img src="https://img.shields.io/badge/Python-3.11%2B-3776ab?logo=python&logoColor=white" alt="Python 3.11+"/>
  <img src="https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white" alt="Next.js 15"/>
  <img src="https://img.shields.io/badge/Claude-claude--sonnet--4--6-blueviolet?logo=anthropic&logoColor=white" alt="Claude"/>
</p>

<p align="center">Upload a photo of a mathematical expression. Get a structured, interactive breakdown — powered by Claude Vision.</p>

---

## Quick start

**Requirements:** [Docker Desktop](https://www.docker.com/products/docker-desktop) + an [Anthropic API key](https://console.anthropic.com/)

```bash
git clone https://github.com/vilhelmhilding/resolvent
cd resolvent
./setup.sh
```

The script asks for your API key, generates a secret, starts the containers, and opens `http://localhost:3000` in your browser. That's it.

---

Each sub-expression is identified, color-coded, individually visualized, and explained in plain language. A built-in AI tutor answers follow-up questions with full awareness of the analysis. Analyses can be saved to a personal dashboard and revisited with full chat context intact.

---

## What's new in v2

**Complete tech stack rewrite**

| | v1 | v2 |
|---|---|---|
| Backend | Flask (sync, 2 routes) | FastAPI (async, 9+ routes) |
| Frontend | Vanilla JS + Jinja2 HTML templates | Next.js 15, TypeScript (strict), React 19 |
| State management | Global JS object in `ui.js` | Zustand 5 |
| Rendering | Server-side HTML fragment (`html_renderer.py`) | Client-side React components |
| Styling | Single `styles.css` | Component CSS in `globals.css`, typed throughout |
| Canvas renderers | Monolithic functions in `ui.js` | Modular TypeScript modules per viz type |
| Package management | `requirements.txt` | `pyproject.toml` (hatchling, optional test extras) |
| Dev server | `python app.py` (port 5001) | `make dev` via pm2 (backend 8000, frontend 3000) |
| AI model | claude-sonnet-4-5 | claude-sonnet-4-6 |

**Analysis pipeline**
- **4-stage async streaming** — results stream to the client as each stage completes. The identified equation appears mid-load, before the full analysis is ready.
- **LaTeX input** — paste LaTeX directly instead of uploading a photo.
- **Step-by-step derivation** — collapsible breakdown with numbered LaTeX steps and bilingual notes.
- **Insight + animation effect per sub-expression** — each part now shows a key non-obvious mathematical insight and a concrete description of what visually changes during animation.
- **Prompt caching** — `cache_control: ephemeral` on all prompts reduces latency and cost.
- **Viz validation with auto-retry** — stage 2a automatically retries if the model returns an all-NaN or flat-constant expression.
- **OCR correction** — common transcription errors fixed automatically (`\int_0^{-}^{\infty}` → `\int_{0^-}^{\infty}`, etc.).
- **Robust JSON repair** — bare LaTeX backslashes escaped automatically; preamble text and trailing garbage tolerated.

**Accounts and dashboard**
- **User accounts** — register/login with bcrypt-hashed passwords and in-memory sessions (auto-expire on server restart).
- **Save and restore** — full analysis sessions including chat history saved to SQLite, accessible from a personal dashboard.
- **Auto-save** — chat history saved automatically 1.5 s after the last assistant message.
- **Encrypted storage** — blobs are gzip-compressed and AES-128 encrypted (Fernet) at rest. 30-day TTL.

**Infrastructure**
- **Docker Compose** — one command deploys the full stack (`docker compose up -d`) with a persistent SQLite volume, accessible from any device on the local network.
- **CI/CD** — GitHub Actions: full test suite + Docker build smoke test on every push and pull request.
- **90 automated tests** — 51 backend (pytest-asyncio) + 39 frontend (vitest).

**UI**
- **Infinity-symbol logo** — vectorized SVG logo next to the "Resolvent" wordmark, clickable to navigate home.
- **Mobile-first layout** — hamburger menu, sticky header, proportional canvas scaling via CSS `aspectRatio`, no scroll hijack during 3D drag, iOS input zoom fix.
- **Smooth auth modal** — page content blurs behind the login popup; spring-curve entry animation.
- **Progressive loading messages** — two sets of animated status messages (pre- and post-identification).

---

## What it does

1. **Upload** a photo of any mathematical expression — handwritten or printed — or paste LaTeX directly
2. **Crop** to the relevant region (image mode)
3. **Receive a full analysis:**
   - LaTeX rendering of the full expression
   - Plain-language summary, intuition, and (when applicable) an example box naming the concrete values chosen for the visualization
   - Each sub-expression labeled, color-coded, and explained
   - Interactive 2D and 3D canvas visualizations with a play button for real-time animation
   - Step-by-step derivation (collapsible)
   - An AI chat tutor that knows everything about the current analysis
4. **Save** analyses to your personal dashboard (requires account)
5. **Export:**
   - Full analysis as a PDF (via the browser print dialog)
   - Chat conversation as a `.txt` file

Handles any area of mathematics: calculus, complex analysis, PDEs, Fourier analysis, probability, statistics, linear algebra, combinatorics, number theory, and more.

---

## Demos

### Convergent series

![Convergent series](demos/demo1.gif)

### Fourier series

![Fourier series](demos/demo2.gif)

---

## How it works

### Analysis pipeline

Analysis proceeds in four async stages:

| Stage | What it does |
|---|---|
| Stage 1 | Claude Vision identifies the expression, extracts LaTeX, sub-parts, animation variable |
| Stage 2a | Produces summary, intuition, example, main visualization config |
| Stage 2b | Produces per-part names, explanations, insights, and per-part visualization configs |
| Stage 2c | Produces step-by-step derivation |

Stage 2b and 2c run in parallel via `asyncio.gather`. Intermediate results stream to the frontend via Server-Sent Events so the UI progressively reveals content as each stage completes.

### Idealization principle

For abstract or general expressions (e.g. a Fourier transform with no concrete input function), the model chooses a pedagogically ideal standard-case scenario — the classic textbook example that best reveals the phenomenon. All sub-part visualizations use the same chosen values so the entire page tells one consistent story. The example box under the intuition text names every chosen value.

### Visualization types

Each expression receives the most appropriate visualization, rendered on an HTML5 Canvas. All types have both a 2D and an interactive 3D view:

| Type | Used for | Animates via |
|---|---|---|
| `function_plot` | Real-valued functions of one or two variables | `t` (time), `k` (parameter) |
| `parametric_curve` | Contours and paths in the plane | static — `t` is the curve parameter |
| `unit_circle` | Rotating phasors, complex exponentials | `k` (discrete steps) |
| `scalar` | Real discrete sequences and partial sums | `k` |
| `spiral_sum` | Complex partial sums (Fourier, power series) | `k` |
| `complex_point` | Complex numbers and k-indexed complex trajectories | `k` |

### Accounts and dashboard

Users can create an account (username + password) and save full analysis sessions including chat history. Saved analyses are listed in a personal dashboard, and any saved session can be restored exactly — including all chat context.

- Passwords are bcrypt-hashed
- Analysis data is gzip-compressed and AES-128 encrypted (Fernet) before storage
- Sessions are in-memory only — restarting the server logs all users out automatically
- Saved analyses expire after 30 days (lazily purged on dashboard load)

---

## Technical stack

### Backend

| Layer | Technology |
|---|---|
| Framework | FastAPI 0.115 (async) |
| AI | Anthropic SDK (claude-sonnet-4-6), prompt caching |
| Database | SQLite via aiosqlite |
| Auth | bcrypt passwords, in-memory sessions |
| Encryption | cryptography (Fernet / AES-128-CBC + HMAC-SHA256) |
| Server | Uvicorn |

### Frontend

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| State | Zustand |
| Math rendering | MathJax 3 |
| Canvas | HTML5 Canvas (custom 2D + 3D renderers) |

---

## Deploy with Docker

The recommended way to run Resolvent — one command, accessible from any device on your local network.

**Requirements:** Docker, Docker Compose, an Anthropic API key

### 1. Clone and configure

```bash
git clone https://github.com/vilhelmhilding/resolvent
cd resolvent
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in:

```
ANTHROPIC_API_KEY=sk-ant-...
SECRET_KEY=any-long-random-string
```

### 2. Start

```bash
docker compose up -d
```

Both services build and start. The frontend waits for the backend health check before coming up.

### 3. Set a local hostname (recommended, one-time)

Give the host machine a memorable `.local` address so every device on the network can reach Resolvent at the same URL regardless of IP changes.

**macOS**
```bash
sudo scutil --set LocalHostName resolvent
```

**Linux** (requires `avahi-daemon`, installed by default on most distros)
```bash
sudo hostnamectl set-hostname resolvent
```

After this, `resolvent.local` resolves automatically on all devices via mDNS/Bonjour — no DNS server, no `/etc/hosts` edits, no IP lookup needed. Works on macOS, iOS, Android, Linux, and Windows 10+.

### 4. Connect

| From | URL |
|---|---|
| Same machine | `http://localhost:3000` |
| Any device on the network (after step 3) | `http://resolvent.local:3000` |
| Any device on the network (without step 3) | `http://<host-ip>:3000` |

To find the raw IP if needed:

```bash
# macOS
ipconfig getifaddr en0

# Linux
hostname -I | awk '{print $1}'
```

SQLite data is stored in a named Docker volume (`db_data`) and survives container restarts.

### Common commands

```bash
docker compose down          # stop everything
docker compose logs -f       # tail logs from both services
docker compose restart       # restart without rebuilding
docker compose up -d --build # rebuild images (after code changes)
```

---

## Local dev setup

**Requirements:** Python 3.11+, Node.js 20+, an Anthropic API key, mamba/conda

```bash
git clone https://github.com/vilhelmhilding/resolvent
cd resolvent
```

### Backend

```bash
cd backend
mamba create -n main python=3.12
mamba activate main
pip install -e .
cp .env.example .env   # fill in ANTHROPIC_API_KEY and SECRET_KEY
```

### Frontend

```bash
cd frontend
npm install
```

### Run

```bash
npm install -g pm2   # once — runs processes in background
make dev             # starts both backend and frontend
make stop            # stops both
make logs            # tail pm2 logs
```

---

## Tests

```bash
# Backend (pytest)
cd backend && python -m pytest -v

# Frontend (vitest)
cd frontend && npm test
```

CI runs both suites automatically on every push and pull request.

---

## Configuration

All configuration is via environment variables in `backend/.env`:

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Your Anthropic API key |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | Model for all API calls |
| `SECRET_KEY` | — | Secret for session signing and database encryption |
| `DB_PATH` | `/data/resolvent.db` | SQLite database path (Docker) |
| `DEBUG` | `false` | Enable Uvicorn reload |
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `8000` | Bind port |

---

## Project structure

```
resolvent/
├── docker-compose.yml
├── Makefile                          dev / stop / logs / restart
├── ecosystem.config.js               pm2 process config
├── backend/
│   ├── main.py                       FastAPI app, CORS, lifespan, /health
│   ├── config.py                     Pydantic settings (reads .env)
│   ├── pyproject.toml
│   ├── Dockerfile
│   ├── .env.example
│   ├── api/
│   │   ├── analyze.py                SSE streaming — image analysis pipeline
│   │   ├── analyze_latex.py          SSE streaming — LaTeX analysis pipeline
│   │   ├── chat.py                   Non-streaming chat endpoint
│   │   ├── auth.py                   Register, login, logout, /me
│   │   └── analyses.py               Save, list, load, delete analyses
│   ├── core/
│   │   ├── equation_extractor.py     4-stage extraction with prompt + JSON parsing
│   │   ├── anthropic_client.py       Async Anthropic SDK wrapper, prompt caching
│   │   ├── database.py               SQLite schema, Fernet encryption, compression
│   │   ├── visualization_engine.py   Animation variable detection and slider config
│   │   └── color_registry.py         Per-part color assignment
│   └── tests/
│       ├── conftest.py
│       ├── test_auth.py
│       ├── test_analyses.py
│       ├── test_database.py
│       ├── test_visualization.py
│       └── test_extractor.py
├── frontend/
│   ├── Dockerfile
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   ├── vitest.config.ts
│   └── src/
│       ├── app/
│       │   ├── layout.tsx            Root layout, MathJax config, viewport
│       │   ├── page.tsx              Entry point
│       │   ├── globals.css
│       │   └── api/                  Next.js proxy routes to backend
│       ├── components/
│       │   ├── ClientApp.tsx         Top-level state machine
│       │   ├── TopBar.tsx            Logo, 2D/3D toggle, language toggle, auth controls
│       │   ├── analysis/             AnalysisResult, AnimControls, ChatSection, DerivationSteps, PartCard
│       │   ├── auth/                 AuthModal
│       │   ├── dashboard/            Dashboard
│       │   ├── upload/               UploadZone, ImageCropper
│       │   └── viz/                  VizCanvas
│       ├── hooks/                    useAnimation, useCamera3D, useMathJax
│       ├── lib/
│       │   ├── api.ts                SSE streaming client
│       │   ├── expr-compiler.ts      JS expression compiler for visualization
│       │   ├── math-ext.ts           factorial, gamma, math extensions
│       │   └── renderers/            2D and 3D canvas renderers per viz type
│       ├── store/                    Zustand store
│       └── types/                    TypeScript types
└── demos/
    ├── demo1.gif
    └── demo2.gif
```

---

## License

MIT © [Vilhelm Hilding](https://github.com/vilhelmhilding)
