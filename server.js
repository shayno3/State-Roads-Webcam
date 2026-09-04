/**
 * Road Cams – Node.js/Express proxy server
 * Handles CORS for 511 state DOT APIs and image proxying
 * so the Meta Ray-Ban Display web app can fetch camera data.
 */

const express  = require('express');
const axios    = require('axios');
const path     = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── CORS headers for all responses ────────────────────────────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// ─── Serve frontend ─────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── 511 State Camera Endpoints ─────────────────────────────────────

const STATE_ENDPOINTS = {
  // ── v1.0 / v1.1 states ──────────────────────────────────────────
  ny: 'https://511ny.org/api/v2/get/cameras',
  ga: 'https://511ga.org/api/v2/get/cameras',
  az: 'https://www.az511.com/api/v2/get/cameras',
  ak: 'https://511.alaska.gov/api/v2/get/cameras',
  nv: 'https://www.nvroads.com/api/v2/get/cameras',
  sf: 'https://api.511.org/traffic/cameras',
  pa: 'https://www.511pa.com/api/v2/get/cameras',
  nc: 'https://www.drivenc.gov/api/v2/get/cameras',
  fl: 'https://fl511.com/api/v2/get/cameras',
  // ── v1.2.0 additions (ibi511 platform, free registration) ────────
  wi: 'https://511wi.gov/api/v2/get/cameras',
  ut: 'https://www.udottraffic.utah.gov/api/v2/get/cameras',
  la: 'https://511la.org/api/v2/get/cameras',
  id: 'https://511.idaho.gov/api/v2/get/cameras',
  nj: 'https://www.511nj.org/api/v2/get/cameras',
  va: 'https://511.vdot.virginia.gov/api/v2/get/cameras',
  ne: 'https://511.nebraska.gov/api/v2/get/cameras',
  ks: 'https://www.kandrive.gov/api/v2/get/cameras',
  vt: 'https://www.511vt.org/api/v2/get/cameras',
  nh: 'https://www.511nh.com/api/v2/get/cameras',
  md: 'https://md511.org/api/v2/get/cameras',
  al: 'https://www.al511.com/api/v2/get/cameras',
  nm: 'https://nmroads.com/api/v2/get/cameras',
  mi: 'https://www.mi511.org/api/v2/get/cameras',
};

// GET /api/cameras/:state?key=APIKEY
app.get('/api/cameras/:state', async (req, res) => {
  const { state } = req.params;
  const { key } = req.query;

  const baseUrl = STATE_ENDPOINTS[state];
  if (!baseUrl) {
    return res.status(400).json({ error: `Unknown state: ${state}` });
  }

  if (!key) {
    return res.status(400).json({ error: 'Missing API key (pass ?key=YOUR_KEY)' });
  }

  // Build upstream URL – SF Bay uses api_key param, others use key
  const paramName = state === 'sf' ? 'api_key' : 'key';
  const upstreamUrl = `${baseUrl}?${paramName}=${encodeURIComponent(key)}`;

  console.log(`[cameras] ${state.toUpperCase()} → ${baseUrl}`);

  try {
    const response = await axios.get(upstreamUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'RoadCamsGlasses/1.0',
      },
      timeout: 12000,
    });

    return res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 502;
    const msg    = err.response?.data || err.message;
    console.error(`[cameras] ${state} error ${status}:`, msg);
    return res.status(status).json({ error: String(msg) });
  }
});

// ─── Image Proxy ─────────────────────────────────────────────────────
// GET /api/image?url=ENCODED_URL&t=TIMESTAMP
// Fetches a camera JPEG snapshot and re-serves it with CORS headers.
// The timestamp query param busts browser/CDN caching for live feeds.

app.get('/api/image', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).send('Missing url parameter');
  }

  const decoded = decodeURIComponent(url);

  // Basic security: only allow http/https image URLs
  if (!/^https?:\/\//i.test(decoded)) {
    return res.status(400).send('Invalid URL scheme');
  }

  try {
    const response = await axios.get(decoded, {
      responseType: 'arraybuffer',
      headers: {
        'Accept': 'image/jpeg,image/png,image/*,*/*',
        'User-Agent': 'RoadCamsGlasses/1.0 (traffic camera viewer)',
        'Referer': decoded,           // some DOT servers check referer
      },
      timeout: 10000,
      maxRedirects: 5,
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'no-store');   // never cache live camera frames
    res.set('X-Camera-Url', decoded);
    res.send(Buffer.from(response.data));
  } catch (err) {
    const status = err.response?.status || 502;
    console.error(`[image] proxy error ${status} for ${decoded}`);
    res.status(status).send('Image unavailable');
  }
});

// ─── Health check ────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '1.2.0',
    states: Object.keys(STATE_ENDPOINTS),
    timestamp: new Date().toISOString(),
  });
});

// ─── Catch-all → frontend ────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚗 Road Cams server running at http://localhost:${PORT}`);
  console.log(`   States: ${Object.keys(STATE_ENDPOINTS).join(', ').toUpperCase()}`);
  console.log(`   Health: http://localhost:${PORT}/api/health\n`);
});
