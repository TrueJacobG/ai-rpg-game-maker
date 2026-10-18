CREATE TABLE story_log (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  kind TEXT NOT NULL,
  text TEXT NOT NULL
) STRICT;

CREATE INDEX story_log_at ON story_log (at);
