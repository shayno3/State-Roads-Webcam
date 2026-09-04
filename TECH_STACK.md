# Tech Stack Reference Log
## Road Cams — Meta Ray-Ban Display Web App

**Project:** roadcams-glasses
**Version:** 1.0.0
**Build Date:** 2026-09-04
**Purpose:** View state road camera feeds on Meta Ray-Ban Display glasses

---

## Frontend

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Language | HTML5 / CSS3 / ES2022 JavaScript | — | Single-file, no build step |
| Framework | None (vanilla JS) | — | Keeps bundle tiny for glasses display |
| UI paradigm | Dark-theme, mobile-first SPA | — | Optimized for Meta Ray-Ban Display small screen |
| Fonts | System font stack (`-apple-system`, `SF Pro`, `Segoe UI`) | — | No external font loading |
| Icons | Unicode/emoji | — | No icon library dependency |
| State management | Plain JS variables + localStorage | — | Per-device API key storage |
| Routing | Show/hide view divs | — | No router library |
| Image loading | `<img>` tags via proxy endpoint | — | Cache-busting via `?t=timestamp` |
| Meta SDK path | Web App (HTML/CSS/JS) | May 2026 | Via Meta Wearables Toolkit |

---

## Backend

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Runtime | Node.js | ≥18.0.0 | LTS recommended |
| Framework | Express | ^4.19.2 | Minimal HTTP server |
| HTTP client | Axios | ^1.7.2 | Upstream API + image requests |
| Dev runner | Nodemon | ^3.1.4 | Auto-restart in dev (`npm run dev`) |
| Port | 3000 (default) | — | Override with `PORT` env var |

---

## External Data Sources (Free / No Cost)

| State | API Base URL | Auth | Format | Approx Cameras |
|-------|-------------|------|--------|----------------|
| New York | https://511ny.org/api/v2/get/cameras | `?key=` | JSON | ~1,200 |
| Georgia | https://511ga.org/api/v2/get/cameras | `?key=` | JSON | ~400 |
| Arizona | https://www.az511.com/api/v2/get/cameras | `?key=` | JSON | ~300 |
| Alaska | https://511.alaska.gov/api/v2/get/cameras | `?key=` | JSON | ~150 |
| Nevada | https://www.nvroads.com/api/v2/get/cameras | `?key=` | JSON | ~250 |
| SF Bay (CA) | https://api.511.org/traffic/cameras | `?api_key=` | JSON | ~200 |
| Pennsylvania | https://www.511pa.com/api/v2/get/cameras | `?key=` | JSON | ~500 |

**API Standard:** All states follow the national 511 traveler information API standard. Camera objects include: `Id`, `Roadway`, `Direction`, `Location`, `Latitude`, `Longitude`, `Views[].Url`.

---

## Target Hardware

| Device | Notes |
|--------|-------|
| Meta Ray-Ban Display glasses | Primary target — runs via Meta Wearables Toolkit Web App SDK |
| iOS / Android phone | Full support (companion device) |
| Desktop browser | Full support (development + pre-trip planning) |

---

## Proxy Architecture

```
Client (glasses/phone/browser)
  → GET /api/cameras/:state?key=KEY   → Express → 511 DOT API → JSON
  → GET /api/image?url=ENCODED_URL    → Express → DOT image server → JPEG
  → GET /api/health                   → Express → { status: 'ok', ... }
  → GET /*                            → Express → public/index.html (SPA)
```

**Why a proxy?**
- CORS: 511 APIs don't set `Access-Control-Allow-Origin` headers
- Security: API keys stay server-side, never exposed to client JS
- Image re-serving: Some state servers block direct browser requests (missing Referer/User-Agent)
- Cache-busting: Proxy strips upstream cache headers; client always gets fresh frames

---

## File Structure

```
roadcams-glasses/
├── public/
│   └── index.html        # Frontend SPA (all-in-one HTML/CSS/JS)
├── server.js             # Express proxy + static file server
├── package.json          # Dependencies and scripts
├── SETUP.md              # User setup guide
└── TECH_STACK.md         # This file
```

---

## Deployment Options

| Platform | Command | Cost |
|----------|---------|------|
| Railway | `railway up` | Free tier available |
| Render | Connect repo, auto-deploy | Free tier available |
| Fly.io | `fly launch` | Free tier available |
| VPS | `PORT=3000 node server.js` + nginx | Cost of VPS |

> Meta Wearables Toolkit requires **HTTPS** for production apps on the glasses.

---

## Future Additions (Planned)

- [ ] Map view (Leaflet.js) showing camera pins by GPS coordinates
- [ ] More states (TX, FL, CO, WA, OR — all have 511 APIs)
- [ ] Favorites / pinned cameras (localStorage)
- [ ] Meta Neural Band gesture support (swipe left/right to navigate cameras)
- [ ] Voice query integration (Meta AI → "show me I-95 cameras")
- [ ] Incident overlay (511 incident data alongside cameras)
- [ ] PWA manifest for installable phone app
