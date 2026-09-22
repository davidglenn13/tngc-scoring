ALTER TABLE v2_events ADD COLUMN organizer_token_hash TEXT;

CREATE TABLE IF NOT EXISTS v2_score_revisions (
  event_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  hole INTEGER NOT NULL CHECK(hole BETWEEN 1 AND 18),
  gross INTEGER CHECK(gross IS NULL OR (gross BETWEEN 1 AND 15)),
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT,
  PRIMARY KEY(event_id,player_id,hole),
  FOREIGN KEY(event_id) REFERENCES v2_events(id) ON DELETE CASCADE,
  FOREIGN KEY(player_id) REFERENCES v2_players(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO v2_score_revisions(event_id,player_id,hole,gross,revision,updated_at,updated_by)
SELECT event_id,player_id,hole,gross,revision,updated_at,updated_by FROM v2_scores;

CREATE INDEX IF NOT EXISTS idx_v2_score_revisions_event_hole ON v2_score_revisions(event_id,hole);
CREATE INDEX IF NOT EXISTS idx_v2_score_revisions_updated ON v2_score_revisions(event_id,updated_at);
