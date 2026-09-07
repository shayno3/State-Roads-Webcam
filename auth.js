// auth.js — Authentication & preferences router for StateRoad
// Mounts at /api/auth and /api/admin in server.js
// Env vars required (set in Railway):
//   JWT_SECRET        — long random string (openssl rand -hex 32)
//   JWT_EXPIRES_IN    — e.g. "7d"
//   ADMIN_EMAIL       — shayno3@gmail.com

'use strict';
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const { q, ADMIN_EMAIL } = require('./db');

const router = express.Router();

const JWT_SECRET  = process.env.JWT_SECRET  || 'CHANGE_ME_IN_RAILWAY_ENV';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '7d';
const SALT_ROUNDS = 12;

// ─── Middleware ───────────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only' });
    next();
  });
}

// ─── POST /api/auth/register ─────────────────────────────────────────────────
// Body: { name, email, password, pin }
// PIN is a 6-digit string the user chose; hashed before storage.
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, pin } = req.body || {};
    if (!name || !email || !password || !pin)
      return res.status(400).json({ error: 'name, email, password, and pin are required' });
    if (!/^\d{6}$/.test(pin))
      return res.status(400).json({ error: 'PIN must be exactly 6 digits' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const existing = q.getUserByEmail.get(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const [pass_hash, pin_hash] = await Promise.all([
      bcrypt.hash(password, SALT_ROUNDS),
      bcrypt.hash(pin, SALT_ROUNDS)
    ]);

    const result = q.createUser.run({ name, email: email.toLowerCase().trim(), pass_hash, pin_hash });
    const user   = q.getUserById.get(result.lastInsertRowid);

    // Elevate if this is the admin email
    if (user.email === ADMIN_EMAIL.toLowerCase()) {
      q.getUserByEmail.get(email); // already inserted; is_admin set by db.js on load
    }

    const token = signToken(user);
    res.status(201).json({ token, user: safeUser(user), requiresPin: false });
  } catch (err) {
    console.error('register error', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────
// Body: { email, password }
// Returns a short-lived pre-auth token; client must verify PIN next.
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: 'email and password required' });

    const user = q.getUserByEmail.get(email);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const ok = await bcrypt.compare(password, user.pass_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    // Issue a pre-auth token valid 5 minutes — PIN step must follow
    const preToken = jwt.sign(
      { id: user.id, email: user.email, stage: 'pre-pin' },
      JWT_SECRET,
      { expiresIn: '5m' }
    );
    res.json({ preToken, requiresPin: true, userName: user.name });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── POST /api/auth/verify-pin ───────────────────────────────────────────────
// Body: { preToken, pin }
// Verifies PIN, returns full JWT session token.
router.post('/verify-pin', async (req, res) => {
  try {
    const { preToken, pin } = req.body || {};
    if (!preToken || !pin) return res.status(400).json({ error: 'preToken and pin required' });

    let payload;
    try {
      payload = jwt.verify(preToken, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Session expired — please log in again' });
    }
    if (payload.stage !== 'pre-pin')
      return res.status(401).json({ error: 'Invalid token stage' });

    const user = q.getUserById.get(payload.id);
    if (!user) return res.status(401).json({ error: 'User not found' });

    const pinOk = await bcrypt.compare(pin, user.pin_hash);
    if (!pinOk) return res.status(401).json({ error: 'Incorrect PIN' });

    q.touchLogin.run(user.id);
    const token = signToken(user);
    const prefs = q.getPrefs.get(user.id);
    const selectedStates = prefs ? JSON.parse(prefs.selected_states) : [];

    res.json({ token, user: safeUser(user), selectedStates });
  } catch (err) {
    console.error('verify-pin error', err);
    res.status(500).json({ error: 'PIN verification failed' });
  }
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  const user = q.getUserById.get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const prefs = q.getPrefs.get(user.id);
  res.json({
    user: safeUser(user),
    selectedStates: prefs ? JSON.parse(prefs.selected_states) : []
  });
});

// ─── PUT /api/auth/preferences ───────────────────────────────────────────────
// Body: { selectedStates: ["CO", "WY", ...] }
router.put('/preferences', requireAuth, (req, res) => {
  const { selectedStates } = req.body || {};
  if (!Array.isArray(selectedStates))
    return res.status(400).json({ error: 'selectedStates must be an array' });

  q.upsertPrefs.run({
    user_id: req.user.id,
    selected_states: JSON.stringify(selectedStates)
  });
  res.json({ ok: true, selectedStates });
});

// ─── POST /api/auth/change-pin ───────────────────────────────────────────────
// Body: { currentPin, newPin }
router.post('/change-pin', requireAuth, async (req, res) => {
  try {
    const { currentPin, newPin } = req.body || {};
    if (!currentPin || !newPin) return res.status(400).json({ error: 'currentPin and newPin required' });
    if (!/^\d{6}$/.test(newPin)) return res.status(400).json({ error: 'New PIN must be 6 digits' });

    const user = q.getUserById.get(req.user.id);
    const ok   = await bcrypt.compare(currentPin, user.pin_hash);
    if (!ok) return res.status(401).json({ error: 'Current PIN is incorrect' });

    const pin_hash = await bcrypt.hash(newPin, SALT_ROUNDS);
    q.updatePinHash.run(pin_hash, user.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('change-pin error', err);
    res.status(500).json({ error: 'PIN change failed' });
  }
});

// ─── POST /api/auth/reset-pin-request ────────────────────────────────────────
// Body: { email }
// In production wire this to a real email provider (Resend, SendGrid, etc.)
router.post('/reset-pin-request', async (req, res) => {
  try {
    const { email } = req.body || {};
    const user = email && q.getUserByEmail.get(email);
    // Always return success to prevent user enumeration
    if (!user) return res.json({ ok: true });

    const token    = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    q.saveResetToken.run({ user_id: user.id, token, expires_at: expiresAt });

    // TODO: send email with reset link → stateroad.fyi/reset-pin?token=<token>
    // For now, log to server console (Railway logs)
    console.log(`[PIN RESET] ${email} → token: ${token} (expires: ${expiresAt})`);

    res.json({ ok: true });
  } catch (err) {
    console.error('reset-pin-request error', err);
    res.status(500).json({ error: 'Reset request failed' });
  }
});

// ─── POST /api/auth/reset-pin ────────────────────────────────────────────────
// Body: { token, newPin }
router.post('/reset-pin', async (req, res) => {
  try {
    const { token, newPin } = req.body || {};
    if (!token || !newPin) return res.status(400).json({ error: 'token and newPin required' });
    if (!/^\d{6}$/.test(newPin)) return res.status(400).json({ error: 'PIN must be 6 digits' });

    const row = q.getResetToken.get(token);
    if (!row) return res.status(400).json({ error: 'Invalid or expired reset link' });

    const pin_hash = await bcrypt.hash(newPin, SALT_ROUNDS);
    q.updatePinHash.run(pin_hash, row.user_id);
    q.markTokenUsed.run(token);

    res.json({ ok: true });
  } catch (err) {
    console.error('reset-pin error', err);
    res.status(500).json({ error: 'PIN reset failed' });
  }
});

// ─── Admin routes ─────────────────────────────────────────────────────────────

const adminRouter = express.Router();

// GET /api/admin/users
adminRouter.get('/users', requireAdmin, (req, res) => {
  const users = q.listUsers.all();
  res.json(users.map(u => ({
    ...safeUser(u),
    selectedStates: u.selected_states ? JSON.parse(u.selected_states) : []
  })));
});

// GET /api/admin/stats
adminRouter.get('/stats', requireAdmin, (req, res) => {
  const { total } = q.countUsers.get();
  const prefRows  = q.stateStats.all();

  // Tally state popularity
  const stateCounts = {};
  for (const row of prefRows) {
    const states = JSON.parse(row.selected_states || '[]');
    for (const s of states) {
      stateCounts[s] = (stateCounts[s] || 0) + 1;
    }
  }
  const topStates = Object.entries(stateCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([state, count]) => ({ state, count }));

  res.json({ totalUsers: total, topStates });
});

// DELETE /api/admin/users/:id
adminRouter.delete('/users/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const user = q.getUserById.get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.email === ADMIN_EMAIL.toLowerCase())
    return res.status(403).json({ error: 'Cannot delete admin account' });
  q.deleteUser.run(id);
  res.json({ ok: true });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, is_admin: !!user.is_admin },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function safeUser(u) {
  return {
    id:         u.id,
    name:       u.name,
    email:      u.email,
    is_admin:   !!u.is_admin,
    created_at: u.created_at,
    last_login: u.last_login
  };
}

module.exports = { authRouter: router, adminRouter };
