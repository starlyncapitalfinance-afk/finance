-- Cloudflare D1 schema for the JLG sync server
CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  name       TEXT,
  username   TEXT UNIQUE,
  pass       TEXT,
  salt       TEXT,
  role       TEXT,
  token      TEXT,
  updated_at INTEGER,
  updated_by TEXT
);

-- generic record store (one row per app record); seq gives a global change cursor
CREATE TABLE IF NOT EXISTS records (
  tbl        TEXT,
  id         TEXT,
  data       TEXT,
  updated_at INTEGER,
  updated_by TEXT,
  deleted    INTEGER DEFAULT 0,
  seq        INTEGER,
  PRIMARY KEY (tbl, id)
);
CREATE INDEX IF NOT EXISTS idx_records_seq ON records(seq);

CREATE TABLE IF NOT EXISTS meta  (k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, data TEXT, at INTEGER);

CREATE TABLE IF NOT EXISTS seqctr (id INTEGER PRIMARY KEY CHECK (id = 1), val INTEGER);
INSERT OR IGNORE INTO seqctr (id, val) VALUES (1, 0);
