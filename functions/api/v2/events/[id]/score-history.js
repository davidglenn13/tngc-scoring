import {json,bad,cleanId,requireEvent,requireOrganizer} from "../../_common.js";

export async function onRequestGet(context){
  try{
    const eventId=cleanId(context.params.id);
    await requireOrganizer(context,eventId);
    const url=new URL(context.request.url);
    const playerId=String(url.searchParams.get("player_id")||"");
    const hole=Number(url.searchParams.get("hole")||0);
    let sql=`SELECT id,entity_id,action,payload_json,created_at
             FROM v2_audit
             WHERE event_id=? AND entity_type='score'`;
    const binds=[eventId];
    if(playerId){ sql+=" AND json_extract(payload_json,'$.player_id')=?"; binds.push(playerId); }
    if(hole){ sql+=" AND json_extract(payload_json,'$.hole')=?"; binds.push(hole); }
    sql+=" ORDER BY id DESC LIMIT 100";
    const rows=await context.env.DB.prepare(sql).bind(...binds).all();
    return json({history:(rows.results||[]).map(r=>({...r,payload:JSON.parse(r.payload_json||"{}")}))});
  }catch(err){ return bad(err.message||"Unable to load score history",err.status||400); }
}
