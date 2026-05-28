# Nūr al-Īḍāḥ Reader

A Quran.com-style reader for the extraction of *Nūr al-Īḍāḥ — Kitāb al-Ṭahārah*
(`extracted.json`).

## Display toggles

- **Arabic text** — show / hide the original Arabic.
- **Word-by-word translation** — render English under each Arabic word.
- **Full translation** — show the block-level English sentence.
- **I‘rāb (ḥarakāt)** — when off, diacritical marks (tashkīl) are stripped
  client-side from the Arabic.

All toggles are persisted in `localStorage` (key `nai.settings.v1`). A dark
mode toggle is also provided.

## Word bank

Click any Arabic word to open a popover with its translation, then "Add to
word bank". Saved words are grouped by section (fasl) in a side drawer, and
each entry has a back-link that scrolls the reader to the source.

The bank is stored in your browser's `localStorage` (key
`nai.wordbank.v2`). You can also:

- **Export CSV** — for spreadsheet / Anki import (UTF-8 with BOM).
- **Export JSON** — read-only backup of the full envelope (entries +
  tombstones + section context). Re-import is intentionally not
  offered — see [Optional cross-device sync](#optional-cross-device-sync-google-drive)
  for cross-browser portability.

### Optional cross-device sync (Google Drive)

If the build was given a `VITE_GOOGLE_CLIENT_ID`, a "Sign in" button
appears in the toolbar. After signing in, the bank is synced to a hidden,
app-only folder in **your own Google Drive** (`drive.appdata` scope) — no
backend, no DB, no server we operate touches your data.

To enable it:

1. Create a Google Cloud project at
   [console.cloud.google.com](https://console.cloud.google.com/).
2. **APIs & Services → Library**: enable the "Google Drive API".
3. **APIs & Services → OAuth consent screen**:
   - User type: **External**.
   - Add the scope `https://www.googleapis.com/auth/drive.appdata` (it
     is *not* a sensitive scope, so verification is minimal).
   - Add yourself as a test user while in "Testing" status, or submit
     for verification to ship publicly.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Authorized JavaScript origins: your production URL (e.g.
     `https://<user>.github.io`) **and** `http://localhost:5173`.
   - No redirect URIs are needed (we use the implicit token-client flow).
5. Copy the generated **Client ID** (e.g. `123-abc.apps.googleusercontent.com`).
6. **Locally**: create `.env.local` in the project root with
   `VITE_GOOGLE_CLIENT_ID=123-abc.apps.googleusercontent.com`.
7. **In CI**: add the same value as a GitHub repo secret named
   `VITE_GOOGLE_CLIENT_ID`. The workflow at
   `.github/workflows/deploy.yml` already forwards it to the build.

If the env var is unset the app simply hides the sign-in button and
runs anonymously.

## Run locally

```
npm install
npm run dev
```

Then open http://localhost:5173.

## Build

```
npm run build
npm run preview
```

## Deploy to GitHub Pages

This folder is self-contained. Push it as the **root of a new GitHub repo** and
the included Actions workflow (`.github/workflows/deploy.yml`) will build and
publish on every push to `main`.

1. Create a new empty repo on GitHub (e.g. `nai-site`).
2. From inside this folder:

   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo>.git
   git push -u origin main
   ```

3. On GitHub: **Settings → Pages → Build and deployment → Source = GitHub Actions**.
4. Wait for the **Deploy to GitHub Pages** workflow to finish (Actions tab).
5. Your site will be live at `https://<your-username>.github.io/<repo>/`.

The Vite config uses `base: './'` so the build works under any subpath — no
edits needed when you change the repo name or add a custom domain.

## Data

`public/extracted.json` is a copy of `../extracted.json`. To refresh it:

```
cp ../extracted.json public/extracted.json
```
