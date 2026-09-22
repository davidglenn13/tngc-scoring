import {json,bad,cleanId,requireEvent,requireOrganizer,audit} from "../../_common.js";

async function groupComplete(env,eventId,g){
  const players=await env.DB.prepare(
    "SELECT id FROM v2_players WHERE event_id=? AND foursome_no=?"
  ).bind(eventId,g).all();
  const ids=(players.results||[]).map(x=>x.id);
  if(!ids.length)return false;
  const placeholders=ids.map(()=>"?").join(",");
  const row=await env.DB.prepare(
    `SELECT COUNT(*) c FROM v2_score_revisions
     WHERE event_id=? AND gross IS NOT NULL AND player_id IN (${placeholders})`
  ).bind(eventId,...ids).first();
  return Number(row?.c||0)===ids.length*18;
}

export async function onRequestPut(context){
  try{
    const eventId=cleanId(context.params.id);
    await requireEvent(context.env,eventId);
    const body=await context.request.json();
    const g=Number(body.foursome_no);
    const action=String(body.action||"confirm");
    const actor=String(body.actor||"organizer").slice(0,80);
    if(![1,2].includes(g))return bad("Invalid foursome");

    if(action==="confirm"){
      if(!await groupComplete(context.env,eventId,g))return bad("Scorecard is not complete",409);
      await context.env.DB.prepare(
        `INSERT INTO v2_scorecard_confirmations(event_id,foursome_no,status,confirmed_at,confirmed_by,updated_at)
         VALUES(?,?,'confirmed',CURRENT_TIMESTAMP,?,CURRENT_TIMESTAMP)
         ON CONFLICT(event_id,foursome_no) DO UPDATE SET
           status='confirmed',confirmed_at=CURRENT_TIMESTAMP,confirmed_by=excluded.confirmed_by,updated_at=CURRENT_TIMESTAMP`
      ).bind(eventId,g,actor).run();
      await audit(context.env,eventId,"scorecard",String(g),"scorecard_confirmed",{foursome_no:g,actor});
      return json({ok:true,foursome_no:g,status:"confirmed"});
    }

    if(action==="unlock"){
      await requireOrganizer(context,eventId);
      await context.env.DB.prepare(
        `INSERT INTO v2_scorecard_confirmations(event_id,foursome_no,status,confirmed_at,confirmed_by,updated_at)
         VALUES(?,?,'in_progress',NULL,NULL,CURRENT_TIMESTAMP)
         ON CONFLICT(event_id,foursome_no) DO UPDATE SET
           status='in_progress',confirmed_at=NULL,confirmed_by=NULL,updated_at=CURRENT_TIMESTAMP`
      ).bind(eventId,g).run();
      await audit(context.env,eventId,"scorecard",String(g),"scorecard_unlocked",{foursome_no:g,actor});
      return json({ok:true,foursome_no:g,status:"in_progress"});
    }

    return bad("Invalid confirmation action");
  }catch(err){return bad(err.message||"Unable to update scorecard status",err.status||400);}
}
