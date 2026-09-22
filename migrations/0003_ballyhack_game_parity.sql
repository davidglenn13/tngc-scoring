ALTER TABLE v2_presses ADD COLUMN parent_press_id TEXT;

CREATE TABLE IF NOT EXISTS v2_forty_ball_selections (
  event_id TEXT NOT NULL,
  foursome_no INTEGER NOT NULL CHECK(foursome_no IN (1,2)),
  player_id TEXT NOT NULL,
  hole INTEGER NOT NULL CHECK(hole BETWEEN 1 AND 18),
  selected INTEGER NOT NULL DEFAULT 1 CHECK(selected IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(event_id,foursome_no,player_id,hole),
  FOREIGN KEY(event_id) REFERENCES v2_events(id) ON DELETE CASCADE,
  FOREIGN KEY(player_id) REFERENCES v2_players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_v2_40_event_group ON v2_forty_ball_selections(event_id,foursome_no,selected);
