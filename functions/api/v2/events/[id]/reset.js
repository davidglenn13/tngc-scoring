import {json,bad,cleanId,requireEvent,audit,requireOrganizer} from "../../_common.js";

export async function onRequestPost(context){
  try{
    const eventId=cleanId(context.params.id);
    await requireOrganizer(context,eventId);
    const body=await context.request.json();
    const confirm=String(body.confirm||"");
    const mode=String(body.mode||"scores");
    if(confirm!=="RESET") return bad("Reset confirmation missing");
    if(!["scores","scores_and_games"].includes(mode)) return bad("Invalid reset mode");

    const ops=[
      context.env.DB.prepare("DELETE FROM v2_scorecard_confirmations WHERE event_id=?").bind(eventId),
      context.env.DB.prepare("DELETE FROM v2_forty_ball_selections WHERE event_id=?").bind(eventId),
      context.env.DB.prepare("DELETE FROM v2_score_revisions WHERE event_id=?").bind(eventId),
      context.env.DB.prepare("DELETE FROM v2_scores WHERE event_id=?").bind(eventId)
    ];
    if(mode==="scores_and_games"){
      ops.push(context.env.DB.prepare(
        "DELETE FROM v2_presses WHERE game_id IN (SELECT id FROM v2_games WHERE event_id=?)"
      ).bind(eventId));
      ops.push(context.env.DB.prepare("DELETE FROM v2_games WHERE event_id=?").bind(eventId));
    }
    await context.env.DB.batch(ops);
    await audit(context.env,eventId,"event",eventId,"event_reset",{mode});
    return json({ok:true,mode});
  }catch(err){ return bad(err.message||"Unable to reset event",err.status||400); }
}
