/**
 * Road Cams – Node.js/Express proxy server
 * Handles CORS for 511 state DOT APIs and image proxying
 * so the Meta Ray-Ban Display web app can fetch camera data.
 */

const express  = require('express');
const axios    = require('axios');
const dns      = require('dns').promises;
const { parseStringPromise } = require('xml2js');
const path     = require('path');
const { authRouter, adminRouter } = require('./auth');

// ─── NEC Compass C2C cache (NH / VT / ME) ──────────────────────────────────
const NEC_BASE = 'https://nec-por.ne-compass.com/NEC.XmlDataPortal/api/c2c';
const NEC_NETWORK = { nh: 'NewHampshire', vt: 'Vermont', me: 'Maine' };
// In-memory snapshot cache: { network: { ts, snapsByid } }
const necSnapshotCache = {};
const NEC_CACHE_TTL = 60000; // 60 seconds

async function fetchNecSnapshots(network) {
  const cached = necSnapshotCache[network];
  if (cached && Date.now() - cached.ts < NEC_CACHE_TTL) return cached.snaps;
  const r = await axios.get(NEC_BASE, {
    params: { networks: network, dataTypes: 'cctvSnapshotData' },
    headers: { 'Accept': 'application/xml', 'User-Agent': 'RoadCamsGlasses/1.0' },
    timeout: 15000,
    responseType: 'text',
  });
  const parsed = await parseStringPromise(r.data, { explicitArray: false });
  // Try multiple XML paths — NEC structure may vary
  const snapData = parsed?.status?.cctvSnapshotData;
  const net = snapData?.net || snapData;
  const camList = net?.cctvSnapshot || [];
  const cams = Array.isArray(camList) ? camList : (camList && typeof camList === 'object' ? [camList] : []);
  console.log(`[NEC snaps] ${network}: ${cams.length} snapshots returned`);
  if (cams.length > 0) {
    const sample = cams[0];
    console.log(`[NEC snaps] sample keys: ${Object.keys(sample).join(', ')}`);
    if (sample['$']) console.log(`[NEC snaps] sample $ keys: ${Object.keys(sample['$']).join(', ')}`);
  }
  const snaps = {};
  for (const cam of cams) {
    // ID: try XML attribute ($), then child element, then deviceId
    const id = cam?.['$']?.id || cam?.id || cam?.deviceId || cam?.cameraId;
    // snippet: direct string, xml2js text node (_), or snapshotData
    const snippet = (typeof cam?.snippet === 'string' ? cam.snippet : cam?.snippet?._ )
                 || (typeof cam?.snapshotData === 'string' ? cam.snapshotData : cam?.snapshotData?._ )
                 || '';
    if (id && snippet) snaps[id] = snippet;
    // Also index by camera name so status-data IDs (name-style) can match
    if (cam?.name && snippet && cam.name !== id) snaps[cam.name] = snippet;
  }
  console.log(`[NEC snaps] ${network}: ${Object.keys(snaps).length} valid id+snippet pairs`);
  necSnapshotCache[network] = { ts: Date.now(), snaps };
  return snaps;
}

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

// ─── CORS headers for all responses ────────────────────────────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// ─── Serve frontend ─────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Auth & Admin routes ─────────────────────────────────────────────
app.use('/api/auth',  authRouter);
app.use('/api/admin', adminRouter);

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

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
  me: 'https://nec-por.ne-compass.com/NEC.XmlDataPortal/api/c2c',   // NEC Compass C2C – public, no key; handler intercepts
  md: 'https://chartimap1.sha.maryland.gov/arcgis/rest/services/CHART/Cameras/MapServer/0/query', // CHART public ArcGIS – no key needed
  al: 'https://www.al511.com/api/v2/get/cameras',
  nm: 'https://servicev5.nmroads.com/RealMapWAR/GetCameraInfo', // NMRoads public – no key needed
  co: 'https://api-511x-co.carsprogram.org/cameras/map-features',      // COTrip – public GeoJSON, no key needed
  mi: 'https://www.mi511.org/api/v2/get/cameras',
  tx: 'https://its.txdot.gov/its/DistrictIts/GetCctvStatusListByDistrict', // TxDOT ITS – public, no key; handler builds per-district URLs (entry exists so the route guard passes)
  ky: 'https://services2.arcgis.com/CcI36Pduqd0OR4W9/arcgis/rest/services/trafficCamerasCur_Prd/FeatureServer/0/query', // KYTC public ArcGIS – no key needed
  or: 'https://api.odot.state.or.us/tripcheck/cctv/inventory', // TripCheck API – ODOT_KEY env; handler intercepts (see ODOT_CCTV_URL)
};

// ─── Oregon TripCheck (ODOT developer portal, Azure APIM) ──────────
// Free subscription key: sign up at apiportal.odot.state.or.us, subscribe to
// "TripCheck Data", then set ODOT_KEY in the server environment. The key is
// sent as the Ocp-Apim-Subscription-Key header (per ODOT's Getting Started
// guide). If the gateway path ever differs from the default below, copy the
// Request URL from the portal's "Try it" console into ODOT_CCTV_URL — no code
// change needed.
const ODOT_CCTV_URL = process.env.ODOT_CCTV_URL || STATE_ENDPOINTS.or;


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
        // Rewrite navigator-c2c image URL through our proxy (avoids mixed-content + remote timeouts)
        if (f.attributes?.url) {
          const m = f.attributes.url.match(/snapshots\/([^?#]+)$/);
          if (m) f.attributes.url = `/api/image/ga/${m[1]}`;
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
  } else if (state === 'fl' || state === 'ia' || state === 'hi' || state === 'ky') {
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
  } else if (state === 'id') {
    // Idaho 511 (ibi511) — key stored server-side as ID_KEY env var
    const idKey = process.env.ID_KEY;
    if (!idKey) {
      return res.status(500).json({ error: 'ID_KEY environment variable not set on server' });
    }
    upstreamUrl = `${baseUrl}?key=${encodeURIComponent(idKey)}`;
  } else if (state === 'wi') {
    // Wisconsin 511 (ibi511) — key stored server-side as WI_KEY env var
    const wiKey = process.env.WI_KEY;
    if (!wiKey) {
      return res.status(500).json({ error: 'WI_KEY environment variable not set on server' });
    }
    upstreamUrl = `${baseUrl}?key=${encodeURIComponent(wiKey)}`;
  } else if (state === 'ut') {
    // Utah UDOT Traffic (ibi511) — key stored server-side as UT_KEY env var
    const utKey = process.env.UT_KEY;
    if (!utKey) {
      return res.status(500).json({ error: 'UT_KEY environment variable not set on server' });
    }
    upstreamUrl = `${baseUrl}?key=${encodeURIComponent(utKey)}`;
  } else if (state === 'az') {
    // Arizona AZ 511 (TravelIQ/ibi511) — key stored server-side as AZ_KEY env var
    const azKey = process.env.AZ_KEY;
    if (!azKey) {
      return res.status(500).json({ error: 'AZ_KEY environment variable not set on server' });
    }
    upstreamUrl = `${baseUrl}?key=${encodeURIComponent(azKey)}`;
  } else if (state === 'wa') {
    // WSDOT — AccessCode stored server-side as WSDOT_KEY env var
    const wsdotKey = process.env.WSDOT_KEY;
    if (!wsdotKey) {
      return res.status(500).json({ error: 'WSDOT_KEY environment variable not set on server' });
    }
    upstreamUrl = `${baseUrl}?AccessCode=${encodeURIComponent(wsdotKey)}`;
  } else if (state === 'oh') {
    // OHGo — api-key stored server-side as OH_KEY env var
    const ohKey = process.env.OH_KEY;
    if (!ohKey) {
      return res.status(500).json({ error: 'OH_KEY environment variable not set on server' });
    }
    upstreamUrl = `${baseUrl}?api-key=${encodeURIComponent(ohKey)}`;
  } else if (state === 'co') {
    // Colorado COTrip — public GeoJSON endpoint, no API key required
    // Endpoint: api-511x-co.carsprogram.org/cameras/map-features
    // Returns GeoJSON FeatureCollection with 1000+ cameras
    console.log(`[cameras] CO → COTrip carsprogram.org (public)`);
    try {
      const response = await axios.get(baseUrl, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'RoadCamsGlasses/1.0' },
        timeout: 15000,
      });
      const body = response.data;
      console.log(`[cameras] CO → ${body?.features?.length ?? 0} cameras`);
      return res.json(body);
    } catch (err) {
      const status = err.response?.status || 502;
      console.error(`[cameras] CO error ${status}:`, err.message);
      return res.status(status).json({ error: err.message });
    }
  } else if (state === 'or') {
    // Oregon TripCheck — ODOT developer portal subscription key, server-side only.
    // Response may be JSON or XML depending on the gateway's content negotiation;
    // both are normalized here to the app's camera shape (server pre-normalized,
    // like TX / NEC), so the frontend passes the array straight through.
    const odotKey = process.env.ODOT_KEY;
    if (!odotKey) {
      return res.status(500).json({ error: 'ODOT_KEY environment variable not set on server' });
    }
    console.log(`[cameras] OR → TripCheck CCTV inventory`);
    try {
      const response = await axios.get(ODOT_CCTV_URL, {
        headers: {
          'Accept': 'application/json',
          'Ocp-Apim-Subscription-Key': odotKey,
          'User-Agent': 'RoadCamsGlasses/1.0',
        },
        timeout: 20000,
        responseType: 'text',
      });
      let data = response.data;
      if (typeof data === 'string') {
        const trimmed = data.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          data = JSON.parse(trimmed);
        } else {
          data = await parseStringPromise(trimmed, { explicitArray: false });
        }
      }
      // Find the camera array wherever the feed nests it
      const findCamArray = (node, depth = 0) => {
        if (!node || depth > 4) return null;
        if (Array.isArray(node)) {
          return node.some(el => el && typeof el === 'object' &&
            ('latitude' in el || 'Latitude' in el || 'still-image-url' in el || 'imageUrl' in el)) ? node : null;
        }
        if (typeof node === 'object') {
          for (const v of Object.values(node)) {
            const found = findCamArray(v, depth + 1);
            if (found) return found;
          }
        }
        return null;
      };
      const rawCams = findCamArray(data) || [];
      const pick = (obj, names) => {
        for (const n of names) if (obj[n] !== undefined && obj[n] !== '') return obj[n];
        return undefined;
      };
      const cameras = rawCams
        .map((cam, i) => {
          const c = cam && typeof cam === 'object' ? cam : {};
          return {
            id:        String(pick(c, ['cctv-id', 'cctvId', 'cameraId', 'id', 'deviceId']) ?? `or_${i}`),
            road:      pick(c, ['route', 'route-id', 'highway', 'roadway', 'road']) || '—',
            location:  pick(c, ['camera-name', 'location-name', 'name', 'location', 'description']) || '—',
            direction: pick(c, ['direction', 'camera-direction']) || '',
            lat:       parseFloat(pick(c, ['latitude', 'lat', 'Latitude'])) || 0,
            lon:       parseFloat(pick(c, ['longitude', 'lon', 'lng', 'Longitude'])) || 0,
            imageUrl:  pick(c, ['still-image-url', 'stillImageUrl', 'image-url', 'imageUrl', 'imageURL', 'url']) || '',
            county:    pick(c, ['county', 'region']) || '',
            status:    'active',
            source:    'or',
          };
        })
        .filter(cam => cam.lat && cam.lon && cam.imageUrl);
      console.log(`[cameras] OR → ${cameras.length} cameras`);
      return res.json(cameras);
    } catch (err) {
      const status = err.response?.status || 502;
      console.error(`[cameras] OR error ${status}:`, err.message);
      return res.status(status).json({ error: err.message });
    }
  } else if (state === 'nm') {
    // New Mexico — NMRoads public endpoint, no API key required
    console.log(`[cameras] NM → NMRoads GetCameraInfo (public)`);
    try {
      const response = await axios.get(baseUrl, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'RoadCamsGlasses/1.0' },
        timeout: 12000,
      });
      return res.json(response.data);
    } catch (err) {
      const status = err.response?.status || 502;
      console.error(`[cameras] NM error ${status}:`, err.message);
      return res.status(status).json({ error: err.message });
    }
  } else if (state === 'nh' || state === 'vt' || state === 'me') {
    // NEC Compass C2C — public API, no key required (NH, VT, ME)
    const necNet = NEC_NETWORK[state];
    console.log(`[cameras] ${state.toUpperCase()} → NEC Compass C2C (${necNet})`);
    try {
      const r = await axios.get(NEC_BASE, {
        params: { networks: necNet, dataTypes: 'cctvStatusData' },
        headers: { 'Accept': 'application/xml', 'User-Agent': 'RoadCamsGlasses/1.0' },
        timeout: 15000,
        responseType: 'text',
      });
      const parsed = await parseStringPromise(r.data, { explicitArray: false });
      const camList = parsed?.status?.cctvStatusData?.net?.cctvStatus || [];
      const cams = Array.isArray(camList) ? camList : [camList];
      const cameras = cams
        .filter(cam => cam && cam['$'] && cam['$'].id)
        .map(cam => {
          const id  = cam['$'].id;
          const lat = parseInt(cam.lat, 10) / 1e6 || 0;
          const lon = parseInt(cam.lon, 10) / 1e6 || 0;
          return {
            id:        `${state}_${id}`,
            road:      (cam.equipLoc && cam.equipLoc.roadway) || '—',
            location:  cam.name || id,
            direction: (cam.equipLoc && cam.equipLoc.direction) || '',
            lat,
            lon,
            imageUrl:  `/api/image/ne/${necNet}?id=${encodeURIComponent(cam.name || id)}`,
            county:    '',
            status:    cam.status === 'Device Online' ? 'active' : 'inactive',
            source:    state,
          };
        });
      console.log(`[cameras] ${state.toUpperCase()} → ${cameras.length} cameras`);
      return res.json(cameras);
    } catch (err) {
      console.error(`[cameras] ${state.toUpperCase()} NEC error:`, err.message);
      return res.status(502).json({ error: err.message });
    }
  } else if (state === 'sf') {
    // SF Bay Area — 511.org only offers events/toll/WZDx; no cameras endpoint exists.
    // Bay Area freeway cameras are covered by CA (Caltrans D4).
    console.log('[cameras] SF → no camera feed; returning empty array');
    return res.json([]);
  } else if (state === 'tx') {
    // TxDOT ITS — public API, no API key required.
    // TX_KEY in Railway env is for DriveTexas road conditions (WZDX feed), not cameras.
    const TX_DISTRICTS = ['ABL','AMA','ATL','AUS','BMT','BWD','BRY','CDS','CRP','DAL',
                          'ELP','FTW','HOU','LRD','LBB','LFK','ODA','PAR','PHR','SJT',
                          'SAT','TYL','WAC','WFS','YKM'];
    const TX_BASE = 'https://its.txdot.gov/its/DistrictIts/GetCctvStatusListByDistrict?districtCode=';
    const txResults = await Promise.allSettled(
      TX_DISTRICTS.map(async dist => {
        const response = await axios.get(TX_BASE + dist, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'RoadCamsGlasses/1.0' },
          timeout: 10000,
        });
        return { dist, data: response.data };
      })
    );
    const txCameras = [];
    for (const result of txResults) {
      if (result.status !== 'fulfilled') continue;
      const { dist, data } = result.value;
      const roadways = data.roadwayCctvStatuses || {};
      for (const [road, cams] of Object.entries(roadways)) {
        for (const cam of cams) {
          if (!cam.hasSnapshot) continue;
          txCameras.push({
            id:        `tx_${dist}_${cam.icd_Id || cam.name}`,
            road:      (cam.equipLoc && cam.equipLoc.roadway) || road,
            location:  cam.name,
            direction: cam.dirDescription || '',
            lat:       cam.latitude  || 0,
            lon:       cam.longitude || 0,
            imageUrl:  `https://its.txdot.gov/ITS_WEB/FrontEnd/snapshots/${encodeURIComponent(cam.name)}_${dist}.jpg`,
            county:    dist,
            status:    cam.statusDescription === 'Device Online' ? 'active' : 'inactive',
            source:    'tx',
          });
        }
      }
    }
    const txOk = txResults.filter(r => r.status === 'fulfilled').length;
    console.log(`[cameras] TX → ${txCameras.length} cameras from ${txOk}/25 districts`);
    return res.json(txCameras);
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
    // Key migration: prefer the server-side <STATE>_KEY env var (set in Railway);
    // fall back to a user-supplied ?key= so existing saved keys keep working.
    const effectiveKey = process.env[`${state.toUpperCase()}_KEY`] || key;
    if (!effectiveKey) {
      return res.status(400).json({ error: 'Missing API key (pass ?key=YOUR_KEY)' });
    }
    // SF Bay uses api_key, OHGo uses api-key, all other ibi511 states use key
    const paramName = state === 'sf' ? 'api_key' : state === 'oh' ? 'api-key' : 'key';
    upstreamUrl = `${baseUrl}?${paramName}=${encodeURIComponent(effectiveKey)}`;
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



// ─── NEC Compass image proxy (NH / VT / ME camera snapshots) ────────────────
app.get('/api/image/ne/:network', async (req, res) => {
  const { network } = req.params;
  const { id } = req.query;
  if (!id || !['NewHampshire','Vermont','Maine'].includes(network)) {
    return res.status(400).json({ error: 'Invalid network or missing id' });
  }
  try {
    const snaps = await fetchNecSnapshots(network);
    const b64 = snaps[id];
    if (!b64) return res.status(204).end(); // no snapshot available
    const buf = Buffer.from(b64, 'base64');
    res.set({ 'Content-Type': 'image/jpeg', 'Content-Length': buf.length,
               'Cache-Control': 'public, max-age=60' });
    return res.end(buf);
  } catch (err) {
    console.error(`[image/ne] ${network}/${id} error:`, err.message);
    return res.status(502).json({ error: err.message });
  }
});

// ─── GDOT GA camera image proxy ─────────────────────────────────────────────
// Fetches from navigator-c2c.dot.ga.gov server-side (avoids mixed-content + CORS)
app.get('/api/image/ga/:name', async (req, res) => {
  const { name } = req.params;
  if (!name || !/^[\w\-.]+\.jpg$/i.test(name)) {
    return res.status(400).json({ error: 'Invalid image name' });
  }
  try {
    const url = `http://navigator-c2c.dot.ga.gov/snapshots/${name}`;
    const resp = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: { 'User-Agent': 'RoadCamsGlasses/1.0' },
    });
    res.set({
      'Content-Type': resp.headers['content-type'] || 'image/jpeg',
      'Content-Length': resp.data.byteLength,
      'Cache-Control': 'public, max-age=60',
    });
    return res.end(Buffer.from(resp.data));
  } catch (err) {
    console.error(`[image/ga] ${name} error:`, err.message);
    return res.status(502).json({ error: err.message });
  }
});

// ─── Texas Road Conditions (DriveTexas / TX_KEY) ────────────────────────────
app.get('/api/conditions/tx', async (req, res) => {
  const TX_KEY = process.env.TX_KEY;
  if (!TX_KEY) return res.status(503).json({ error: 'TX_KEY not configured' });
  try {
    const response = await axios.get(
      `https://api.drivetexas.org/api/conditions.geojson?key=${TX_KEY}`,
      { headers: { 'Accept': 'application/json', 'User-Agent': 'RoadCamsGlasses/1.0' }, timeout: 10000 }
    );
    const data = response.data;
    // Pass through GeoJSON features; client filters/renders as overlay
    const features = (data.features || []).map(f => ({
      type:       f.type,
      geometry:   f.geometry,
      properties: {
        id:          f.properties.id || f.properties.conditionID,
        type:        f.properties.type || f.properties.conditionType,
        description: f.properties.description || f.properties.shortDesc || '',
        severity:    f.properties.severity || '',
        roadway:     f.properties.roadway   || f.properties.roadName || '',
        startTime:   f.properties.startTime || '',
        endTime:     f.properties.endTime   || '',
        county:      f.properties.county    || '',
      }
    }));
    console.log(`[conditions] TX → ${features.length} conditions from DriveTexas`);
    res.json({ type: 'FeatureCollection', features });
  } catch (err) {
    console.error('[conditions] TX error:', err.message);
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/weather/:state', async (req, res) => {
  const { state } = req.params;
  const { key } = req.query;

  const baseUrl = STATE_WEATHER_ENDPOINTS[state];
  if (!baseUrl) {
    return res.status(400).json({ error: `No weather stations for state: ${state}` });
  }
  // Same key migration as cameras: server-side <STATE>_KEY env wins,
  // user-supplied ?key= is the fallback.
  const effectiveKey = process.env[`${state.toUpperCase()}_KEY`] || key;
  if (!effectiveKey) {
    return res.status(400).json({ error: 'Missing API key (pass ?key=YOUR_KEY)' });
  }

  const upstreamUrl = `${baseUrl}?key=${encodeURIComponent(effectiveKey)}`;
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
  co: { ne: [41.0,-102.0], sw: [37.0,-109.1] },
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

// ─── Proxy host guard (open-relay / SSRF protection) ────────────────
// /api/image and /api/hls only fetch from DOT / 511 / known camera hosts.
// Built from the hosts the live state feeds actually returned (Oct 2026).
// Suffix match: an entry covers the host itself and all its subdomains.
// Extend without a code change via PROXY_EXTRA_HOSTS (comma-separated).
const PROXY_ALLOWED_SUFFIXES = [
  // State DOT / 511 camera + stream hosts observed in the live feeds
  'dot.ca.gov', 'iowadot.gov', 'dot.state.oh.us', 'ohgo.com', 'wsdot.wa.gov',
  'udottraffic.utah.gov', '511.idaho.gov', 'az511.com', 'nvroads.com', 'its.nv.gov',
  '511.alaska.gov', '511wi.gov', 'dot.wi.gov', 'maryland.gov', 'dot.ga.gov',
  'cotrip.org', 'carsprogram.org', 'nmroads.com', 'goakamai.org', 'trimarc.org',
  'trafficwise.org', 'travelmidwest.com', 'lakecountypassage.com', 'divas.cloud',
  'tripcheck.com', 'arcgis.com', 'txdot.gov',
  // 511 platform hosts for keyed states (their camera Views live here)
  '511ny.org', 'drivenc.gov', '511pa.com', '511la.org', '511nj.org',
  '511.nebraska.gov', 'kandrive.gov', 'al511.com', 'mi511.org',
  '511.vdot.virginia.gov', 'ne-compass.com', '511nh.com', '511vt.org',
  // Partner / public-safety webcams carried inside state feeds (mostly WA)
  'nps.gov', 'seattle.gov', 'whidbeytel.com', 'webcam.io', 'coloradosprings.gov',
  'windows.net', 'govdelivery.com', 'pangbornairport.com', 'flyykm.com',
  'sunmountainlodge.com', 'lewiscounty.com', 'aacb.com',
];
const PROXY_SUFFIXES = [
  ...PROXY_ALLOWED_SUFFIXES,
  ...(process.env.PROXY_EXTRA_HOSTS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
];

function isPrivateIp(ip) {
  if (!ip) return true;
  if (ip.includes(':')) {
    const v = ip.toLowerCase();
    return v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb');
  }
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some(isNaN)) return true;
  return p[0] === 0 || p[0] === 10 || p[0] === 127 ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 169 && p[1] === 254) ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127);
}

async function assertProxyHostAllowed(rawUrl) {
  const host = new URL(rawUrl).hostname.toLowerCase();
  const allowed = PROXY_SUFFIXES.some(s => host === s || host.endsWith(`.${s}`));
  if (!allowed) {
    console.warn(`[proxy] blocked non-allowlisted host: ${host}`);
    const err = new Error(`Host not allowed: ${host}`);
    err.statusCode = 403;
    throw err;
  }
  // Even an allowlisted name must not resolve into private space (SSRF guard)
  const addrs = await dns.lookup(host, { all: true }).catch(() => []);
  for (const a of addrs) {
    if (isPrivateIp(a.address)) {
      console.warn(`[proxy] blocked private-resolving host: ${host} → ${a.address}`);
      const err = new Error('Host resolves to a private address');
      err.statusCode = 403;
      throw err;
    }
  }
}

// ─── Image Proxy ─────────────────────────────────────────────────────
// ─── Image cache (server-side, 20 s TTL) ────────────────────────────
// Keys on the upstream camera URL (without &t timestamp) so the same
// camera served multiple times within 20 s is answered from memory.
const imageCache = new Map();
const IMAGE_CACHE_TTL = 20 * 1000;
const IMAGE_CACHE_MAX = 300; // max entries before LRU eviction

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

  // Host allowlist + private-IP guard (open-relay / SSRF protection)
  try {
    await assertProxyHostAllowed(decoded);
  } catch (e) {
    return res.status(e.statusCode || 403).send(e.message);
  }

  // Serve from cache if fresh
  const cached = imageCache.get(decoded);
  if (cached && cached.expiresAt > Date.now()) {
    res.set('Content-Type', cached.contentType);
    res.set('Cache-Control', 'public, max-age=15');
    res.set('X-Cache', 'HIT');
    return res.send(cached.data);
  }

  try {
    const response = await axios.get(decoded, {
      responseType: 'arraybuffer',
      headers: {
        'Accept': 'image/jpeg,image/png,image/*,*/*',
        'User-Agent': 'RoadCamsGlasses/1.0 (traffic camera viewer)',
        'Referer': decoded,           // some DOT servers check referer
      },
      timeout: 6000,
      maxRedirects: 5,
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';
    if (/^(text\/html|application\/json)/i.test(contentType)) {
      console.warn(`[image] upstream returned non-image content-type ${contentType} for ${decoded}`);
      return res.status(415).send('Upstream did not return an image');
    }
    const data = Buffer.from(response.data);

    // Evict oldest entry if cache is full
    if (imageCache.size >= IMAGE_CACHE_MAX) {
      imageCache.delete(imageCache.keys().next().value);
    }
    imageCache.set(decoded, { data, contentType, expiresAt: Date.now() + IMAGE_CACHE_TTL });

    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=15');
    res.set('X-Cache', 'MISS');
    res.set('X-Camera-Url', decoded);
    res.send(data);
  } catch (err) {
    const status = err.response?.status || 502;
    console.error(`[image] proxy error ${status} for ${decoded}`);
    res.status(status).send('Image unavailable');
  }
});

// ─── HLS Stream Proxy ─────────────────────────────────────────────────
// GET /api/hls?url=ENCODED_M3U8_OR_SEGMENT_URL
// Proxies HLS playlists (.m3u8) and their segments (.ts) through Railway
// so the browser avoids CORS restrictions on DOT streaming servers.
// For playlists: rewrites relative segment/sub-playlist URLs to go
// through this proxy. For segments: streams binary data directly.

app.get('/api/hls', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('Missing url parameter');

  const decoded = decodeURIComponent(url);
  if (!/^https?:\/\//i.test(decoded)) return res.status(400).send('Invalid URL');

  // Host allowlist + private-IP guard (same rules as /api/image)
  try {
    await assertProxyHostAllowed(decoded);
  } catch (e) {
    return res.status(e.statusCode || 403).send(e.message);
  }

  const isPlaylist = /\.m3u8/i.test(decoded);

  try {
    if (isPlaylist) {
      const response = await axios.get(decoded, {
        responseType: 'text',
        timeout: 10000,
        headers: { 'User-Agent': 'RoadCamsGlasses/1.0' },
      });
      // Build base URL for resolving relative segment paths
      const baseUrl = decoded.substring(0, decoded.lastIndexOf('/') + 1);
      // Rewrite every non-comment line to go through this proxy
      const rewritten = response.data.replace(/^(?!#)([^\r\n]+)/gm, (match) => {
        const trimmed = match.trim();
        if (!trimmed) return match;
        const absolute = /^https?:\/\//i.test(trimmed) ? trimmed : baseUrl + trimmed;
        return `/api/hls?url=${encodeURIComponent(absolute)}`;
      });
      res.setHeader('Content-Type', 'application/x-mpegURL');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(rewritten);
    } else {
      // Binary segment — pipe the stream directly
      const response = await axios.get(decoded, {
        responseType: 'stream',
        timeout: 30000,
        headers: { 'User-Agent': 'RoadCamsGlasses/1.0' },
      });
      res.setHeader('Content-Type', response.headers['content-type'] || 'video/mp2t');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-store');
      response.data.pipe(res);
    }
  } catch (err) {
    const status = err.response?.status || 502;
    console.error(`[hls] proxy error ${status} for ${decoded.substring(0, 80)}`);
    res.status(status).send('Stream unavailable');
  }
});


// ─── Health check ────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
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
