CREATE TABLE story_flags (
  flag TEXT PRIMARY KEY,
  set_at TEXT NOT NULL
) STRICT;

CREATE TABLE story_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;
