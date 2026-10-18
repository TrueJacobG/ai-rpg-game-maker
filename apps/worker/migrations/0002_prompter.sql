CREATE TABLE pairing (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  failures INTEGER NOT NULL
) STRICT;

CREATE TABLE prompter_devices (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
) STRICT;
