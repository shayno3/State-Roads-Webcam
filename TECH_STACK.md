# Tech Stack Reference Log
## Road Cams — Meta Ray-Ban Display Web App

**Project:** roadcams-glasses  
**Version:** 1.3.9  
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
| **California** | **Caltrans CWWP2 — cwwp2.dot.ca.gov** | **None** | **data[].cctv{}** | **~3,343** | **Public, no key. 12 districts (D01–D12). Conditions of use.** |
| **Florida** | **ArcGIS FeatureServer — FL511 Traffic Cameras** | **None** | **features[]** | **~600** | **Public, no key** |
| **Iowa** | **ArcGIS FeatureServer — Iowa DOT Traffic Cameras** | **None** | **features[]** | **~1,252** | **Public, no key. CC BY 4.0** |
| **Washington** | **WSDOT HighwayCamerasREST — GetCamerasAsJson** | **Server-side env `WSDOT_KEY`** | **JSON array** | **~1,710** | **AccessCode via wsdot.wa.gov/traffic/api/** |
| SF Bay | 511.org/traffic/cameras | `?api_key=` | CCTV JSON | ~200 | Different param name |

**ibi511 platform standard:** Camera objects include `Id`, `Roadway`, `Direction`, `Location`, `Latitude`, `Longitude`, `Views[].Url`.  
**OHGo (OH):** `results[]` → `id`, `title`, `roadway`, `location`, `latitude`, `longitude`, `county-name`, `camera_views[].{id, url, direction}` — one normalized camera per view entry.
**CWWP2 (CA):** `data[].cctv` → `location.{district, locationName, nearbyPlace, route, county, latitude, longitude, direction}`, `inService`, `imageData.static.currentImageURL` — 12 district files fetched in parallel server-side.

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

**Windy Webcams API (server-keyed):** `GET /api/weather/webcams/:state` → bounding-box query → up to 50 webcams per state; `WINDY_WEBCAMS_KEY` env var on Railway — free tier, 15-min image token expiry.  
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

### v1.3.9 — 2026-09-06
- Added **Road Conditions UI** (index.html):
  - **Surface condition badges** on camera cards — colored overlay (Dry/Wet/Ice/Snow) using haversine nearest-station lookup within 75 km radius
  - **Road Conditions tab** (`🌡` header button) — dedicated view listing all weather stations with surface status pill, air temp, road temp, wind speed/direction, humidity, last updated
  - Weather data loads async after cameras — cards render instantly, badges appear once weather fetch completes
  - `haversineKm()`, `nearestStationSurface()`, `surfaceClass()`, `windDeg2Dir()`, `normalizeWeatherStations()`, `loadWeatherForState()`, `renderWeatherView()`, `showWeather()` added to JS
  - `WEATHER_STATES` constant: AK, UT, NV, WI, ID, LA, VA, NE, NH, VT, NY, PA (same API key as cameras)
  - CSS: `.surface-badge` (dry/wet/ice/snow/other), `.station-card`, `.condition-pill`, `.station-metrics`, weather-view layout
  - server.js: version bumped to 1.3.9

### v1.3.8 — 2026-09-06
- Added **ibi511 weather stations endpoint**: `GET /api/weather/:state?key=KEY`
  - 12 states: AK, UT, NV, WI, ID, LA, VA, NE, NH, VT, NY, PA
  - Same developer key as cameras endpoint — no additional registration needed
  - Fields per station: `Id`, `StationName`, `Latitude`, `Longitude`, `SurfaceStatus` (Dry/Wet/Ice/Snow), `AirTemperature`, `SurfaceTemp`, `WindSpeed`, `WindDirection`, `RelativeHumidity`, `CameraSourceId`, `LastUpdated`
  - `STATE_WEATHER_ENDPOINTS` map added to server.js; route added before Windy Webcams section
  - Foundation for road-condition overlays in the camera UI
  - server.js: version bumped to 1.3.8

### v1.3.7 — 2026-09-06
- Added **Hawaii (HI)**: HDOT GoAkamai cameras via public ArcGIS FeatureServer, ~168 cameras, no key needed
  - ArcGIS org: `6I1ysurtNWNxkuwd` → `HawaiiTrafficCameras/FeatureServer/0`
  - Fields: `OBJECTID`, `Camera_Description`, `camerastill` (image URL), `URL`, geometry `{x, y}`
  - Added `/api/camera/hi/:id` single-camera refresh endpoint
  - Added `hi` to `STATE_BBOX` for Windy webcams bounding box
  - server.js: version bumped to 1.3.7

### v1.3.6 — 2026-09-06
- Added **Windy Webcams API** endpoint: `GET /api/weather/webcams/:state`
  - Bounding-box query per state, returns up to 50 scenic/weather webcams
  - `WINDY_WEBCAMS_KEY` stored as Railway env var — never sent to browser
  - Free tier: image URLs expire after 15 min; covers all 27 app states
  - Proxy architecture: `STATE_BBOX` lookup → `api.windy.com/webcams/api/v3/webcams`
  - Foundation for future premium Weather Cams feature
  - server.js: version bumped to 1.3.6

### v1.3.5 — 2026-09-06
- Added **California (CA)**: Caltrans CWWP2 public API, ~3,343 cameras, no key needed
  - 12 district endpoints: `https://cwwp2.dot.ca.gov/data/d{n}/cctv/cctvStatusD{0n}.json`
  - Fields: `data[].cctv.{location.{route, county, lat, lon, direction, nearbyPlace}, inService, imageData.static.currentImageURL}`
  - Server fetches all 12 districts via `Promise.allSettled()`, combines into single response
  - Filters out `inService !== 'true'` cameras; locationName split at ' -- ' for road/location
  - Added to West region group; Settings shows "✓ PUBLIC FEED — NO KEY NEEDED"
  - server.js: CA branch returns early with multi-district data; version bumped to 1.3.5

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

### v1.4.0 — 2026-09-06 ⚠️ ROLLED BACK — cameras failed to load
> Reverted to v1.3.9. The redesign broke camera loading (fetch wiring incomplete).
> All items below are backlogged for a correct v1.4.0 re-implementation.

#### Backlog — to be added correctly in next redesign pass
- [ ] Bottom tab bar navigation (Cameras / Conditions / Settings) — `showTab()` + `.tab-bar` nav
- [ ] New dark token system — Inter + Barlow Condensed + JetBrains Mono fonts
- [ ] Active-state chips row below header (separate `#chips-row` div, not inline in trigger)
- [ ] State trigger label updates to state name when 1 selected, "States" + count badge when many
- [ ] FL district filter bar as its own slim scrollable row (separate from chips)
- [ ] Detail view hides tab bar on open; back button calls `showTab('list')` to restore
- [ ] `.camera-source` state tag per card (e.g. FL, WA, CO chip on camera card)
- [ ] Weather/Conditions view: 2-col `wx-card` grid (temp, wind, description, updated time)
- [ ] Settings view: toggle-style grid mode pref, ibi511 key input, About section v1.4.0
- [ ] Toast repositions for detail mode via `.detail-mode` class (`bottom: 12px` vs tab-h offset)
- [ ] `saveKeys()` calls `showTab('list')` instead of `showView('list')`
- [ ] `showWeather()` calls `showTab('weather')` instead of `showView('weather')`
- [ ] NC must stay in South region + IBI511_STATES (was accidentally dropped in v1.4.0 draft)

### v1.1.0 — 2026-09-04
- Added NC, FL (ibi511), new typography + color system, CCTV CSS effects, stateroad.fyi branding

### v1.0.0 — 2026-09-04
- Initial release: NY, GA, AZ, AK, NV, SF Bay, PA

---

## Future Additions (Planned)

### Pre-Launch (Before Public Release)
- [ ] Move all ibi511 API keys server-side (Railway env vars) — remove "bring your own key" model
- [ ] Remove/simplify Settings panel for end users
- [ ] Add rate limiting on Express proxy to protect upstream API quotas


- [x] Ohio (OH) — OHGo API (`publicapi.ohgo.com`) — free key registration; camera_views[] format (v1.3.4)
- [x] Washington (WA) — WSDOT Traveler Info API — AccessCode stored server-side as `WSDOT_KEY` (v1.3.3)
- [x] California (CA) — Caltrans CWWP2 — ~3,343 cameras, no key, 12-district parallel fetch (v1.3.5)
- [x] Hawaii (HI) — HDOT GoAkamai ArcGIS FeatureServer — ~168 cameras, no key, geometry lat/lon, camerastill image field (e463bb1)
- [ ] GA key — awaiting developer key from 511ga.org (~4,000 cameras)
- [ ] IA region filter bar — extend FL county bar to show IA REGION chips
- [ ] Map view (Leaflet.js) showing camera pins by GPS coordinates
- [ ] Favorites / pinned cameras (localStorage)
- [ ] Meta Neural Band gesture support (swipe left/right to navigate cameras)
- [ ] Voice query integration (Meta AI → "show me I-95 cameras")
- [ ] PWA manifest for installable phone app

## v1.4.x — Public Endpoint Upgrades

### GA — Switched to GDOT public ArcGIS (no key)
- Endpoint: `https://services1.arcgis.com/2iUE8l8JKrP2tygQ/arcgis/rest/services/GDOT_Live_Traffic_Cameras/FeatureServer/0/query`
- Paginated via `fetchArcGISAll()` (resultOffset loop, cap 8000)
- Geometry: Web Mercator (WKID 3857) → converted to WGS84 server-side via `mercatorToWgs84()`
- Image: `url` field → `http://navigator-c2c.dot.ga.gov/snapshots/<name>.jpg`

### IL — New state (IDOT public ArcGIS, no key)
- Endpoint: `https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/TrafficCamerasTM_Public/FeatureServer/0/query`
- Paginated via `fetchArcGISAll()`
- Geometry: already WGS84/NAD83 (x = lon, y = lat in attributes)
- Image: `SnapShot` field → `https://cctv.travelmidwest.com/snapshots/...jpg`
- Added to Midwest region

---

## Commit 11e4647 — 2026-09-06 — Bug fixes: IL TooOld filter, GA image hang

### IL fix
- **Problem**: `.filter(f => !f.attributes?.TooOld)` in `normalizeCameras()` (index.html) dropped all cameras when IDOT returned stale data (TooOld=true for all features), causing IL to display 0 results.
- **Fix**: Removed the TooOld filter entirely. All IDOT cameras now shown regardless of staleness flag.

### GA fix
- **Problem**: `navigator-c2c.dot.ga.gov` (the only image host in GDOT ArcGIS data) is IP-restricted from Railway's servers. The `/api/image` proxy timed out after 10 seconds, causing the detail view to hang before showing "Feed unavailable".
- **Fix**: Set `imageUrl: ''` in GA normalizer. Detail view now immediately shows "No feed URL available" instead of a 10-second hang. Camera list still shows all 3100+ GA cameras with location data.
- **Note**: No alternative public CDN found for GDOT camera snapshots. Only source is `http://navigator-c2c.dot.ga.gov/snapshots/<name>.jpg` which is IP-restricted. GA cameras are location-data only until an alternative image source is found.
- **Filter change**: GA normalizer filter changed from `f.attributes?.url` presence check to `f.attributes?.cctv_id || f.attributes?.OBJECTID` so cameras without a url field still appear.

### Files changed
- `public/index.html` — normalizeCameras() GA and IL blocks

---

## Commit 98b6ab4 — 2026-09-06 — Add Nevada (NV) cameras

### Data source
- **API**: `https://www.nvroads.com/api/v2/get/cameras?key=<NV_KEY>`
- **Provider**: Nevada DOT / nvroads.com
- **Format**: JSON array (not ArcGIS)
- **Cameras**: 101 total, Reno/Las Vegas metro area
- **Auth**: API key required → stored as Railway env var `NV_KEY` (never sent to browser)
- **Images**: `Views[0].Url` = `https://www.nvroads.com/map/Cctv/{id}` — public JPEG snapshot, no key needed
- **Coords**: `Latitude` / `Longitude` directly in WGS84
- **Filter**: Only cameras where `Views[0].Status === 'Enabled'`

### Key fields
- `Id` → camera id
- `Roadway` → road name
- `Views[0].Description` → location label
- `Direction` → direction (often "Unknown")
- `Latitude`, `Longitude` → WGS84
- `Views[0].Url` → snapshot image URL (public)
- `Views[0].VideoUrl` → HLS .m3u8 stream (not used — glasses app shows stills only)

### Files changed
- `server.js` — NV route added before AK block, uses `process.env.NV_KEY`
- `public/index.html` — NV STATE_CONFIGS `noKey:true`; NV normalizer before Iowa block

### Setup required
- Railway env var: `NV_KEY=<set in Railway dashboard>`

---

## Commit 42fe4cb — 2026-09-06 — Fix 502: escaped backticks in NV handler

### Problem
Server crashed on startup with `SyntaxError: Invalid or unexpected token` at the NV `upstreamUrl` template literal. Escaped backticks (`\``) were written instead of real backticks, causing Node to fail before handling any requests — resulting in a 502 Bad Gateway for the entire site.

### Fix
- `server.js` line 146: replaced `\`\${baseUrl}?key=\${encodeURIComponent(nvKey)}\`` with real backtick template literal

### Files changed
- `server.js` — one-line fix

---

## Commit 0f4bf97 — 2026-09-06 — Add Maryland (MD) cameras with HLS stream support

### Data source
- **API**: `https://chartimap1.sha.maryland.gov/arcgis/rest/services/CHART/Cameras/MapServer/0/query`
- **Provider**: Maryland CHART (Coordinated Highways Action Response Team)
- **Format**: ArcGIS MapServer public endpoint — no API key needed
- **Cameras**: ~552 statewide
- **Images**: No JPEG snapshots — HLS `.m3u8` streams only (field: `hlsurl`)
- **Coords**: `outSR=4326` → `geometry.x` (lon), `geometry.y` (lat) in WGS84

### HLS video support (new capability)
- **HLS.js 1.5.13** loaded from cdnjs in `<head>` — enables `.m3u8` playback in Chrome/Android
- Safari uses native `<video>` HLS support (no library needed)
- Card thumbnail: shows 📹 icon instead of broken `<img>` for `.m3u8` cameras
- Detail view: creates `<video autoplay muted playsinline>` element, attaches HLS.js
- Cleanup: `clearDetailTimers()` destroys HLS instance and removes `<video>` on navigation

### Key fields (ArcGIS attributes)
- `ID` → camera id
- `location` → road + location description
- `hlsurl` → HLS stream URL (`.m3u8`)
- `geometry.x`, `geometry.y` → WGS84 lon/lat (via `outSR=4326`)

### Files changed
- `server.js` — MD endpoint switched to ArcGIS; MD handler added with `outSR=4326`
- `public/index.html` — HLS.js CDN tag; MD `noKey:true`; MD normalizer; card template; `updateDetailImage()`; `clearDetailTimers()`

### Setup required
- None — CHART endpoint is fully public

---

## Commit f1656da — 2026-09-06 — Fix GA direct load, MD HLS proxy

### Georgia (GA) fix
- **Root cause**: `navigator-c2c.dot.ga.gov` image server is IP-restricted on Railway; previous fix cleared imageUrl entirely
- **Fix**: Restore imageUrl to HTTPS version of the `url` field; add `noProxy: true` flag on GA camera objects
- **Behavior**: Browser loads GA images directly (user's IP, not Railway) — no CORS restriction on `<img>` tags; onerror shows placeholder if unreachable
- **Files**: `public/index.html` — GA normalizer, card template, updateDetailImage

### Maryland (MD) HLS fix
- **Root cause**: `strmr5.sha.maryland.gov` HLS streaming server blocks CORS requests from browser; HLS.js cannot load .m3u8 directly
- **Fix**: Added `/api/hls?url=<encoded>` proxy endpoint to server.js; Railway server fetches and rewrites the playlist
- **M3U8 rewriting**: Relative segment URLs in playlist rewritten to absolute, then wrapped in `/api/hls?url=...`; segment .ts files piped as binary stream
- **updateDetailImage**: Now passes `/api/hls?url=<encoded_hlsurl>` to HLS.js instead of direct URL (applies to Safari too)
- **Files**: `server.js` — new /api/hls route; `public/index.html` — updateDetailImage HLS source

### Pending user actions
- **NV**: Set Railway env var `NV_KEY = <set in Railway dashboard>` in railway.app → stateroad-fyi → Variables
- **SF**: Register free API key at https://511.org/open-data/token — enter in Settings when loaded

---

## Commit 5337f2f — 2026-09-06 — SF Bay Area server-side key + GA noProxy fix

### SF Bay Area (SF) — key moved server-side
- **Root cause**: `api.511.org/traffic/cameras` requires a registered API key; original design required user to enter it in Settings
- **Fix**: Key stored as Railway env var `SF_KEY`; `noKey: true` added to SF STATE_CONFIGS — users no longer need to enter or know about the key
- **Key**: `<set in Railway dashboard>` (registered Shayne Thomas account)
- **Server handler**: `else if (state === 'sf')` block reads `process.env.SF_KEY` and returns 500 if missing
- **Files**: `server.js` — SF handler added; `public/index.html` — SF `noKey: true` in STATE_CONFIGS

### Railway env vars required
| Var | Value |
|-----|-------|
| `NV_KEY` | `<set in Railway dashboard>` |
| `SF_KEY` | `<set in Railway dashboard>` |
| `WSDOT_KEY` | (previously set) |
| `AK_KEY` | (previously set) |
| `WINDY_WEBCAMS_KEY` | (previously set) |

### Status after this commit
- ✅ **AK** — server-keyed (`AK_KEY`)
- ✅ **WA** — server-keyed (`WSDOT_KEY`)
- ✅ **NV** — server-keyed (`NV_KEY`) — `noKey: true`
- ✅ **SF Bay** — server-keyed (`SF_KEY`) — `noKey: true`
- ✅ **FL, IA, HI, CA, GA, MD** — public endpoints, no key needed
- ⚠️  **GA images** — `noProxy: true`; browser loads directly from `navigator-c2c.dot.ga.gov` (IP-restricted from Railway)
- ⚠️  **MD** — HLS streams via `/api/hls` proxy (CORS-restricted from browser)
