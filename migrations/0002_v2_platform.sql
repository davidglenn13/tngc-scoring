-- additive V2 schema; current beta remains intact
CREATE TABLE IF NOT EXISTS v2_events (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, event_date TEXT NOT NULL,
 course_id TEXT NOT NULL DEFAULT 'tngc-charlotte', mode TEXT NOT NULL DEFAULT 'casual',
 status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS v2_players (
 id TEXT PRIMARY KEY, event_id TEXT NOT NULL, display_name TEXT NOT NULL,
 handicap_index REAL NOT NULL, tee_key TEXT NOT NULL, course_handicap INTEGER NOT NULL,
 foursome_no INTEGER NOT NULL DEFAULT 1 CHECK(foursome_no IN (1,2)), sort_order INTEGER NOT NULL DEFAULT 0,
 FOREIGN KEY(event_id) REFERENCES v2_events(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS v2_scores (
 event_id TEXT NOT NULL, player_id TEXT NOT NULL, hole INTEGER NOT NULL CHECK(hole BETWEEN 1 AND 18),
 gross INTEGER NOT NULL CHECK(gross BETWEEN 1 AND 15), revision INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_by TEXT,
 PRIMARY KEY(event_id,player_id,hole),
 FOREIGN KEY(event_id) REFERENCES v2_events(id) ON DELETE CASCADE,
 FOREIGN KEY(player_id) REFERENCES v2_players(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS v2_games (
 id TEXT PRIMARY KEY, event_id TEXT NOT NULL, game_type TEXT NOT NULL, preset_key TEXT NOT NULL,
 foursome_no INTEGER, wager_cents INTEGER NOT NULL DEFAULT 0, config_json TEXT NOT NULL DEFAULT '{}',
 status TEXT NOT NULL DEFAULT 'active', FOREIGN KEY(event_id) REFERENCES v2_events(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS v2_presses (
 id TEXT PRIMARY KEY, game_id TEXT NOT NULL, segment_key TEXT NOT NULL,
 from_hole INTEGER NOT NULL CHECK(from_hole BETWEEN 1 AND 18), pressed_by_side TEXT NOT NULL,
 wager_cents INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(game_id) REFERENCES v2_games(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS v2_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT NOT NULL, entity_type TEXT NOT NULL,
 entity_id TEXT, action TEXT NOT NULL, payload_json TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_v2_scores_event_hole ON v2_scores(event_id,hole);
CREATE INDEX IF NOT EXISTS idx_v2_players_event ON v2_players(event_id,foursome_no,sort_order);
CREATE INDEX IF NOT EXISTS idx_v2_games_event ON v2_games(event_id,status);

CREATE INDEX IF NOT EXISTS idx_v2_scores_updated ON v2_scores(event_id,updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_press_unique_start ON v2_presses(game_id,segment_key,from_hole);
