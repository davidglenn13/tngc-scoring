import {json,bad,cleanId,requireEventAccess,audit} from "../../_common.js";

async function cell(env,eventId,playerId,hole){
  return await env.DB.prepare(
    "SELECT gross,revision,updated_at,updated_by FROM v2_score_revisions WHERE event_id=? AND player_id=? AND hole=?"
  ).bind(eventId,playerId,hole).first();
}
const changed=r=>Number(r?.meta?.changes??r?.changes??0);

export async function onRequestPatch(context){
  try{
    const eventId=cleanId(context.params.id);const access=await requireEventAccess(context,eventId);
    const b=await context.request.json();
    const playerId=String(b.player_id||""),hole=Number(b.hole);
    const gross=b.gross===""||b.gross===null?null:Number(b.gross);
    const expected=b.expected_revision===undefined||b.expected_revision===null?null:Number(b.expected_revision);
    const updatedBy=String(b.updated_by||"scorer").slice(0,80);
    if(!playerId)return bad("Missing player");
    if(!Number.isInteger(hole)||hole<1||hole>18)return bad("Invalid hole");
    if(gross!==null&&(!Number.isInteger(gross)||gross<1||gross>15))return bad("Gross score must be 1–15");
    const player=await context.env.DB.prepare(
      "SELECT id,foursome_no FROM v2_players WHERE id=? AND event_id=?"
    ).bind(playerId,eventId).first();
    if(!player)return bad("Player not in event",404);
    if(!access.organizer&&Number(player.foursome_no)!==Number(access.foursome))return bad("This private link can only score its own foursome",403);

    const card=await context.env.DB.prepare(
      "SELECT status FROM v2_scorecard_confirmations WHERE event_id=? AND foursome_no=?"
    ).bind(eventId,Number(player.foursome_no)).first();
    if(card?.status==="confirmed")
      return bad("Scorecard confirmed; organizer must unlock it for correction",423);

    const before=await cell(context.env,eventId,playerId,hole);
    if(gross===null&&!before&&expected===null)return json({player_id:playerId,hole,gross:null,revision:0});

    let result;
    if(before){
      if(expected===null)return json({error:"Revision conflict",conflict:true,server:before},409);
      result=await context.env.DB.prepare(
        `UPDATE v2_score_revisions SET gross=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP,updated_by=?
         WHERE event_id=? AND player_id=? AND hole=? AND revision=?`
      ).bind(gross,updatedBy,eventId,playerId,hole,expected).run();
      if(changed(result)!==1)return json({error:"Revision conflict",conflict:true,server:await cell(context.env,eventId,playerId,hole)},409);
    }else{
      if(expected!==null)return json({error:"Revision conflict",conflict:true,server:{gross:null,revision:0}},409);
      result=await context.env.DB.prepare(
        `INSERT INTO v2_score_revisions(event_id,player_id,hole,gross,revision,updated_at,updated_by)
         VALUES(?,?,?,?,1,CURRENT_TIMESTAMP,?)
         ON CONFLICT(event_id,player_id,hole) DO NOTHING`
      ).bind(eventId,playerId,hole,gross,updatedBy).run();
      if(changed(result)!==1)return json({error:"Revision conflict",conflict:true,server:await cell(context.env,eventId,playerId,hole)},409);
    }

    const after=await cell(context.env,eventId,playerId,hole);
    if(gross===null){
      await context.env.DB.prepare("DELETE FROM v2_scores WHERE event_id=? AND player_id=? AND hole=?")
        .bind(eventId,playerId,hole).run();
    }else{
      await context.env.DB.prepare(
        `INSERT INTO v2_scores(event_id,player_id,hole,gross,revision,updated_at,updated_by)
         VALUES(?,?,?,?,?,CURRENT_TIMESTAMP,?)
         ON CONFLICT(event_id,player_id,hole) DO UPDATE SET
           gross=excluded.gross,revision=excluded.revision,updated_at=CURRENT_TIMESTAMP,updated_by=excluded.updated_by`
      ).bind(eventId,playerId,hole,gross,after.revision,updatedBy).run();
    }
    await audit(context.env,eventId,"score",`${playerId}:${hole}`,
      gross===null?"score_deleted":before?"score_updated":"score_created",{
        player_id:playerId,hole,old_gross:before?.gross??null,new_gross:gross,
        old_revision:before?.revision??0,new_revision:after.revision,updated_by:updatedBy
      });
    return json({player_id:playerId,hole,...after});
  }catch(err){return bad(err.message||"Unable to save score",err.status||400);}
}
