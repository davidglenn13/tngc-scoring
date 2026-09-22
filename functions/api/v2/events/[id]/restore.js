import {json,bad,cleanId,requireEvent,audit,requireOrganizer} from "../../_common.js";

export async function onRequestPost(context){
  try{
    const eventId=cleanId(context.params.id);
    await requireOrganizer(context,eventId);
    const body=await context.request.json();
    if(String(body.confirm||"")!=="RESTORE")return bad("Restore confirmation missing");
    const backup=body.backup;
    if(!backup||Number(backup.schema_version)!==2)return bad("Unsupported backup");
    if(String(backup.event?.id||"")!==eventId)return bad("Backup event does not match current event");

    const scores=Array.isArray(backup.scores)?backup.scores:[];
    const scoreState=Array.isArray(backup.score_state)&&backup.score_state.length?backup.score_state:scores;
    const games=Array.isArray(backup.games)?backup.games:[];
    const presses=Array.isArray(backup.presses)?backup.presses:[];
    const selections=Array.isArray(backup.forty_ball_selections)?backup.forty_ball_selections:[];

    const ops=[
      context.env.DB.prepare("DELETE FROM v2_forty_ball_selections WHERE event_id=?").bind(eventId),
      context.env.DB.prepare("DELETE FROM v2_presses WHERE game_id IN (SELECT id FROM v2_games WHERE event_id=?)").bind(eventId),
      context.env.DB.prepare("DELETE FROM v2_games WHERE event_id=?").bind(eventId),
      context.env.DB.prepare("DELETE FROM v2_score_revisions WHERE event_id=?").bind(eventId),
      context.env.DB.prepare("DELETE FROM v2_scores WHERE event_id=?").bind(eventId),
      ...games.map(g=>context.env.DB.prepare(
        `INSERT INTO v2_games(id,event_id,game_type,preset_key,foursome_no,wager_cents,config_json,status)
         VALUES(?,?,?,?,?,?,?,?)`
      ).bind(g.id,eventId,g.game_type,g.preset_key,g.foursome_no??null,g.wager_cents||0,g.config_json||"{}",g.status||"active")),
      ...presses.map(p=>context.env.DB.prepare(
        `INSERT INTO v2_presses(id,game_id,segment_key,from_hole,pressed_by_side,wager_cents,parent_press_id,created_at)
         VALUES(?,?,?,?,?,?,?,?)`
      ).bind(p.id,p.game_id,p.segment_key,p.from_hole,p.pressed_by_side,p.wager_cents||0,p.parent_press_id??null,p.created_at||new Date().toISOString())),
      ...scoreState.map(s=>context.env.DB.prepare(
        `INSERT INTO v2_score_revisions(event_id,player_id,hole,gross,revision,updated_at,updated_by)
         VALUES(?,?,?,?,?,?,?)`
      ).bind(eventId,s.player_id,s.hole,s.gross??null,s.revision||1,s.updated_at||new Date().toISOString(),s.updated_by||"restore")),
      ...scores.filter(s=>s.gross!==null&&s.gross!==undefined).map(s=>context.env.DB.prepare(
        `INSERT INTO v2_scores(event_id,player_id,hole,gross,revision,updated_at,updated_by)
         VALUES(?,?,?,?,?,?,?)`
      ).bind(eventId,s.player_id,s.hole,s.gross,s.revision||1,s.updated_at||new Date().toISOString(),s.updated_by||"restore")),
      ...selections.filter(x=>x.selected!==0).map(x=>context.env.DB.prepare(
        `INSERT INTO v2_forty_ball_selections(event_id,foursome_no,player_id,hole,selected,updated_at)
         VALUES(?,?,?,?,1,?)`
      ).bind(eventId,x.foursome_no,x.player_id,x.hole,x.updated_at||new Date().toISOString()))
    ];

    await context.env.DB.batch(ops);
    await audit(context.env,eventId,"event",eventId,"event_restored",{
      scores:scores.length,games:games.length,presses:presses.length,forty_ball_selections:selections.length
    });
    return json({ok:true,restored:{scores:scores.length,games:games.length,presses:presses.length,selections:selections.length}});
  }catch(err){return bad(err.message||"Unable to restore backup",err.status||400);}
}
