# PPT Generator Frontend (React)

A lightweight React (CRA) dashboard UI for generating PowerPoint presentations. Works with a backend API when configured, and runs fully in **mock mode** when no API base URL is provided.

## Run locally

```bash
npm install
npm start
```

Open http://localhost:3000

## Routes

- `/generate` (default): content input + options + generation controls
- `/templates`: placeholder
- `/settings`: basic env/config info

## Configuration (environment variables)

This CRA app reads env vars at build-time (prefix `REACT_APP_`).

- `REACT_APP_API_BASE` (preferred): Base URL of backend API (e.g. `http://localhost:8000`)
- `REACT_APP_BACKEND_URL` (fallback): Used if `REACT_APP_API_BASE` is not set
- `REACT_APP_WS_URL` (optional): reserved for future real-time updates

### Mock mode

If **neither** `REACT_APP_API_BASE` nor `REACT_APP_BACKEND_URL` is set, the app automatically enters **mock mode**:

- Submitting a generation request returns a fake `jobId`
- The UI polls status every ~1.4s
- Progress increments from 0 → 100% over a few steps
- A placeholder download URL is produced: `/mock/presentation.pptx`
- Downloading creates a small blob and saves `generated_presentation.pptx`

In development, a one-line warning is logged:
`[ppt-generator] API base URL missing; using mock mode.`

## UX notes

- Blank lines in **Sections** create new slides
- Each non-empty line becomes a bullet
- Optional: use `Title:` on the first line of a slide block to set a slide title

Example:

```
Intro:
- What we built
- Why it matters

Roadmap:
- Next milestones
- Risks and mitigations
```
