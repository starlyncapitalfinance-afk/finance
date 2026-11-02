# Sri Finance JLG — web + Android app (offline-first, cloud synced)

Same concept as your ZYFM app:

- **One codebase** (`web/`, plain HTML/JS — a PWA) → runs as the **web app** and,
  wrapped with **Capacitor**, as the **Android APK**.
- **Offline-first**: all data is saved on the device (IndexedDB) and works with no
  internet. When online it syncs through a tiny **Cloudflare Worker + D1** server.
- **Last-write-wins** sync (newer `updatedAt` wins) — like ZYFM.
- Tamil / English, navy/lavender theme, Collection Report PDF (jspdf) with your logo.

```
jlg-app/
  backend/   Cloudflare Worker + D1 (the sync server)
  web/       the app (open index.html, or build the APK from it)
  .github/workflows/   android.yml (APK) + web.yml (GitHub Pages)
  capacitor.config.json, package.json
```

## 1) Deploy the sync server (one time, free)
See `backend/README.md`:
```bash
cd backend
wrangler login
wrangler d1 create starlyn-capital-finance        # paste the id into wrangler.toml
wrangler d1 execute starlyn-capital-finance --remote --file=./schema.sql
wrangler deploy                          # prints your server URL
```
Put that URL in **`web/js/server-config.js`** (`DEFAULT_SERVER`).

## 2) Put it on GitHub
Create a repo and push this folder. Two workflows run automatically:
- **Build Android APK** → Actions tab → open the run → download the
  `starlyn-capital-finance-apk` artifact → install the APK on any Android phone.
- **Deploy Web** → enable Pages (Settings → Pages → Source: GitHub Actions);
  your web app goes live at `https://<user>.github.io/<repo>/`.

You can also trigger either workflow manually (Actions → Run workflow).

## 3) First run
Open the app → **Set up server** → enter the server URL + your name/username/password.
The first account is the **Admin**. Every device that signs in to the same server URL
shares the same live data. Saved weekly collections can only be edited by an Admin.

## Notes
- The APK produced is a **debug** build — fine for sideloading. For the Play Store a
  signed release build is needed (can be added to the workflow later).
- Center/loan numbers are generated on-device; ids are globally unique, so sync never
  mixes records up.
- To change the app logo, replace `web/icon-192.png` / `icon-512.png` and the data URL
  in `web/js/logo.js`.
