# Derelict — Ownerless Roblox Group Scanner

A static site that sweeps Roblox's public group search API for groups with no owner (the account that owned them was banned, deleted, or left), which Roblox allows other users to claim.

It's plain HTML/CSS/JS — no build step, no backend, so it hosts for free on GitHub Pages.

## Deploy it on GitHub Pages

1. Create a new **public** GitHub repo (e.g. `derelict`).
2. Upload these three files to the repo root: `index.html`, `style.css`, `script.js`.
3. Go to the repo's **Settings → Pages**.
4. Under "Build and deployment", set **Source: Deploy from a branch**, branch: `main`, folder: `/ (root)`.
5. Save. GitHub gives you a URL like `https://yourusername.github.io/derelict/` within a minute or two.

That's it — no npm install, no build command.

## Important: CORS

Roblox's API (`groups.roblox.com`) is built for roblox.com itself, not for arbitrary third-party sites making browser requests. When you load the page and hit "Start sweep," one of two things happens:

- **It just works** — some Roblox endpoints do allow cross-origin GET requests. Try it first before doing anything else.
- **Requests fail with a network/CORS error** — in that case, open the "Connection settings" panel on the page and paste in a CORS proxy prefix, for example:
  - `https://corsproxy.io/?url=`
  - or run your own tiny proxy (a few lines on Cloudflare Workers or Vercel Edge Functions) if you want something more reliable long-term

The site prepends whatever you paste there to every Roblox API URL it calls.

## How "claimable" is actually determined

Roblox's own group-claim feature is triggered when a group's `owner` field comes back `null` from the API — meaning the account that owned it no longer effectively owns it (ban, deletion, etc). This tool flags exactly that condition and links you to the group's page on roblox.com; the actual claim happens there, under whatever rules Roblox currently has in place (there's historically been a Robux cost and eligibility requirements — check the group page itself, since Roblox can change these rules without notice).

## What this tool does *not* do

- No login, no cookies, no session tokens — everything is a public, unauthenticated `GET` request.
- No automated claiming — you always finish the claim yourself on roblox.com.
- No bypassing of any Roblox restriction; it's reading the same public data Roblox's own search page reads.

## Files

- `index.html` — page structure and copy
- `style.css` — visual design (dark terminal/radar theme)
- `script.js` — the actual API calls and scan logic
