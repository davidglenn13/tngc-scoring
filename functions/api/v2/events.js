import {json,bad,newId,normalizePlayers,audit,randomSecret,sha256Hex} from "./_common.js";

export async function onRequestPost(context){
  try{
    const body=await context.request.json();
    const event=body.event||{};
    const players=normalizePlayers(body.players||[]);
    const id=newId("e_");
    const name=String(event.name||"TNGC Round").trim().slice(0,100);
    const eventDate=String(event.event_date||event.date||"").slice(0,10);
    const courseId=String(event.course_id||"tngc-charlotte");
    const mode=String(event.mode||"casual");
    const courseVersion=String(event.course_version||"tngc-2026-validated");
    const courseData=JSON.stringify(event.course_data||{});
    const organizerToken=randomSecret(24);
    const organizerHash=await sha256Hex(organizerToken);

    if(!eventDate) return bad("Missing event date");

    await context.env.DB.batch([
      context.env.DB.prepare(
        `INSERT INTO v2_events(id,name,event_date,course_id,mode,status,course_version,course_data_json,organizer_token_hash)
         VALUES(?,?,?,?,?,'live',?,?,?)`
      ).bind(id,name,eventDate,courseId,mode,courseVersion,courseData,organizerHash),
      ...players.map(p=>context.env.DB.prepare(
        `INSERT INTO v2_players(
          id,event_id,display_name,handicap_index,tee_key,course_handicap,foursome_no,sort_order
        ) VALUES(?,?,?,?,?,?,?,?)`
      ).bind(p.id,id,p.display_name,p.handicap_index,p.tee_key,p.course_handicap,p.foursome_no,p.sort_order))
    ]);

    await audit(context.env,id,"event",id,"event_created",{
      player_count:players.length,course_id:courseId,mode
    });

    return json({id,status:"live",players:players.map(p=>p.id),organizer_token:organizerToken},201);
  }catch(err){
    return bad(err.message||"Unable to create event",err.status||400);
  }
}
