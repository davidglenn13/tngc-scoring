CREATE TABLE IF NOT EXISTS v2_scorecard_confirmations (
  event_id TEXT NOT NULL,
  foursome_no INTEGER NOT NULL CHECK(foursome_no IN (1,2)),
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK(status IN ('in_progress','ready','confirmed')),
  confirmed_at TEXT,
  confirmed_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(event_id,foursome_no),
  FOREIGN KEY(event_id) REFERENCES v2_events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_v2_confirm_event
  ON v2_scorecard_confirmations(event_id,status);
