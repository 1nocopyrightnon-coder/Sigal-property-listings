# Sigal Group Realty

Static marketing and property-listings website for Sigal Group Realty, a South Florida
real-estate brokerage serving Boca Raton, Delray Beach, Boynton Beach, Deerfield Beach,
Highland Beach, Oakland Park, and Parkland.

The site is intentionally build-free: every page is plain HTML that loads shared CSS and
JavaScript from `assets/`. The only compiled artifact is the testimonials marquee, a small
React component bundled with Vite into a self-mounting script.

## Tech stack

- **Pages** — hand-written static HTML, one file per route
- **Styling and behavior** — vanilla CSS and framework-free JavaScript in `assets/`
- **Testimonials marquee** — React 19 + TypeScript + Tailwind CSS 3, bundled by Vite 8 into
  an IIFE at `assets/reviews-marquee.js` (Tailwind `preflight` is disabled so its styles do
  not leak into the surrounding static pages)
- **Forms** — Netlify Forms, wired up automatically by `assets/sg-forms.js`
- **Hero address search** — Photon (OpenStreetMap) for autocomplete, with a MapLibre GL map
  preview rendered from OpenFreeMap tiles; MapLibre is lazy-loaded from a CDN on first use
- **Content management** — Decap/Netlify CMS with Netlify Identity, backed by a Netlify
  function that commits listing edits to GitHub

No third-party API keys are required by the front end.

## Project layout

```
├── index.html, about.html, properties.html, sell.html, contact.html,
│   neighborhoods.html            Top-level pages
├── boca-raton.html, delray-beach.html, …            City landing pages
├── blog/                         Neighborhood market articles (plus blog/index.html)
├── assets/
│   ├── sg-nav.js / sg-nav.css    Shared navigation, injected on every page
│   ├── sg-mobnav-fix.js          Mobile hamburger menu toggle
│   ├── sg-app.js                 Hero search tabs, address autocomplete, map preview
│   ├── sg-forms.js               Netlify Forms wiring
│   ├── sg-location.css           Styles for city and blog pages
│   ├── reviews-marquee.js/.css   Built marquee bundle (committed; see below)
│   └── reviews/                  Reviewer headshots
├── listings/listings.json        Single source of truth for all property listings
├── admin/                        CMS entry point and Decap config
├── netlify/functions/            Serverless function backing the CMS
├── src/, components/ui/, lib/    React source for the testimonials marquee
└── netlify.toml                  Netlify build, headers, and redirects
```

`listings/listings.json` drives the property grids and also supplies the city list used by
the hero search autocomplete.

### The committed bundle

`assets/reviews-marquee.js` and `assets/reviews-marquee.css` are build outputs but are
**committed to the repository on purpose**. Netlify publishes the repo root with no build
step, and the HTML pages reference these files directly, so they must be present in git.
Rebuild and commit them whenever anything under `src/`, `components/`, or `lib/` changes.

## Running locally

The site is static, so any file server works from the repo root:

```bash
python3 -m http.server 8000
# or
npx serve .
```

Then open <http://localhost:8000>. Serve over HTTP rather than opening the HTML files
directly, since the pages fetch `listings/listings.json`.

To rebuild the testimonials marquee after editing its React source:

```bash
npm install
npm run build:reviews
```

The output is written straight into `assets/`. `package.json` also defines the stock Vite
`dev` and `preview` scripts, which are not needed for normal work on the static pages.

## Deployment

The site deploys to Netlify using the settings in `netlify.toml`:

- **Publish directory:** `.` (the repository root, no build command)
- **Functions directory:** `netlify/functions`
- Redirects provide clean URLs such as `/properties`, `/sell`, `/about`, `/contact`,
  and `/areas`

### CMS and environment variables

`/admin` is gated by Netlify Identity. Saving a listing calls
`netlify/functions/github-api.js`, which verifies the caller's Identity JWT and then reads
and writes `listings/listings.json` through the GitHub Contents API. Configure these
environment variables in the Netlify site settings:

| Variable | Required | Description |
| --- | --- | --- |
| `GITHUB_TOKEN` | Yes | GitHub token with write access to this repository's contents |
| `GITHUB_REPO` | Yes | Target repository as `owner/name` |
| `GITHUB_BRANCH` | No | Branch to commit to; defaults to `main` |

`GITHUB_TOKEN` is read only inside the serverless function and is never exposed to the
browser. Media uploads go to Cloudinary using the public `cloud_name` and unsigned
`upload_preset` in `admin/config.yml`.
