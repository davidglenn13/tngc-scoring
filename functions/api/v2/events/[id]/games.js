import {json,bad,cleanId,newId,requireEvent,audit,requireOrganizer} from "../../_common.js";

export async function onRequestPut(context){
  try{
    const eventId=cleanId(context.params.id);
    await requireOrganizer(context,eventId);
    const body=await context.request.json();
    const games=Array.isArray(body.games)?body.games:[];

    const activity=await context.env.DB.prepare(
      `SELECT
         EXISTS(SELECT 1 FROM v2_score_revisions WHERE event_id=? AND gross IS NOT NULL) AS has_scores,
         EXISTS(SELECT 1 FROM v2_presses p JOIN v2_games g ON g.id=p.game_id WHERE g.event_id=?) AS has_presses,
         EXISTS(SELECT 1 FROM v2_forty_ball_selections WHERE event_id=? AND selected=1) AS has_40,
         EXISTS(SELECT 1 FROM v2_scorecard_confirmations WHERE event_id=? AND status='confirmed') AS has_confirmed`
    ).bind(eventId,eventId,eventId,eventId).first();
    if(Number(activity?.has_scores||0)||Number(activity?.has_presses||0)||
       Number(activity?.has_40||0)||Number(activity?.has_confirmed||0)){
      return bad("Bulk game replacement is locked after scoring begins; use game-config",409);
    }

    const deletes=context.env.DB.prepare("DELETE FROM v2_games WHERE event_id=?").bind(eventId);
    const inserts=games.map(g=>{
      const id=String(g.id||newId("g_"));
      const type=String(g.game_type||"");
      const preset=String(g.preset_key||"");
      const foursome=g.foursome_no==null?null:Number(g.foursome_no);
      const wager=Math.max(0,Math.round(Number(g.wager_cents||0)));
      if(!["nassau","forty_ball"].includes(type)) throw new Error("Invalid game type");
      return context.env.DB.prepare(
        `INSERT INTO v2_games(id,event_id,game_type,preset_key,foursome_no,wager_cents,config_json,status)
         VALUES(?,?,?,?,?,?,?,'active')`
      ).bind(id,eventId,type,preset,foursome,wager,JSON.stringify(g.config||{}));
    });

    await context.env.DB.batch([deletes,...inserts]);
    await audit(context.env,eventId,"games",eventId,"games_replaced",{count:games.length});
    return json({ok:true,count:games.length});
  }catch(err){
    return bad(err.message||"Unable to save games",err.status||400);
  }
}
