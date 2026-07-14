![Team Calendar](docs/cover.png)

A static, git-backed team calendar you edit right in the browser.

![License: MIT](https://img.shields.io/badge/license-MIT-6cb6ff.svg)

## Overview

Team Calendar is a static, git-backed team calendar. Events live in a plain
`events.json` file in this repo. You edit them in the browser, and the change
is committed straight back to the repo as a real git commit — no backend, no
build step, no database.

## Screenshots

| Month view | Agenda view |
| --- | --- |
| ![Month view](docs/screenshots/month.png) | ![Agenda view](docs/screenshots/agenda.png) |

## Features

- In-browser editing — create, edit, and delete events without leaving the page
- Per-user Personal Access Token (PAT) access model — no shared credentials
- Month and agenda views, with a **month/year quick-picker** (click the date to jump anywhere)
- **Live search** across both views — matches event titles, descriptions, categories, and custom field values
- **Event templates** — shared, reusable presets that pre-fill a new event (managed in-app)
- **Custom fields** — templates can define their own fields (short text, long text, link, dropdown); values show on hover and are searchable
- **Hover details** — point at any event for a popover with its full details
- Category colors for at-a-glance scanning
- Three themes — dark, light, and **workbench** (matches the [Terminal Workbench design system](https://github.com/Real-Fruit-Snacks/terminal-workbench-design-system)); cycle with the theme button
- Runs on **GitHub Pages** and **GitLab Pages**
- Offline / air-gapped hostable — no external services required
- Full edit history via git — every change is a real commit

## How it works

**Reading** the calendar is just a static file fetch: the page loads
`events.json` as a plain same-origin file. This works identically on GitHub
Pages, GitLab Pages, an air-gapped GitLab instance, or `localhost` — there
are no API rate limits, and read-only viewers don't need a token at all.

**Editing** requires a Personal Access Token. The first time you try to
create or change an event, you're prompted to paste your own GitHub or
GitLab PAT. It's stored only in your browser's `localStorage` — it's never
sent anywhere except the host's own API when you save. Saving commits the
updated `events.json` back to the repo via the host's file API (the GitHub
Contents API or the GitLab Repository Files API).

The access model is simple: **if you can access the repo, you can edit the
calendar.** A write-scoped token is your permission — there's no separate
allowlist to manage. Revoking someone's repo access revokes their ability to
edit. Every edit is a real git commit attributed to the person who made it,
so the full history is just `git log`.

Near-simultaneous edits are conflict-safe: saves use optimistic concurrency
(the current commit ref is sent with the write) and automatically retry once
— re-fetching the latest version and re-applying your change — if someone
else saved in between.

## Quick start (GitHub Pages)

1. Push this repo to GitHub.
2. In **Settings → Pages**, set the source to **GitHub Actions** (the included
   workflow at `.github/workflows/pages.yml` builds and deploys automatically).
3. Open the deployed site.
4. Click a day to create an event. When prompted for a token, use the guided
   popup's **"Create one now →"** link, which opens GitHub's token creation
   page pre-filled with the right scope. Paste the token back in, and edit
   away.

## Self-host on GitLab / offline

**Full step-by-step (including air-gapped GitLab) is in [INSTALL.md](INSTALL.md)**,
which ships in the release. Quick version:

The app auto-detects its host, but on GitLab you point it at your instance and
project. Set `config.json` at the repo root:

```json
{
  "host": "gitlab",
  "origin": "https://gitlab.example.com",
  "projectId": 123,
  "branch": "main"
}
```

- **`origin`** — your GitLab instance URL (no trailing slash). Read-only viewing
  works with just this; it's used to build the token page link.
- **`projectId`** — the numeric project ID, shown on the project's overview page
  and under **Settings → General**. Required for editing (the API writes use it).
- **`branch`** — the branch the calendar commits to (usually `main`).

Then:

1. Push this repo to a project on your GitLab instance.
2. The included **`.gitlab-ci.yml`** publishes the static files to GitLab Pages
   with a plain `cp` — **no internet access, no npm install, no build** — so it
   runs on **air-gapped GitLab** too.
3. Open the Pages URL. To edit, create a Personal Access Token with the **`api`**
   scope (the in-app popup links straight to the pre-filled page) and paste it in.

Because reading is a same-origin static fetch of `events.json`, there are no
cross-origin/CORS calls and no API rate limits for viewers; the GitLab API is
only used when someone saves an edit.

### Serve it anywhere, with zero dependencies

The app is a `fetch`-based SPA, so it must be served over HTTP (not opened as a
`file://` path). The release contains **everything needed** — no CDN, no web
fonts, no build step, nothing to download or `pip install`. If you're not using
GitLab Pages, the bundled **`serve.py`** hosts it with only the Python 3 standard
library:

```bash
python serve.py 8080     # then open http://localhost:8080
```

Any static file server works too (nginx, `python -m http.server`, etc.) — just
point it at the folder. Everything the running app loads (`index.html`, the
`assets/` JS/CSS, `config.json`, `events.json`, and inline SVG icons) is served
from that folder; nothing is fetched from the internet.

> **Note:** hosting on your own GitLab is a step you run on your instance — this
> project can't push to a private GitLab for you. Everything needed is in the
> repo and the release zip.

## Data format

Categories, templates, and events all live in `events.json`:

```json
{
  "version": 1,
  "categories": [
    { "id": "meeting", "label": "Meeting", "color": "#6cb6ff" }
  ],
  "templates": [
    {
      "id": "tpl_deploy",
      "name": "Deploy",
      "category": "deploy",
      "allDay": true,
      "description": "Cut the release branch",
      "fields": [
        { "id": "fld_ticket", "label": "Ticket", "type": "url", "default": "" },
        { "id": "fld_priority", "label": "Priority", "type": "select", "options": ["Low", "High"], "default": "Low" }
      ]
    }
  ],
  "events": [
    {
      "id": "evt_seed01",
      "title": "Team sync",
      "date": "2026-07-14",
      "allDay": false,
      "start": "10:00",
      "end": "10:30",
      "category": "meeting",
      "description": "Weekly standup",
      "fields": [
        { "id": "fld_ticket", "label": "Ticket", "type": "url", "value": "https://…" }
      ]
    }
  ]
}
```

Templates are optional presets. When you create an event from one, its custom
field definitions are **snapshotted** onto the event (as `fields` with values),
so editing or deleting a template later never changes existing events. Field
`type` is one of `text`, `textarea`, `url`, or `select` (with `options`).

## Architecture

The app is plain ES modules with no build step, split into small,
independently-testable pieces:

| Module | Responsibility |
| --- | --- |
| `assets/js/dates.js` | Pure date/calendar-grid math |
| `assets/js/model.js` | Events, categories, templates, and custom-field helpers (all pure) |
| `assets/js/host.js` | GitHub/GitLab file API adapters (get/put, base64, token URLs) |
| `assets/js/store.js` | Load/save orchestration with conflict-retry |
| `assets/js/token.js` | PAT storage in `localStorage` |
| `assets/js/render.js` | Month grid, agenda, search filtering, and hover tooltips |
| `assets/js/ui.js` | Header, month/year picker, event/template modals, custom dropdown, token popup, themes |
| `assets/js/app.js` | Wiring/bootstrap |

The pure-logic modules (`dates`, `model`, `host`, `store`, `token`) are unit
tested with Node's built-in test runner — zero dependencies:

```bash
npm test
```

There is no bundler, transpiler, or framework: `index.html` loads
`assets/js/app.js` as a native ES module.

## License

MIT — see [LICENSE](LICENSE).
