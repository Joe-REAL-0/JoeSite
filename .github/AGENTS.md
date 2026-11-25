# JoeSite agent notes

## Quick start
- Install: `npm ci`
- Build: `npm run build` → `dist/`
- Develop: `npm run dev`. Preview built output: `npm run preview`.
- Tests: `npm test`

This is a **static site**. There is no Flask app, no database, no server-side session. `dist/` is the only deployable artifact.

## Project map
- `astro.config.mjs` configures the Svelte integration and public asset allowlist.
- `src/layouts/Base.astro` is the shared page layout. `src/components/` contains shared UI and hydrated Svelte components.
- `src/pages/` defines HTML routes and the static XML and TXT endpoints.
- `src/lib/blog.js` loads blog content and pagination. `src/_data/` holds site settings and friend links.
- `scripts/markdown.mjs` — Markdown → sanitized HTML, math passthrough, heading anchors, TOC extraction.
- `scripts/time.mjs` — times are **+08:00** everywhere; never let the build machine timezone shift a date.
- `scripts/import-content.mjs` — read-only export from a legacy SQLite snapshot (private reconciliation report, never committed).
- `static/` — sources for CSS/JS/fonts/images; only whitelisted paths are copied to `dist/`.

## Rules that keep the site static
- No `fetch`/XHR to first-party endpoints; no forms that write. Adding an interactive feature means adding a write path — don't.
- No `{{`/`{%` may survive into `dist/`; `npm test` enforces this along with banned paths (`/api/`, `/find_text`, `/get_resources`, `/self_diary`).
- Content edits touch `src/posts`, `src/oc`, `src/_data/friends.json` only.
- CSS must use variables from `theme.css` (colors) and `global.css` (sizes); see `.agents/rules/css-edit-guide.md`.
- Pages must stay readable with JavaScript disabled: the cover layer and mobile rail are gated on `html.no-js`, and archive TOC entries are plain anchors.

## Branch workflow
- `dev` is the daily branch; `main` only takes pull requests.
