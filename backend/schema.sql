-- D1 Database Schema
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);

CREATE TABLE measurements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  systolic INTEGER NOT NULL,
  diastolic INTEGER NOT NULL,
  heart_rate INTEGER NOT NULL,
  timestamp DATETIME NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Refresh tokens for persistent login (rotating)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_used_at TEXT,
  user_agent TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);
