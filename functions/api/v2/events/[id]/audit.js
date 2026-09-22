import {json,bad,cleanId,requireEvent,requireOrganizer} from "../../_common.js";

export async function onRequestGet(context){
  try{
    const eventId=cleanId(context.params.id);
    await requireOrganizer(context,eventId);
    const limit=Math.min(100,Math.max(1,Number(new URL(context.request.url).searchParams.get("limit")||30)));
    const rows=await context.env.DB.prepare(
      `SELECT id,entity_type,entity_id,action,payload_json,created_at
       FROM v2_audit WHERE event_id=? ORDER BY id DESC LIMIT ?`
    ).bind(eventId,limit).all();
    return json({events:(rows.results||[]).map(r=>({...r,payload:JSON.parse(r.payload_json||"{}")}))});
  }catch(err){
    return bad(err.message||"Unable to load audit",err.status||400);
  }
}
