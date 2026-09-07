// db.js — SQLite database layer for StateRoad auth & preferences
// Requires: better-sqlite3
// Railway note: add a Volume mounted at /data to persist across deploys
//   Volume path → set DB_PATH=/data/stateroad.db in Railway env vars

'use strict';
const fs       = require('fs');
const Database = require('better-sqlite3');
const path     = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'stateroad.db');

// Ensure parent directory exists (required when DB_PATH points to a Railway Volume)
const DB_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    email       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    pass_hash   TEXT    NOT NULL,
    pin_hash    TEXT    NOT NULL,
    is_admin    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    last_login  TEXT
  );

  CREATE TABLE IF NOT EXISTS user_preferences (
    user_id         INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    selected_states TEXT    NOT NULL DEFAULT '[]',
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pin_reset_tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT    NOT NULL UNIQUE,
    expires_at TEXT    NOT NULL,
    used       INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// Seed admin account flag if the env var is set and account exists
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'shayno3@gmail.com';
db.prepare(`
  UPDATE users SET is_admin = 1 WHERE email = ? COLLATE NOCASE
`).run(ADMIN_EMAIL);

// ─── User queries ─────────────────────────────────────────────────────────────

const q = {
  // Users
  createUser: db.prepare(`
    INSERT INTO users (name, email, pass_hash, pin_hash)
    VALUES (@name, @email, @pass_hash, @pin_hash)
  `),
  getUserByEmail: db.prepare(`SELECT * FROM users WHERE email = ? COLLATE NOCASE`),
  getUserById:    db.prepare(`SELECT * FROM users WHERE id = ?`),
  touchLogin:     db.prepare(`UPDATE users SET last_login = datetime('now') WHERE id = ?`),
  updatePinHash:  db.prepare(`UPDATE users SET pin_hash = ? WHERE id = ?`),
  deleteUser:     db.prepare(`DELETE FROM users WHERE id = ?`),

  // Preferences
  upsertPrefs: db.prepare(`
    INSERT INTO user_preferences (user_id, selected_states, updated_at)
    VALUES (@user_id, @selected_states, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      selected_states = excluded.selected_states,
      updated_at      = excluded.updated_at
  `),
  getPrefs: db.prepare(`SELECT selected_states FROM user_preferences WHERE user_id = ?`),

  // PIN reset tokens
  saveResetToken: db.prepare(`
    INSERT INTO pin_reset_tokens (user_id, token, expires_at)
    VALUES (@user_id, @token, @expires_at)
  `),
  getResetToken: db.prepare(`
    SELECT * FROM pin_reset_tokens
    WHERE token = ? AND used = 0 AND expires_at > datetime('now')
  `),
  markTokenUsed: db.prepare(`UPDATE pin_reset_tokens SET used = 1 WHERE token = ?`),

  // Admin
  listUsers: db.prepare(`
    SELECT u.id, u.name, u.email, u.is_admin, u.created_at, u.last_login,
           p.selected_states
    FROM users u
    LEFT JOIN user_preferences p ON p.user_id = u.id
    ORDER BY u.created_at DESC
  `),
  countUsers: db.prepare(`SELECT COUNT(*) as total FROM users`),
  stateStats: db.prepare(`SELECT selected_states FROM user_preferences`)
};

module.exports = { db, q, ADMIN_EMAIL };
