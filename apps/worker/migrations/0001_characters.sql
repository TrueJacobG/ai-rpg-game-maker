CREATE TABLE characters (
  id TEXT PRIMARY KEY,
  player_token TEXT NOT NULL UNIQUE,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
