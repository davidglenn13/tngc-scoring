import {json,bad,cleanId,requireEvent,requireOrganizer} from "../../_common.js";

export async function onRequestGet(context){
  try{
    const eventId=cleanId(context.params.id);
    const event=await requireOrganizer(context,eventId);
    const [players,scores,scoreState,games,presses,fortySelections,confirmations,audit]=await Promise.all([
      context.env.DB.prepare("SELECT * FROM v2_players WHERE event_id=? ORDER BY foursome_no,sort_order,id").bind(eventId).all(),
      context.env.DB.prepare("SELECT * FROM v2_score_revisions WHERE event_id=? AND gross IS NOT NULL ORDER BY player_id,hole").bind(eventId).all(),
      context.env.DB.prepare("SELECT * FROM v2_score_revisions WHERE event_id=? ORDER BY player_id,hole").bind(eventId).all(),
      context.env.DB.prepare("SELECT * FROM v2_games WHERE event_id=? ORDER BY game_type,foursome_no,id").bind(eventId).all(),
      context.env.DB.prepare(
        "SELECT p.* FROM v2_presses p JOIN v2_games g ON g.id=p.game_id WHERE g.event_id=? ORDER BY p.created_at,p.id"
      ).bind(eventId).all(),
      context.env.DB.prepare("SELECT * FROM v2_forty_ball_selections WHERE event_id=? ORDER BY foursome_no,player_id,hole").bind(eventId).all(),
      context.env.DB.prepare("SELECT * FROM v2_scorecard_confirmations WHERE event_id=? ORDER BY foursome_no").bind(eventId).all(),
      context.env.DB.prepare("SELECT * FROM v2_audit WHERE event_id=? ORDER BY id").bind(eventId).all()
    ]);
    return json({
      schema_version:2,
      exported_at:new Date().toISOString(),
      event,players:players.results||[],scores:scores.results||[],score_state:scoreState.results||[],
      games:games.results||[],presses:presses.results||[],forty_ball_selections:fortySelections.results||[],confirmations:confirmations.results||[],audit:audit.results||[]
    });
  }catch(err){ return bad(err.message||"Unable to create backup",err.status||400); }
}
