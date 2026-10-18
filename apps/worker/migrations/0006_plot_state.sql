CREATE TABLE plot_state (
  ref TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('discovered', 'resolved'))
) STRICT;
