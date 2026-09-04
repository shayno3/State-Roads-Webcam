# Road Cams — Setup Guide
### Meta Ray-Ban Display Web App · State Road Camera Viewer

---

## What You're Building

A web app that runs on your **Meta Ray-Ban Display glasses** (via Meta's Wearables Toolkit Web App path) and shows live traffic camera snapshots from free state DOT 511 APIs. It also works great on any phone or browser.

---

## Step 1 — Get Your Free 511 API Keys

Each state's 511 system provides free API keys. Register at each portal you want to use:

| State | Register at | Notes |
|-------|-------------|-------|
| **New York** | https://511ny.org/developers/help | Instant approval |
| **Georgia** | https://511ga.org/developers/doc | Instant approval |
| **Arizona** | https://www.az511.com/developers/doc | Instant approval |
| **Alaska** | https://511.alaska.gov/developers/doc | Instant approval |
| **Nevada** | https://www.nvroads.com/developers/doc | Instant approval |
| **SF Bay (CA)** | https://511.org/open-data | Free, email registration |
| **Pennsylvania** | https://www.pa.gov/services/penndot/request-access-to-transportation-related-data-feeds | May take 1–2 days |

> All keys are **completely free** — the state DOTs publish this data as open public information.

---

## Step 2 — Install and Run the Server

### Requirements
- Node.js 18+ (https://nodejs.org)

### Install
```bash
git clone <your-repo>
cd roadcams-glasses
npm install
```

### Run
```bash
npm start
```

The server starts at **http://localhost:3000**

---

## Step 3 — Enter Your API Keys in the App

1. Open http://localhost:3000 in your browser
2. Tap the **⚙ Settings** button (top right)
3. Paste your API keys for each state
4. Tap **Save API Keys**
5. Select a state from the dropdown — cameras load instantly

---

## Step 4 — Connect to Meta Ray-Ban Display Glasses

Meta's **Wearables Toolkit** (released May 2026) lets web apps run on the glasses display.

### Requirements
- Meta Ray-Ban Display glasses
- Meta AI app on your phone (iOS 15.2+ or Android 10+)
- Developer mode enabled (see below)

### Enable Developer Mode
1. Open the **Meta AI app** on your phone
2. Go to **Settings → Ray-Ban Meta → Developer Options**
3. Enable **Developer Mode**

### Register as a Web App
1. Sign up at https://wearables.developer.meta.com
2. Create a new project → choose **Web App** SDK path
3. Set your app URL (use your local IP: `http://192.168.x.x:3000` or deploy publicly)
4. Follow Meta's instructions to sideload the web app to your glasses

### Testing Without the Glasses
The app works in any browser — open http://localhost:3000 on your phone or desktop to test the full UI and camera feeds before putting the glasses on.

---

## Step 5 — Deploy Publicly (Optional)

To access the app from anywhere (and for Meta's SDK to register it), deploy to a public URL:

### Option A: Railway (easiest, free tier available)
```bash
npm install -g @railway/cli
railway login
railway new
railway up
```

### Option B: Render
- Connect your GitHub repo at https://render.com
- Set start command: `npm start`
- Set environment: Node 18

### Option C: Your own server / VPS
```bash
PORT=3000 npm start
# Use nginx or Caddy as a reverse proxy with HTTPS
```

> Meta's Wearables Toolkit requires **HTTPS** for production web apps on the glasses.

---

## How the App Works

```
Ray-Ban Display Glasses
        ↕  (Meta Wearables Toolkit Web App protocol)
   Your Phone (Meta AI app)
        ↕  (local WiFi or internet)
   This Node.js Server  (localhost:3000 or your deployed URL)
        ↕  (proxied HTTPS requests, CORS handled)
   State 511 DOT APIs  (ny, ga, az, ak, nv, sf, pa)
        ↕
   Camera JPEG Snapshots
```

The proxy server is necessary because:
1. Browser security (CORS) blocks direct calls to state DOT APIs
2. The image proxy re-serves camera JPEGs with cache-busting so you always see the latest frame
3. API keys stay on the server, not exposed in the browser

---

## Supported States & Camera Counts (approximate)

| State | Cameras | Update Frequency |
|-------|---------|-----------------|
| New York | ~1,200 | 30–60 sec |
| Georgia | ~400 | 30–60 sec |
| Arizona | ~300 | 30 sec |
| Alaska | ~150 | 60 sec |
| Nevada | ~250 | 30 sec |
| SF Bay (CA) | ~200 | 30 sec |
| Pennsylvania | ~500 | 30–60 sec |

---

## Troubleshooting

**"API Key Required" message**
→ Open Settings and paste your key for that state.

**Camera images show a broken icon**
→ Some cameras are temporarily offline — tap the next one. The status dot (red/green) indicates availability.

**Server fails to start**
→ Make sure Node 18+ is installed: `node --version`

**Glasses can't reach the app**
→ Make sure your phone and glasses are on the same WiFi network, and use your machine's local IP address (not `localhost`).

---

## Tech Stack Reference

See `TECH_STACK.md` for the full reference log.
