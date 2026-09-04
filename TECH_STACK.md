# Tech Stack Reference Log
## Road Cams — Meta Ray-Ban Display Web App

**Project:** roadcams-glasses  
**Version:** 1.1.0  
**Build Date:** 2026-09-04  
**Purpose:** View state road camera feeds on Meta Ray-Ban Display glasses  
**Live URL:** https://stateroad.fyi

---

## Frontend

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Language | HTML5 / CSS3 / ES2022 JavaScript | — | Single-file, no build step |
| Framework | None (vanilla JS) | — | Keeps bundle tiny for glasses display |
| UI paradigm | Dark-theme, mobile-first SPA | — | Optimized for Meta Ray-Ban Display small screen |
| Display font | Barlow Condensed (700, 800) | — | Highway-signage aesthetic, Google Fonts |
| UI font | Inter (400, 500, 600) | — | Clean legibility, Google Fonts |
| Mono font | JetBrains Mono (400, 500) | — | Status bar / IDs / timestamps, Google Fonts |
| Icons | Unicode/emoji + inline SVG | — | No icon library dependency |
| Accent color | #F5C318 (amber/road marking) | — | Highway centerline yellow |
| State management | Plain JS variables + localStorage | — | Per-device API key storage |
| Routing | Show/hide view divs | — | No router library |
| State selector | Horizontal scrollable pill buttons | v1.1.0 | Replaced dropdown |
| Image loading | `<img>` tags via proxy endpoint | — | Cache-busting via `?t=timestamp` |
| Camera cards | CCTV scan-line CSS effect | v1.1.0 | `::after` repeating-linear-gradient |
| Branding | stateroad.fyi | v1.1.0 | Road icon logo-mark, amber accent |
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
| N. Carolina | https://www.drivenc.gov/api/v2/get/cameras | `?key=` | JSON | ~300 |
| Florida | https://fl511.com/api/v2/get/cameras | `?key=` | JSON | ~600 |
| Pennsylvania | https://www.511pa.com/api/v2/get/cameras | `?key=` | JSON | ~500 |
| Georgia | https://511ga.org/api/v2/get/cameras | `?key=` | JSON | ~400 |
| Arizona | https://www.az511.com/api/v2/get/cameras | `?key=` | JSON | ~300 |
| Nevada | https://www.nvroads.com/api/v2/get/cameras | `?key=` | JSON | ~250 |
| Alaska | https://511.alaska.gov/api/v2/get/cameras | `?key=` | JSON | ~150 |
| SF Bay (CA) | https://api.511.org/traffic/cameras | `?api_key=` | JSON | ~200 |

**API Standard:** All states follow the national 511 traveler information API standard. Camera objects include: `Id`, `Roadway`, `Direction`, `Location`, `Latitude`, `Longitude`, `Views[].Url`.

---

## Target Hardware

| Device | Notes |
|--------|-------|
| Meta Ray-Ban Display glasses | Primary target — runs via Meta Wearables Toolkit Web App SDK |
| iOS / Android phone | Full support (companion device) |
| Desktop browser | Full support (development + pre-trip planning) |

---

## Hosting & Domain

| Layer | Service | Notes |
|-------|---------|-------|
| Hosting | Railway | Auto-deploy from GitHub main branch |
| Domain | stateroad.fyi | Registered on Cloudflare |
| DNS | Cloudflare → Railway | One-click Railway/Cloudflare integration |
| SSL | Automatic (Railway) | HTTPS required for Meta Wearables Toolkit |

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

## Changelog

### v1.1.0 — 2026-09-04
- Added North Carolina (NC) state: `https://www.drivenc.gov/api/v2/get/cameras`
- Added Florida (FL) state: `https://fl511.com/api/v2/get/cameras`
- New UI: Barlow Condensed + Inter + JetBrains Mono typography
- New color system: amber (#F5C318) accent, dark navy bg (#0A0C12)
- State selector replaced with horizontal scrollable pill buttons
- CCTV scan-line CSS effect on all camera cards
- Camera ID corner tags (CAM-XXXX) + animated status pulse dots
- Branding updated to stateroad.fyi with road-icon SVG logo-mark
- Live camera count badge in header
- Status bar uses monospaced font for terminal aesthetic

### v1.0.0 — 2026-09-04
- Initial release: NY, GA, AZ, AK, NV, SF Bay, PA
- Express proxy server for CORS + image re-serving
- Vanilla JS SPA, dark theme, mobile-first

---

## Future Additions (Planned)

- [ ] Map view (Leaflet.js) showing camera pins by GPS coordinates
- [x] Florida (FL) — fl511.com/api/v2/get/cameras ✓
- [ ] More states (TX, CO, WA, OR — standard 511 APIs)
- [ ] Ohio (OH) — OHGO API (publicapi.ohgo.com) — different format, needs custom adapter
- [ ] Favorites / pinned cameras (localStorage)
- [ ] Meta Neural Band gesture support (swipe left/right to navigate cameras)
- [ ] Voice query integration (Meta AI → "show me I-95 cameras")
- [ ] Incident overlay (511 incident data alongside cameras)
- [ ] PWA manifest for installable phone app
