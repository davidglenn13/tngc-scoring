import {json,bad,cleanId,newId,requireEvent,audit,requireOrganizer} from "../../_common.js";

async function existingNassau(env,eventId,g){
  return await env.DB.prepare(
    "SELECT * FROM v2_games WHERE event_id=? AND game_type='nassau' AND foursome_no=? AND status='active' LIMIT 1"
  ).bind(eventId,g).first();
}
async function existingForty(env,eventId){
  return await env.DB.prepare(
    "SELECT * FROM v2_games WHERE event_id=? AND game_type='forty_ball' AND status='active' LIMIT 1"
  ).bind(eventId).first();
}

export async function onRequestPut(context){
  try{
    const eventId=cleanId(context.params.id);
    await requireOrganizer(context,eventId);
    const b=await context.request.json();
    const mode=String(b.mode||"none");
    const g=Number(b.foursome_no||1);
    const wager=Math.max(0,Math.round(Number(b.wager_cents||0)));

    if(mode==="forty_ball"){
      if(g!==1)return bad("40 Ball must be selected from Foursome 1",409);
      const current=await existingForty(context.env,eventId);

      // 40 Ball replaces Nassau for the outing, matching Ballyhack's round-wide rule.
      await context.env.DB.prepare(
        "DELETE FROM v2_games WHERE event_id=? AND game_type='nassau'"
      ).bind(eventId).run();

      if(current){
        await context.env.DB.prepare(
          "UPDATE v2_games SET wager_cents=?,preset_key='manual-40-relative-to-par',config_json='{}' WHERE id=?"
        ).bind(wager,current.id).run();
      }else{
        await context.env.DB.prepare(
          `INSERT INTO v2_games(id,event_id,game_type,preset_key,foursome_no,wager_cents,config_json,status)
           VALUES(?,?,'forty_ball','manual-40-relative-to-par',NULL,?,'{}','active')`
        ).bind(newId("g_"),eventId,wager).run();
      }

      await audit(context.env,eventId,"games",eventId,"game_config_changed",{mode,wager_cents:wager});
      return json({ok:true,mode:"forty_ball"});
    }

    if(mode==="nassau"){
      if(![1,2].includes(g))return bad("Invalid foursome");
      const preset=String(b.preset_key||"5-5-5-1-1-1");
      if(!["5-5-5-1-1-1","6-6-6"].includes(preset))return bad("Invalid Nassau format");

      // Any Nassau selection turns off the round-wide 40 Ball game and selections.
      await context.env.DB.prepare(
        "DELETE FROM v2_games WHERE event_id=? AND game_type='forty_ball'"
      ).bind(eventId).run();
      await context.env.DB.prepare(
        "DELETE FROM v2_forty_ball_selections WHERE event_id=?"
      ).bind(eventId).run();

      const current=await existingNassau(context.env,eventId,g);
      if(current && current.preset_key===preset){
        // Wager edit: preserve press records and keep every press at the base wager,
        // exactly like Ballyhack production.
        await context.env.DB.batch([
          context.env.DB.prepare("UPDATE v2_games SET wager_cents=? WHERE id=?").bind(wager,current.id),
          context.env.DB.prepare("UPDATE v2_presses SET wager_cents=? WHERE game_id=?").bind(wager,current.id)
        ]);
      }else{
        // Format change resets that foursome's old Nassau/press state.
        if(current) await context.env.DB.prepare("DELETE FROM v2_games WHERE id=?").bind(current.id).run();
        await context.env.DB.prepare(
          `INSERT INTO v2_games(id,event_id,game_type,preset_key,foursome_no,wager_cents,config_json,status)
           VALUES(?,?,'nassau',?,?,?,'{}','active')`
        ).bind(newId("g_"),eventId,preset,g,wager).run();
      }

      await audit(context.env,eventId,"games",eventId,"game_config_changed",{
        mode:"nassau",foursome_no:g,preset_key:preset,wager_cents:wager
      });
      return json({ok:true,mode:"nassau",foursome_no:g,preset_key:preset});
    }

    if(mode==="none"){
      if(b.scope==="round"){
        // Ballyhack hard reset behavior for None.
        await context.env.DB.batch([
          context.env.DB.prepare("DELETE FROM v2_forty_ball_selections WHERE event_id=?").bind(eventId),
          context.env.DB.prepare("DELETE FROM v2_games WHERE event_id=?").bind(eventId)
        ]);
      }else{
        if(![1,2].includes(g))return bad("Invalid foursome");
        await context.env.DB.prepare(
          "DELETE FROM v2_games WHERE event_id=? AND game_type='nassau' AND foursome_no=?"
        ).bind(eventId,g).run();
      }
      await audit(context.env,eventId,"games",eventId,"game_config_changed",{
        mode:"none",scope:b.scope==="round"?"round":"foursome",foursome_no:g
      });
      return json({ok:true,mode:"none"});
    }

    return bad("Invalid game mode");
  }catch(err){return bad(err.message||"Unable to update game configuration",err.status||400);}
}
