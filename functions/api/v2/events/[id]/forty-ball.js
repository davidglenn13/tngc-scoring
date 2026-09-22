import {json,bad,cleanId,requireEvent,audit} from "../../_common.js";

export async function onRequestPut(context){
  try{
    const eventId=cleanId(context.params.id); await requireEvent(context.env,eventId);
    const b=await context.request.json();
    const g=Number(b.foursome_no),playerId=String(b.player_id||""),hole=Number(b.hole),value=!!b.value;
    if(![1,2].includes(g)||!playerId||!Number.isInteger(hole)||hole<1||hole>18) return bad("Invalid 40 Ball selection");

    const player=await context.env.DB.prepare(
      "SELECT id FROM v2_players WHERE id=? AND event_id=? AND foursome_no=?"
    ).bind(playerId,eventId,g).first();
    if(!player)return bad("Player not in foursome",404);

    const score=await context.env.DB.prepare(
      "SELECT gross FROM v2_score_revisions WHERE event_id=? AND player_id=? AND hole=? AND gross IS NOT NULL"
    ).bind(eventId,playerId,hole).first();
    if(value&&!score)return bad("Enter gross score before counting it",409);

    if(value){
      const countRow=await context.env.DB.prepare(
        "SELECT COUNT(*) c FROM v2_forty_ball_selections WHERE event_id=? AND foursome_no=? AND selected=1"
      ).bind(eventId,g).first();
      const existing=await context.env.DB.prepare(
        "SELECT selected FROM v2_forty_ball_selections WHERE event_id=? AND foursome_no=? AND player_id=? AND hole=?"
      ).bind(eventId,g,playerId,hole).first();
      if(existing?.selected)return json({ok:true,foursome_no:g,player_id:playerId,hole,value:true});
      if(Number(countRow?.c||0)>=40) return bad("40 scores are already counted",409);
      try{
        await context.env.DB.prepare(
          `INSERT INTO v2_forty_ball_selections(event_id,foursome_no,player_id,hole,selected,updated_at)
           VALUES(?,?,?,?,1,CURRENT_TIMESTAMP)
           ON CONFLICT(event_id,foursome_no,player_id,hole)
           DO UPDATE SET selected=1,updated_at=CURRENT_TIMESTAMP`
        ).bind(eventId,g,playerId,hole).run();
      }catch(err){
        if(String(err?.message||err).includes("40 scores are already counted"))
          return bad("40 scores are already counted",409);
        throw err;
      }
    }else{
      await context.env.DB.prepare(
        "DELETE FROM v2_forty_ball_selections WHERE event_id=? AND foursome_no=? AND player_id=? AND hole=?"
      ).bind(eventId,g,playerId,hole).run();
    }
    await audit(context.env,eventId,"forty_ball",`${g}:${playerId}:${hole}`,"forty_ball_selection",{foursome_no:g,player_id:playerId,hole,value});
    return json({ok:true,foursome_no:g,player_id:playerId,hole,value});
  }catch(err){return bad(err.message||"Unable to save 40 Ball selection",err.status||400);}
}
