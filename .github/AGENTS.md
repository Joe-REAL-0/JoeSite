# JoeSite agent notes

## Quick start
- Install: `npm ci`
- Build: `npm run build` → `dist/`
- Preview: `npm run serve`
- Tests: `npm test`

This is a **static site**. There is no Flask app, no database, no server-side session. `dist/` is the only deployable artifact.

## Project map
- `eleventy.config.js` — input `src/`, output `dist/`, resource passthrough whitelist (only listed files ship).
- `src/_includes/base.njk` — the single layout. Eleventy layouts inject `{{ content }}`; page variables come from front matter (`title`, `description`, `canonical`, `pageTitle`, `bodyClass`, `styles`, `headScripts`, `bodyScripts`, `inlineHead`).
- `src/_data/*.js` — content loaders (`posts`, `blogPages`, `oc`) plus `site.json` / `friends.json`.
- `src/blog/list.njk` — paginated listing driven by `blogPages`; `src/blog/post.njk` — one page per post at `/blog/<id>/`.
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
