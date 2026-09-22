CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_one_nassau_per_group
ON v2_games(event_id,foursome_no)
WHERE game_type='nassau' AND status='active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_one_forty_per_event
ON v2_games(event_id)
WHERE game_type='forty_ball' AND status='active';
