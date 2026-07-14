# Deploying Team Calendar (offline / air-gapped)

Everything needed is in this bundle. **Nothing is downloaded, built, or
`pip install`ed** at any point — no CDN, no web fonts, no npm, no internet.
Pick one of the two hosting paths below.

The only hard requirement: the app is a `fetch`-based single-page app, so it
must be **served over HTTP**. Opening `index.html` directly as a `file://` path
will not work (the browser blocks `fetch` of `config.json`/`events.json`).

---

## Files in this bundle

```
index.html              the app entry point
assets/css/*.css        styles (2 files)
assets/js/*.js          the app (8 ES modules, no dependencies)
events.json             your calendar data (edited in-browser)
config.json             host settings (edit for GitLab — see below)
serve.py                zero-dependency static server (Python 3 stdlib)
.gitlab-ci.yml          GitLab Pages deploy job (offline-safe)
.github/workflows/…     GitHub Pages deploy (only if you use GitHub)
README.md, LICENSE      docs
tests/                  unit tests (dev only; not needed to host)
```

Nothing else is fetched at runtime. Every icon is an inline SVG; every script
and style is loaded from `assets/`.

---

## Path A — Host on your internal GitLab (Pages)

### 1. Put the files in a GitLab project

Unzip the release and push its contents to a project on your GitLab instance
(or upload them through the GitLab web UI). The files must sit at the **project
root** (so `index.html` is at the top level).

### 2. Edit `config.json`

Point the app at your instance and project so editing works:

```json
{
  "host": "gitlab",
  "origin": "https://gitlab.example.com",
  "projectId": 123,
  "branch": "main"
}
```

- **`host`** — set to `"gitlab"`.
- **`origin`** — your GitLab base URL, no trailing slash.
- **`projectId`** — the numeric ID on the project's overview page (and under
  **Settings → General**). Required for saving edits.
- **`branch`** — the branch the calendar commits to (usually `main`).

Commit `config.json`.

### 3. Let CI publish Pages

The included **`.gitlab-ci.yml`** has a `pages` job that just copies the static
files into `public/` — no build, no network. When you push to the default
branch, GitLab Pages serves the site.

**Air-gapped runner note:** the job only needs a shell (`mkdir`, `cp`).
- On a **shell-executor** runner it works with no container image.
- On a **Docker-executor** runner it uses your instance's default CI image. If
  your offline runner can't pull one, edit `.gitlab-ci.yml` and uncomment the
  `image:` line, pointing it at any tiny image already in your registry
  (e.g. `busybox`). No image is downloaded from the internet either way.

Confirm GitLab Pages is enabled for the project (**Settings → Pages** /
**Deploy → Pages**), then open the Pages URL shown there.

### 4. Editing (optional, per user)

Viewing needs nothing. To **edit**, each person creates a GitLab **Personal
Access Token** with the **`api`** scope (Preferences → Access Tokens; the app's
popup links straight to the pre-filled page). Paste it once when prompted — it's
stored only in that browser and used solely to commit `events.json` back to the
project. "If you can access the repo, you can edit."

---

## Path B — Host with the bundled server (no GitLab needed)

On any machine with **Python 3** (standard library only — no pip, no internet):

```bash
python serve.py 8080
```

Then open `http://localhost:8080` (or `http://<that-machine>:8080` from another
box on the LAN — `serve.py` binds all interfaces). Any other static file server
works too (nginx, Apache, `python -m http.server`) — just point it at this
folder.

For editing on this path, set `config.json` to whichever host actually stores
the repo (GitLab as above), since saves commit through that host's API.

---

## Troubleshooting

- **Blank page / "failed to fetch"** — you opened it as `file://`. Serve it over
  HTTP (Path A or B).
- **Calendar shows but editing fails** — check `config.json` `projectId`/`origin`
  and that your token has the `api` scope.
- **GitLab CI job fails to start** — your Docker runner has no image; use a shell
  runner or set `image:` in `.gitlab-ci.yml` (see step 3).
- **Scripts don't run / MIME errors** — serve `.js` as `text/javascript`.
  `serve.py` already does this; some bare static servers don't.
