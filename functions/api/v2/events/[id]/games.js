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

    const rosterResult=await context.env.DB.prepare(
      "SELECT foursome_no,COUNT(*) count FROM v2_players WHERE event_id=? GROUP BY foursome_no ORDER BY foursome_no"
    ).bind(eventId).all();
    const roster=Object.fromEntries((rosterResult.results||[]).map(x=>[Number(x.foursome_no),Number(x.count)]));
    const hasBall=games.some(g=>String(g.game_type||"")==="forty_ball");
    const hasNassau=games.some(g=>String(g.game_type||"")==="nassau");
    if(hasBall&&hasNassau)return bad("Choose Nassau or a Ball game, not both",409);

    const deletes=context.env.DB.prepare("DELETE FROM v2_games WHERE event_id=?").bind(eventId);
    const inserts=games.map(g=>{
      const id=String(g.id||newId("g_"));
      const type=String(g.game_type||"");
      const preset=String(g.preset_key||"");
      const foursome=g.foursome_no==null?null:Number(g.foursome_no);
      const wager=Math.max(0,Math.round(Number(g.wager_cents||0)));
      if(!["nassau","forty_ball","stableford"].includes(type)) throw new Error("Invalid game type");
      if(type==="nassau"){
        if(wager<=0)throw new Error("Enter the Nassau wager");
        if(![1,2].includes(foursome)||roster[foursome]!==4)throw new Error("Nassau requires four players in each participating foursome");
      }
      if(type==="forty_ball"){
        const target=Number(g.config?.target_count)===30?30:40,per=target===30?3:4;
        if(wager<=0)throw new Error(`Enter the ${target} Ball wager`);
        if(roster[1]!==per||roster[2]!==per)throw new Error(`${target} Ball requires two groups of ${per}`);
      }
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
