# Tech Stack Reference Log
## Road Cams — Meta Ray-Ban Display Web App

**Project:** roadcams-glasses  
**Version:** 1.3.4  
**Build Date:** 2026-09-06  
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
| State selector | Dropdown with region groups + checkboxes | v1.3.0 | Replaced pill bar |
| FL/IA filter bar | Scrollable county/region chip row | v1.3.0/1.3.2 | Appears after load, source-aware |
| Image loading | `<img>` tags via proxy endpoint | — | Cache-busting via `?t=timestamp` |
| Camera cards | CCTV scan-line CSS effect | v1.1.0 | `::after` repeating-linear-gradient |
| Branding | stateroad.fyi | v1.1.0 | Road icon logo-mark, amber accent |
| Meta SDK path | Web App (HTML/CSS/JS) | May 2026 | Via Meta Wearables Toolkit |
| Multi-state load | `Promise.allSettled()` parallel fetch | v1.2.0 | Partial failures don't block other states |

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

| State | API Platform | Auth | Format | Approx Cameras | Notes |
|-------|-------------|------|--------|----------------|-------|
| New York | ibi511 — 511ny.org/api/v2/get/cameras | `?key=` | JSON array | ~1,200 | |
| N. Carolina | ibi511 — drivenc.gov/api/v2/get/cameras | `?key=` | JSON array | ~300 | |
| Pennsylvania | ibi511 — 511pa.com/api/v2/get/cameras | `?key=` | JSON array | ~500 | |
| Georgia | ibi511 — 511ga.org/api/v2/get/cameras | `?key=` | JSON array | ~4,000 | Key pending |
| Arizona | ibi511 — az511.com/api/v2/get/cameras | `?key=` | JSON array | ~644 | |
| Nevada | ibi511 — nvroads.com/api/v2/get/cameras | `?key=` | JSON array | ~660 | |
| Alaska | ibi511 — 511.alaska.gov/api/v2/get/cameras | `?key=` | JSON array | ~1,074 | |
| Wisconsin | ibi511 — 511wi.gov/api/v2/get/cameras | `?key=` | JSON array | ~491 | |
| Utah | ibi511 — udottraffic.utah.gov/api/v2/get/cameras | `?key=` | JSON array | ~2,090 | |
| Louisiana | ibi511 — 511la.org/api/v2/get/cameras | `?key=` | JSON array | — | |
| Idaho | ibi511 — 511.idaho.gov/api/v2/get/cameras | `?key=` | JSON array | ~433 | |
| New Jersey | ibi511 — 511nj.org/api/v2/get/cameras | `?key=` | JSON array | — | |
| Virginia | ibi511 — 511.vdot.virginia.gov/api/v2/get/cameras | `?key=` | JSON array | — | |
| Nebraska | ibi511 — 511.nebraska.gov/api/v2/get/cameras | `?key=` | JSON array | — | |
| Kansas | ibi511 — kandrive.gov/api/v2/get/cameras | `?key=` | JSON array | — | |
| Vermont | ibi511 — 511vt.org/api/v2/get/cameras | `?key=` | JSON array | — | |
| New Hampshire | ibi511 — 511nh.com/api/v2/get/cameras | `?key=` | JSON array | — | |
| Maryland | ibi511 — md511.org/api/v2/get/cameras | `?key=` | JSON array | — | |
| Alabama | ibi511 — al511.com/api/v2/get/cameras | `?key=` | JSON array | — | |
| New Mexico | ibi511 — nmroads.com/api/v2/get/cameras | `?key=` | JSON array | — | |
| Michigan | ibi511 — mi511.org/api/v2/get/cameras | `?key=` | JSON array | — | |
| **Ohio** | **OHGo REST API — publicapi.ohgo.com** | **`?api-key=`** | **results[].camera_views[]** | **~600** | **Free key: publicapi.ohgo.com/docs/registration** |
| **Florida** | **ArcGIS FeatureServer — FL511 Traffic Cameras** | **None** | **features[]** | **~600** | **Public, no key** |
| **Iowa** | **ArcGIS FeatureServer — Iowa DOT Traffic Cameras** | **None** | **features[]** | **~1,252** | **Public, no key. CC BY 4.0** |
| **Washington** | **WSDOT HighwayCamerasREST — GetCamerasAsJson** | **Server-side env `WSDOT_KEY`** | **JSON array** | **~1,710** | **AccessCode via wsdot.wa.gov/traffic/api/** |
| SF Bay | 511.org/traffic/cameras | `?api_key=` | CCTV JSON | ~200 | Different param name |

**ibi511 platform standard:** Camera objects include `Id`, `Roadway`, `Direction`, `Location`, `Latitude`, `Longitude`, `Views[].Url`.  
**OHGo (OH):** `results[]` → `id`, `title`, `roadway`, `location`, `latitude`, `longitude`, `county-name`, `camera_views[].{id, url, direction}` — one normalized camera per view entry.

**ArcGIS (FL):** `features[].attributes` → `ID`, `HIGHWAY`, `DESCRIPT`, `COUNTY`, `DIRECTION`, `LATITUDE`, `LONGITUDE`, `IMAGE`, `TIMESTAMP`  
**ArcGIS (IA):** `features[].attributes` → `COMMON_ID`, `device_id`, `Route`, `Desc_`, `latitude`, `longitude`, `ImageURL`, `REGION`, `FUNCTION`  
**WSDOT (WA):** JSON array of Camera objects → `CameraID`, `Title`, `Description`, `Region`, `DisplayLatitude`, `DisplayLongitude`, `ImageURL`, `IsActive`, `CameraLocation.Latitude/Longitude`  
**FL single-camera refresh:** `GET /api/camera/fl/:id` → fresh IMAGE URL + TIMESTAMP every 30s in /view.html  
**IA ArcGIS org ID:** `8lRhdTsQyJpO52F1` | **FL ArcGIS org ID:** `3wFbqsFPLeKqOlIK`

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
  → GET /api/cameras/:state?key=KEY   → Express → 511/ArcGIS DOT API → JSON
  → GET /api/camera/fl/:id            → Express → FL ArcGIS single-camera → JSON
  → GET /api/image?url=ENCODED_URL    → Express → DOT image server → JPEG
  → GET /api/health                   → Express → { status, version, states }
  → GET /*                            → Express → public/index.html (SPA)
```

**noKey states (FL, IA):** Server builds ArcGIS FeatureServer URL directly — no key required.  
**noKey server-keyed (WA):** Client sends no key; server injects `WSDOT_KEY` env var — key never reaches browser.  
**All other states:** Client passes `?key=` from localStorage; key never exposed client-side.  
**Why a proxy?** CORS (511 APIs don't send ACAO headers), key security, image re-serving (Referer/UA checks), cache-busting.

---

## File Structure

```
roadcams-glasses/
├── public/
│   ├── index.html        # Main SPA: state selector, camera grid, settings
│   └── view.html         # Single-camera Glasses View with FL live refresh
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

### v1.3.4 — 2026-09-06
- Added **Ohio (OH)**: OHGo public REST API, ~600 cameras, free key at publicapi.ohgo.com
  - Endpoint: `https://publicapi.ohgo.com/api/v1/cameras?api-key=KEY`
  - Fields: `results[].{id, title, roadway, location, latitude, longitude, county-name, camera_views[].{id, url, direction}}`
  - One camera card per `camera_views` entry (multiple angles per location)
  - server.js: OH branch uses `api-key` param (not `key`); version bumped to 1.3.4
  - Added to Midwest region group; settings input + OHGo registration link

### v1.3.3 — 2026-09-05
- Added **Washington (WA)**: WSDOT HighwayCameras REST API, ~1,710 cameras, AccessCode stored server-side
  - Endpoint: `https://wsdot.wa.gov/Traffic/api/HighwayCameras/HighwayCamerasREST.svc/GetCamerasAsJson?AccessCode=KEY`
  - Fields: `CameraID`, `Title`, `Description`, `Region`, `DisplayLatitude`, `DisplayLongitude`, `ImageURL`, `IsActive`
  - AccessCode stored as `WSDOT_KEY` env var on Railway — never sent to browser
  - Added WA normalizeCameras branch (filters `IsActive === false`); Region → county for future filter bar
  - Added to West region group; Settings shows "✓ WSDOT — KEY STORED SERVER-SIDE"
  - server.js: WA branch injects server-side key; version bumped to 1.3.3

### v1.3.2 — 2026-09-05
- Added **Iowa (IA)**: Iowa DOT public ArcGIS FeatureServer, 1,252 cameras, no key needed (CC BY 4.0)
  - Endpoint: `https://services.arcgis.com/8lRhdTsQyJpO52F1/.../Traffic_Cameras_View/FeatureServer/0/query`
  - Fields: `COMMON_ID`, `Route`, `Desc_`, `ImageURL`, `latitude`, `longitude`, `REGION`
  - Added IA normalizeCameras branch; REGION → county field for future filter bar
  - Added to Midwest region group; Settings shows "✓ PUBLIC FEED — NO KEY NEEDED"
- server.js: ArcGIS branch now handles `fl || ia`; version bumped to 1.3.2

### v1.3.1 — 2026-09-04
- Bug fixes:
  - `countyOk` filter was hiding non-FL cameras when FL county selected → fixed source guard
  - `selectCounty()` active state used unreliable `event.currentTarget` → switched to `buildFlFilterBar()` re-render
  - Inline onclick quote escaping for county names → switched to `data-county` + `dataset.county`

### v1.3.0 — 2026-09-04
- **Florida (FL)**: switched from ibi511 to public ArcGIS FeatureServer (no key needed)
  - Endpoint: `https://services.arcgis.com/3wFbqsFPLeKqOlIK/.../FL511_Traffic_Cameras/FeatureServer/0/query`
  - Fields: `ID`, `HIGHWAY`, `DESCRIPT`, `COUNTY`, `DIRECTION`, `LATITUDE`, `LONGITUDE`, `IMAGE`, `TIMESTAMP`
- **FL county filter bar**: scrollable chips below state selector, resets on state change
- **FL live refresh in /view.html**: `GET /api/camera/fl/:id` every 30s, shows "cam Xs ago" in HUD
- **State selector**: replaced pill bar with dropdown (region groups + checkboxes)
- **Multi-state loading**: `Promise.allSettled()` — partial state failures don't block others
- server.js v1.3.0: new `/api/camera/fl/:id` single-camera route

### v1.2.0 — 2026-09-04
- Added 13 more ibi511 states: WI, UT, LA, ID, NJ, VA, NE, KS, VT, NH, MD, AL, NM, MI

### v1.1.0 — 2026-09-04
- Added NC, FL (ibi511), new typography + color system, CCTV CSS effects, stateroad.fyi branding

### v1.0.0 — 2026-09-04
- Initial release: NY, GA, AZ, AK, NV, SF Bay, PA

---

## Future Additions (Planned)

- [x] Ohio (OH) — OHGo API (`publicapi.ohgo.com`) — free key registration; camera_views[] format (v1.3.4)
- [x] Washington (WA) — WSDOT Traveler Info API — AccessCode stored server-side as `WSDOT_KEY` (v1.3.3)
- [ ] California (CA) — Caltrans CWWP2 — 3,343 cameras; API format TBD
- [ ] GA key — awaiting developer key from 511ga.org (~4,000 cameras)
- [ ] IA region filter bar — extend FL county bar to show IA REGION chips
- [ ] Map view (Leaflet.js) showing camera pins by GPS coordinates
- [ ] Favorites / pinned cameras (localStorage)
- [ ] Meta Neural Band gesture support (swipe left/right to navigate cameras)
- [ ] Voice query integration (Meta AI → "show me I-95 cameras")
- [ ] PWA manifest for installable phone app
