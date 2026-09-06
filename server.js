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
  ga: 'https://services1.arcgis.com/2iUE8l8JKrP2tygQ/arcgis/rest/services/GDOT_Live_Traffic_Cameras/FeatureServer/0/query', // GDOT public ArcGIS – no key needed
  az: 'https://www.az511.com/api/v2/get/cameras',
  il: 'https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/TrafficCamerasTM_Public/FeatureServer/0/query', // IDOT public ArcGIS – no key needed
  ak: 'https://511.alaska.gov/api/v2/get/cameras',
  nv: 'https://www.nvroads.com/api/v2/get/cameras',
  sf: 'https://api.511.org/traffic/cameras',
  pa: 'https://www.511pa.com/api/v2/get/cameras',
  nc: 'https://www.drivenc.gov/api/v2/get/cameras',
  fl: 'https://services.arcgis.com/3wFbqsFPLeKqOlIK/arcgis/rest/services/FL511_Traffic_Cameras/FeatureServer/0/query', // public ArcGIS – no key needed
  ia: 'https://services.arcgis.com/8lRhdTsQyJpO52F1/arcgis/rest/services/Traffic_Cameras_View/FeatureServer/0/query', // Iowa DOT – public ArcGIS, no key needed
  hi: 'https://services.arcgis.com/6I1ysurtNWNxkuwd/arcgis/rest/services/HawaiiTrafficCameras/FeatureServer/0/query', // HDOT GoAkamai – public ArcGIS, no key needed (~168 cams)
  wa: 'https://wsdot.wa.gov/Traffic/api/HighwayCameras/HighwayCamerasREST.svc/GetCamerasAsJson', // WSDOT – AccessCode stored server-side
  // ── v1.2.0 additions (ibi511 platform, free registration) ────────
  oh: 'https://publicapi.ohgo.com/api/v1/cameras',          // OHGo – api-key param
  ca: 'https://cwwp2.dot.ca.gov/data',                        // Caltrans CWWP2 – no key, 12 districts
  wi: 'https://511wi.gov/api/v2/get/cameras',
  ut: 'https://www.udottraffic.utah.gov/api/v2/get/cameras',
  la: 'https://511la.org/api/v2/get/cameras',
  id: 'https://511.idaho.gov/api/v2/get/cameras',
  nj: 'https://www.511nj.org/api/v2/get/cameras',
  va: 'https://511.vdot.virginia.gov/services/map/layers/map/cams', // VDOT public GeoJSON – no key needed
  ne: 'https://511.nebraska.gov/api/v2/get/cameras',
  ks: 'https://www.kandrive.gov/api/v2/get/cameras',
  vt: 'https://www.511vt.org/api/v2/get/cameras',
  nh: 'https://www.511nh.com/api/v2/get/cameras',
  md: 'https://chartimap1.sha.maryland.gov/arcgis/rest/services/CHART/Cameras/MapServer/0/query', // CHART public ArcGIS – no key needed
  al: 'https://www.al511.com/api/v2/get/cameras',
  nm: 'https://nmroads.com/api/v2/get/cameras',
  mi: 'https://www.mi511.org/api/v2/get/cameras',
};


// ─── ArcGIS helpers ──────────────────────────────────────────────────

// Fetch all features from a paginated ArcGIS FeatureServer query endpoint
async function fetchArcGISAll(baseUrl, pageSize = 1000) {
  let allFeatures = [];
  let offset = 0;
  const cap = 8000; // safety cap

  while (allFeatures.length < cap) {
    const url = `${baseUrl}?where=1%3D1&outFields=*&f=json&resultRecordCount=${pageSize}&resultOffset=${offset}`;
    const resp = await axios.get(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'RoadCamsGlasses/1.0' },
      timeout: 20000,
    });
    const batch = resp.data?.features || [];
    allFeatures.push(...batch);
    if (!resp.data?.exceededTransferLimit || batch.length === 0) break;
    offset += batch.length;
  }
  return { features: allFeatures };
}

// Convert Web Mercator (WKID 3857) x/y to WGS84 lat/lon
function mercatorToWgs84(x, y) {
  const lon = x * 180 / 20037508.34;
  const lat = Math.atan(Math.exp(y * Math.PI / 20037508.34)) * 360 / Math.PI - 90;
  return { lat, lon };
}

// GET /api/cameras/:state?key=APIKEY
app.get('/api/cameras/:state', async (req, res) => {
  const { state } = req.params;
  const { key } = req.query;

  const baseUrl = STATE_ENDPOINTS[state];
  if (!baseUrl) {
    return res.status(400).json({ error: `Unknown state: ${state}` });
  }

  // FL / IA / HI use public ArcGIS FeatureServer — no API key required
  // VA uses VDOT public GeoJSON endpoint — no API key required
  let upstreamUrl;
  if (state === 'va') {
    // VDOT public GeoJSON — no key, fetch directly
    upstreamUrl = baseUrl;
  } else if (state === 'ga') {
    // GDOT public ArcGIS — Web Mercator coords, needs pagination + conversion
    console.log(`[cameras] GA → GDOT ArcGIS (paginated)`);
    try {
      const result = await fetchArcGISAll(baseUrl);
      // Convert Web Mercator geometry to WGS84 for each feature
      result.features = result.features.map(f => {
        if (f.geometry) {
          const { lat, lon } = mercatorToWgs84(f.geometry.x, f.geometry.y);
          f.geometry = { x: lon, y: lat };
        }
        return f;
      });
      console.log(`[cameras] GA → ${result.features.length} cameras`);
      return res.json(result);
    } catch (err) {
      const status = err.response?.status || 502;
      console.error(`[cameras] GA error ${status}:`, err.message);
      return res.status(status).json({ error: String(err.message) });
    }
  } else if (state === 'il') {
    // IDOT public ArcGIS — already WGS84/NAD83, needs pagination
    console.log(`[cameras] IL → IDOT ArcGIS (paginated)`);
    try {
      const result = await fetchArcGISAll(baseUrl);
      console.log(`[cameras] IL → ${result.features.length} cameras`);
      return res.json(result);
    } catch (err) {
      const status = err.response?.status || 502;
      console.error(`[cameras] IL error ${status}:`, err.message);
      return res.status(status).json({ error: String(err.message) });
    }
  } else if (state === 'fl' || state === 'ia' || state === 'hi') {
    upstreamUrl = `${baseUrl}?where=1%3D1&outFields=*&f=json&resultRecordCount=2000`;
  } else if (state === 'md') {
    // Maryland CHART public ArcGIS — no key needed; outSR=4326 returns WGS84 coords directly
    upstreamUrl = `${baseUrl}?where=1%3D1&outFields=*&f=json&outSR=4326&resultRecordCount=1000`;
  } else if (state === 'nv') {
    // Nevada nvroads.com — key stored server-side as NV_KEY env var
    const nvKey = process.env.NV_KEY;
    if (!nvKey) {
      return res.status(500).json({ error: 'NV_KEY environment variable not set on server' });
    }
    upstreamUrl = `${baseUrl}?key=${encodeURIComponent(nvKey)}`;
  } else if (state === 'ak') {
    // Alaska ibi511 — key stored server-side as AK_KEY env var
    const akKey = process.env.AK_KEY;
    if (!akKey) {
      return res.status(500).json({ error: 'AK_KEY environment variable not set on server' });
    }
    upstreamUrl = `${baseUrl}?key=${encodeURIComponent(akKey)}`;
  } else if (state === 'wa') {
    // WSDOT — AccessCode stored server-side as WSDOT_KEY env var
    const wsdotKey = process.env.WSDOT_KEY;
    if (!wsdotKey) {
      return res.status(500).json({ error: 'WSDOT_KEY environment variable not set on server' });
    }
    upstreamUrl = `${baseUrl}?AccessCode=${encodeURIComponent(wsdotKey)}`;
  } else if (state === 'ca') {
    // Caltrans CWWP2 — 12 districts, no API key required
    const districts = [1,2,3,4,5,6,7,8,9,10,11,12];
    console.log(`[cameras] CA → Caltrans CWWP2 (12 districts)`);
    const districtResults = await Promise.allSettled(
      districts.map(n => axios.get(
        `${baseUrl}/d${n}/cctv/cctvStatusD${String(n).padStart(2,'0')}.json`,
        { headers: { 'Accept': 'application/json', 'User-Agent': 'RoadCamsGlasses/1.0' }, timeout: 15000 }
      ))
    );
    const allCctv = [];
    districtResults.forEach(r => {
      if (r.status === 'fulfilled' && r.value.data?.data) allCctv.push(...r.value.data.data);
    });
    const ok = districtResults.filter(r => r.status === 'fulfilled').length;
    console.log(`[cameras] CA → ${allCctv.length} cameras from ${ok}/12 districts`);
    return res.json({ data: allCctv });
  } else {
    if (!key) {
      return res.status(400).json({ error: 'Missing API key (pass ?key=YOUR_KEY)' });
    }
    // SF Bay uses api_key, OHGo uses api-key, all other ibi511 states use key
    const paramName = state === 'sf' ? 'api_key' : state === 'oh' ? 'api-key' : 'key';
    upstreamUrl = `${baseUrl}?${paramName}=${encodeURIComponent(key)}`;
  }

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


// ─── ibi511 Weather / Road-Condition Stations ────────────────────────
// GET /api/weather/:state?key=APIKEY
// Returns road-weather station data (surface status, temps, wind, humidity).
// Uses the same developer key as /api/cameras/:state for each state.

const STATE_WEATHER_ENDPOINTS = {
  ak: 'https://511.alaska.gov/api/v2/get/weatherstations',
  ut: 'https://www.udottraffic.utah.gov/api/v2/get/weatherstations',
  nv: 'https://www.nvroads.com/api/v2/get/weatherstations',
  wi: 'https://511wi.gov/api/v2/get/weatherstations',
  id: 'https://511.idaho.gov/api/v2/get/weatherstations',
  la: 'https://511la.org/api/v2/get/weatherstations',
  va: 'https://511.vdot.virginia.gov/api/v2/get/weatherstations',
  ne: 'https://511.nebraska.gov/api/v2/get/weatherstations',
  nh: 'https://www.511nh.com/api/v2/get/weatherstations',
  vt: 'https://www.511vt.org/api/v2/get/weatherstations',
  ny: 'https://511ny.org/api/v2/get/weatherstations',
  pa: 'https://www.511pa.com/api/v2/get/weatherstations',
};

app.get('/api/weather/:state', async (req, res) => {
  const { state } = req.params;
  const { key } = req.query;

  const baseUrl = STATE_WEATHER_ENDPOINTS[state];
  if (!baseUrl) {
    return res.status(400).json({ error: `No weather stations for state: ${state}` });
  }
  if (!key) {
    return res.status(400).json({ error: 'Missing API key (pass ?key=YOUR_KEY)' });
  }

  const upstreamUrl = `${baseUrl}?key=${encodeURIComponent(key)}`;
  console.log(`[weather] ${state.toUpperCase()} → ${baseUrl}`);

  try {
    const response = await axios.get(upstreamUrl, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'RoadCamsGlasses/1.0' },
      timeout: 12000,
    });
    return res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 502;
    const msg    = err.response?.data || err.message;
    console.error(`[weather] ${state} error ${status}:`, msg);
    return res.status(status).json({ error: String(msg) });
  }
});

// ─── Windy Webcams ────────────────────────────────────────────────────
// GET /api/weather/webcams/:state  – Windy webcams for a US state bounding box
// WINDY_WEBCAMS_KEY stored server-side as Railway env var — never sent to browser

const STATE_BBOX = {
  al: { ne: [35.0,-84.9], sw: [30.1,-88.5] },
  ak: { ne: [71.5,-141.0], sw: [54.5,-179.9] },
  az: { ne: [37.0,-109.0], sw: [31.3,-114.8] },
  ca: { ne: [42.0,-114.1], sw: [32.5,-124.5] },
  fl: { ne: [31.0,-80.0], sw: [24.5,-87.6] },
  hi: { ne: [22.3,-154.8], sw: [18.9,-160.3] },
  ga: { ne: [35.0,-80.8], sw: [30.4,-85.6] },
  ia: { ne: [43.5,-90.1], sw: [40.4,-96.6] },
  id: { ne: [49.0,-111.0], sw: [41.9,-117.2] },
  ks: { ne: [40.0,-94.6], sw: [36.9,-102.1] },
  la: { ne: [33.0,-88.8], sw: [28.9,-94.0] },
  md: { ne: [39.7,-75.0], sw: [37.9,-79.5] },
  mi: { ne: [48.3,-82.4], sw: [41.7,-90.4] },
  nc: { ne: [36.6,-75.5], sw: [33.8,-84.3] },
  ne: { ne: [43.0,-95.3], sw: [40.0,-104.1] },
  nh: { ne: [45.3,-70.6], sw: [42.7,-72.6] },
  nj: { ne: [41.4,-73.9], sw: [38.9,-75.6] },
  nm: { ne: [37.0,-103.0], sw: [31.3,-109.1] },
  nv: { ne: [42.0,-114.0], sw: [35.0,-120.0] },
  ny: { ne: [45.0,-71.9], sw: [40.5,-79.8] },
  oh: { ne: [41.9,-80.5], sw: [38.4,-84.8] },
  pa: { ne: [42.3,-74.7], sw: [39.7,-80.5] },
  sf: { ne: [38.3,-121.4], sw: [37.1,-122.9] },
  ut: { ne: [42.0,-109.0], sw: [37.0,-114.1] },
  va: { ne: [39.5,-75.2], sw: [36.5,-83.7] },
  vt: { ne: [45.0,-71.5], sw: [42.7,-73.4] },
  wa: { ne: [49.0,-116.9], sw: [45.5,-124.8] },
  wi: { ne: [47.1,-86.2], sw: [42.5,-92.9] },
};

app.get('/api/weather/webcams/:state', async (req, res) => {
  const { state } = req.params;
  const windyKey = process.env.WINDY_WEBCAMS_KEY;
  if (!windyKey) return res.status(500).json({ error: 'WINDY_WEBCAMS_KEY not set on server' });

  const bbox = STATE_BBOX[state];
  if (!bbox) return res.status(400).json({ error: `No bounding box for state: ${state}` });

  const params = new URLSearchParams({
    limit: '50',
    offset: '0',
    lang: 'en',
    include: 'location,urls,images',
    'boundingBox[ne][lat]': bbox.ne[0],
    'boundingBox[ne][lng]': bbox.ne[1],
    'boundingBox[sw][lat]': bbox.sw[0],
    'boundingBox[sw][lng]': bbox.sw[1],
  });

  console.log(`[windy] ${state.toUpperCase()} webcams`);

  try {
    const response = await axios.get(`https://api.windy.com/webcams/api/v3/webcams?${params}`, {
      headers: {
        'x-windy-api-key': windyKey,
        'Accept': 'application/json',
      },
      timeout: 10000,
    });
    return res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 502;
    console.error(`[windy] ${state} error ${status}:`, err.message);
    return res.status(status).json({ error: err.message });
  }
});

// ─── HI Single-Camera Lookup ─────────────────────────────────────────
// GET /api/camera/hi/:id  – returns fresh metadata + IMAGE url for one HI camera
app.get('/api/camera/hi/:id', async (req, res) => {
  const { id } = req.params;
  const url = `https://services.arcgis.com/6I1ysurtNWNxkuwd/arcgis/rest/services/HawaiiTrafficCameras/FeatureServer/0/query?where=OBJECTID%3D${encodeURIComponent(id)}&outFields=*&f=json`;

  console.log(`[camera/hi] ${id}`);

  try {
    const response = await axios.get(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'RoadCamsGlasses/1.0' },
      timeout: 10000,
    });
    const features = response.data?.features || [];
    if (!features.length) return res.status(404).json({ error: 'Camera not found' });
    const a = features[0].attributes;
    const geo = features[0].geometry;
    return res.json({
      id:        a.OBJECTID,
      road:      a.Camera_Description || '—',
      location:  a.Camera_Description || '—',
      direction: '—',
      lat:       geo?.y,
      lon:       geo?.x,
      imageUrl:  a.camerastill || a.URL || '',
      timestamp: Date.now(),
    });
  } catch (err) {
    const status = err.response?.status || 502;
    console.error(`[camera/hi] error ${status}:`, err.message);
    return res.status(status).json({ error: err.message });
  }
});

// ─── FL Single-Camera Lookup ─────────────────────────────────────────
// GET /api/camera/fl/:id  – returns fresh metadata + IMAGE url for one FL camera
app.get('/api/camera/fl/:id', async (req, res) => {
  const { id } = req.params;
  const url = `https://services.arcgis.com/3wFbqsFPLeKqOlIK/arcgis/rest/services/FL511_Traffic_Cameras/FeatureServer/0/query?where=ID%3D'${encodeURIComponent(id)}'&outFields=*&f=json`;

  console.log(`[camera/fl] ${id}`);

  try {
    const response = await axios.get(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'RoadCamsGlasses/1.0' },
      timeout: 10000,
    });
    const features = response.data?.features || [];
    if (!features.length) return res.status(404).json({ error: 'Camera not found' });
    const a = features[0].attributes;
    return res.json({
      id:        a.ID,
      road:      a.HIGHWAY   || '—',
      location:  a.DESCRIPT  || a.COUNTY || '—',
      direction: a.DIRECTION || '—',
      lat:       a.LATITUDE,
      lon:       a.LONGITUDE,
      imageUrl:  a.IMAGE     || '',
      timestamp: a.TIMESTAMP,        // epoch ms from ArcGIS
    });
  } catch (err) {
    const status = err.response?.status || 502;
    console.error(`[camera/fl] error ${status}:`, err.message);
    return res.status(status).json({ error: err.message });
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
    version: '1.3.9',
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
