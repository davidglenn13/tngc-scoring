-- Live-round safety guards.

CREATE TRIGGER IF NOT EXISTS trg_v2_40_limit_insert
BEFORE INSERT ON v2_forty_ball_selections
WHEN NEW.selected=1
 AND NOT EXISTS(
   SELECT 1 FROM v2_forty_ball_selections
   WHERE event_id=NEW.event_id
     AND foursome_no=NEW.foursome_no
     AND player_id=NEW.player_id
     AND hole=NEW.hole
     AND selected=1
 )
 AND (
   SELECT COUNT(*) FROM v2_forty_ball_selections
   WHERE event_id=NEW.event_id
     AND foursome_no=NEW.foursome_no
     AND selected=1
 ) >= 40
BEGIN
  SELECT RAISE(ABORT,'40 scores are already counted');
END;

CREATE TRIGGER IF NOT EXISTS trg_v2_40_limit_update
BEFORE UPDATE OF selected ON v2_forty_ball_selections
WHEN NEW.selected=1 AND OLD.selected<>1
 AND (
   SELECT COUNT(*) FROM v2_forty_ball_selections
   WHERE event_id=NEW.event_id
     AND foursome_no=NEW.foursome_no
     AND selected=1
 ) >= 40
BEGIN
  SELECT RAISE(ABORT,'40 scores are already counted');
END;
