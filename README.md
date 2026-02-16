# Riffboard

Conversational prototyping tool — describe an app, watch it appear.

Riffboard lets you build React + Tailwind UI prototypes through natural language. Type what you want or switch to voice mode and talk through ideas freely. The app generates live, interactive previews in real time and tracks everything with git.

## What it does

**Chat Mode** — Type a description like "add a pricing page with three tiers" and see a working prototype appear instantly in the preview pane.

**Riff Mode** — Hit the mic, brainstorm out loud, and Riffboard automatically extracts discrete UI ideas from your stream of consciousness. Promote the ones you like into the build queue.

**Version Control** — Every change is auto-committed. Fork branches to explore alternatives, compare them side-by-side, and revert to any point in history.

**Auto-Fix** — Runtime errors in the prototype are detected and automatically corrected with a retry loop.

## Quick start

### Prerequisites

- Node.js 20+
- pnpm 8+

### Setup

```bash
git clone https://github.com/alexstein/riffboard.git
cd riffboard
pnpm install
```

Copy the example env file and add your API keys:

```bash
cp .env.example .env
```

Then edit `.env`:

```bash
# Required — powers code generation and idea extraction (Google Gemini)
GOOGLE_API_KEY=your_key_here

# Optional — powers voice transcription in Riff mode (Deepgram)
DEEPGRAM_API_KEY=your_key_here
```

### Run

```bash
pnpm dev
```

This starts both the frontend (http://localhost:5173) and the backend sidecar concurrently. Open the frontend URL in your browser.

## How to use it

1. **Create a project** — Click "New Project" and give it a name
2. **Describe your UI** — Type something like "build a dashboard with a sidebar nav and a stats grid"
3. **Iterate** — Ask for changes: "make the sidebar collapsible", "add a dark mode toggle", "change the color scheme to blue"
4. **Try voice mode** — Toggle to Riff mode, click the mic, and brainstorm. Ideas appear as suggestion cards — click "Go" to queue them for building
5. **Explore branches** — Fork from any commit to try a different direction, then compare branches side-by-side

## Architecture

```
Browser (localhost:5173)
  ├── React 19 + Zustand 5 (state management)
  ├── Sandpack (live prototype preview)
  └── Vite (dev server, proxies /api and /ws to sidecar)

Express Sidecar (localhost:3456)
  ├── Project CRUD + file management
  ├── Git operations (isomorphic-git)
  ├── Gemini distillation pipeline
  ├── WebSocket bridge to Deepgram (voice)
  └── Spawns OpenCode server (localhost:4096)

OpenCode Server (localhost:4096)
  └── Agent-based code generation with custom prototype prompt
```

### Key services

| Service | Port | Purpose |
|---------|------|---------|
| Vite dev server | 5173 | Frontend + API proxy |
| Express sidecar | 3456 | API routes, git, voice bridge |
| OpenCode | 4096 | Code generation (auto-spawned) |

### Project data

Each project lives at `~/.riffboard/projects/<uuid>/` with:
- `spec.json` — project metadata
- `prototype/` — generated React + Tailwind files
- `.git/` — full version history (isomorphic-git)

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Zustand 5, Vite 6 |
| Prototype preview | @codesandbox/sandpack-react |
| Backend | Express 4, TypeScript 5 |
| Version control | isomorphic-git |
| Code generation | OpenCode + Google Gemini |
| Voice transcription | Deepgram Nova 2 |
| Validation | esbuild (JSX syntax checking) |

## Scripts

```bash
pnpm dev          # Start frontend + backend
pnpm dev:vite     # Frontend only
pnpm dev:server   # Backend only
pnpm build        # Production build
pnpm typecheck    # Type checking
pnpm lint         # ESLint
```

## How it works under the hood

1. **You type a message** — it goes through a Gemini-powered distillation layer that converts casual language into a focused UI instruction
2. **The instruction hits OpenCode** — which runs a custom "prototype" agent that only generates static React + Tailwind code with hardcoded data
3. **esbuild validates the output** — if there are syntax errors, it retries up to 3 times with error context
4. **Sandpack renders the result** — if runtime errors occur, the auto-fix system sends them back for correction
5. **isomorphic-git commits the change** — building a full history you can browse, revert, or fork from

In Riff mode, the voice pipeline streams audio through a WebSocket to Deepgram, accumulates a transcript, then debounces a call to Gemini to extract structured ideas with confidence scores.

## License

MIT
