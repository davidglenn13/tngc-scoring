import {json,bad,cleanId,requireEventAccess,teamAccessToken} from "../../_common.js";

export async function onRequestGet(context){
  try{
    const id=cleanId(context.params.id);
    const access=await requireEventAccess(context,id);
    const event=access.event,viewerGroup=access.organizer?null:Number(access.foursome);
    const [players,scores,games,presses,fortySelections,confirmations]=await Promise.all([
      context.env.DB.prepare(
        `SELECT id,display_name,handicap_index,tee_key,course_handicap,foursome_no,sort_order
         FROM v2_players WHERE event_id=? ORDER BY foursome_no,sort_order,id`
      ).bind(id).all(),
      viewerGroup
        ? context.env.DB.prepare(
          `SELECT s.player_id,s.hole,s.gross,s.revision,s.updated_at,s.updated_by
           FROM v2_score_revisions s JOIN v2_players p ON p.id=s.player_id
           WHERE s.event_id=? AND p.foursome_no=? AND s.gross IS NOT NULL ORDER BY s.player_id,s.hole`
        ).bind(id,viewerGroup).all()
        : context.env.DB.prepare(
          `SELECT player_id,hole,gross,revision,updated_at,updated_by
           FROM v2_score_revisions WHERE event_id=? AND gross IS NOT NULL ORDER BY player_id,hole`
        ).bind(id).all(),
      context.env.DB.prepare(
        `SELECT id,game_type,preset_key,foursome_no,wager_cents,config_json,status
         FROM v2_games WHERE event_id=? ORDER BY game_type,foursome_no,id`
      ).bind(id).all(),
      context.env.DB.prepare(
        `SELECT p.id,p.game_id,p.segment_key,p.from_hole,p.pressed_by_side,p.wager_cents,p.parent_press_id,p.created_at
         FROM v2_presses p JOIN v2_games g ON g.id=p.game_id
         WHERE g.event_id=? ${viewerGroup?"AND g.foursome_no=?":""} ORDER BY p.created_at,p.id`
      ).bind(...(viewerGroup?[id,viewerGroup]:[id])).all(),
      context.env.DB.prepare(
        `SELECT foursome_no,player_id,hole,selected,updated_at
         FROM v2_forty_ball_selections WHERE event_id=? AND selected=1 ${viewerGroup?"AND foursome_no=?":""}
         ORDER BY foursome_no,player_id,hole`
      ).bind(...(viewerGroup?[id,viewerGroup]:[id])).all(),
      context.env.DB.prepare(
        `SELECT foursome_no,status,confirmed_at,confirmed_by,updated_at
         FROM v2_scorecard_confirmations WHERE event_id=? ${viewerGroup?"AND foursome_no=?":""} ORDER BY foursome_no`
      ).bind(...(viewerGroup?[id,viewerGroup]:[id])).all()
    ]);

    return json({
      event:{
        id:event.id,name:event.name,event_date:event.event_date,course_id:event.course_id,
        mode:event.mode,status:event.status,updated_at:event.updated_at,course_version:event.course_version||null,course_data:event.course_data_json?JSON.parse(event.course_data_json):null
      },
      players:players.results||[],
      scores:scores.results||[],
      games:(games.results||[]).map(g=>({...g,config:JSON.parse(g.config_json||"{}")})),
      presses:presses.results||[],
      forty_ball_selections:fortySelections.results||[],
      confirmations:confirmations.results||[],
      viewer_foursome:viewerGroup,
      team_access:access.organizer?{1:await teamAccessToken(event,1),2:await teamAccessToken(event,2)}:undefined
    });
  }catch(err){
    return bad(err.message||"Unable to load event",err.status||400);
  }
}
