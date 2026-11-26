# STARLYN CAPITAL FINANCE — repo

This repo deploys from a **single `app.zip`**.

## To update the app
1. Replace **`app.zip`** in this repo with the new one (keep the name `app.zip`).
2. Commit to `main`. Two workflows run automatically:
   - **Deploy Web** → unzips `app.zip`, publishes `web/` to the `gh-pages` branch → live site.
   - **Build Android APK** → unzips `app.zip`, builds the APK (download from the run's Artifacts).

## One-time GitHub Pages setting
Settings → Pages → Build and deployment:
- **Source:** Deploy from a branch
- **Branch:** `gh-pages` → `/ (root)` → Save

Live site: https://starlyncapitalfinance-afk.github.io/finance/

## What's inside app.zip
`web/` (the app), `backend/` (Cloudflare Worker), `capacitor.config.json`, `package.json`, `assets/`.
The workflow files live here in the repo (`.github/workflows/`), **not** inside `app.zip`.
