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
