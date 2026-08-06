# MRF — Medwood Research Facility

Official clearance/rank storefront for the MRF Roblox game. Static site, no build step.

## Files
- `index.html` — page content
- `styles.css` — all styling
- `script.js` — tiny bit of button polish, site works without it
- `assets/mrf-logo.png` — your logo

## Put this on GitHub Pages

1. Create a new repo on GitHub (e.g. `mrf-site`).
2. Upload these four items (`index.html`, `styles.css`, `script.js`, `assets/`) to the root of the repo — either drag-and-drop on github.com or:
   ```
   git init
   git add .
   git commit -m "MRF site"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/mrf-site.git
   git push -u origin main
   ```
3. In the repo: **Settings → Pages → Source → Deploy from branch → `main` / root → Save**.
4. GitHub gives you a URL like `https://YOUR-USERNAME.github.io/mrf-site/` within a minute or two.

## Things to double-check before sharing the link
- The three "Request Clearance" buttons currently point to:
  - Standard (135 R$) → `game-pass/1935076317`
  - Advanced (240 R$) → `game-pass/1936496942`
  - Ultimate (400 R$) → `game-pass/1939172354`
  Confirm those IDs match Standard → Advanced → Ultimate in that order on your end.
- The perk bullets under each tier are placeholders — swap in your real perks in `index.html` (search for `level-perks`).
- Update the page `<title>` and meta description in `index.html` if you want different text in the browser tab / search results.

## Custom domain (optional)
If you buy a domain later: add a `CNAME` file at the repo root containing just your domain, then point your domain's DNS to GitHub Pages per [GitHub's docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site).
