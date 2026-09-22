export function json(data,status=200,headers={}){
  return new Response(JSON.stringify(data),{
    status,
    headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}
  });
}
export function bad(message,status=400){ return json({error:message},status); }
export function cleanId(value){
  const s=String(value||"");
  if(!/^[A-Za-z0-9_-]{6,64}$/.test(s)) throw new Error("Invalid id");
  return s;
}
export function newId(prefix=""){
  const raw=crypto.randomUUID().replaceAll("-","");
  return `${prefix}${raw.slice(0,16)}`;
}
export async function requireEvent(env,id){
  const row=await env.DB.prepare("SELECT * FROM v2_events WHERE id=?").bind(id).first();
  if(!row) throw Object.assign(new Error("Event not found"),{status:404});
  return row;
}
export function normalizePlayers(players=[]){
  if(!Array.isArray(players)||players.length<2||players.length>8) throw new Error("Use 2–8 players");
  return players.map((p,i)=>{
    const name=String(p.display_name||p.name||"").trim();
    const hi=Number(p.handicap_index ?? p.index);
    const tee=String(p.tee_key||p.tee||"");
    const foursome=Number(p.foursome_no||p.foursome||1);
    const ch=Number(p.course_handicap);
    if(!name) throw new Error("Every player needs a name");
    if(!Number.isFinite(hi)||hi < -10 || hi > 54) throw new Error(`Invalid handicap index for ${name}`);
    if(!tee) throw new Error(`Missing tee for ${name}`);
    if(![1,2].includes(foursome)) throw new Error(`Invalid foursome for ${name}`);
    if(!Number.isInteger(ch)) throw new Error(`Missing course handicap for ${name}`);
    return {
      id:String(p.id||newId("p_")),
      display_name:name,
      handicap_index:hi,
      tee_key:tee,
      course_handicap:ch,
      foursome_no:foursome,
      sort_order:Number.isInteger(Number(p.sort_order))?Number(p.sort_order):i
    };
  });
}
export async function audit(env,eventId,entityType,entityId,action,payload={}){
  await env.DB.prepare(
    `INSERT INTO v2_audit(event_id,entity_type,entity_id,action,payload_json)
     VALUES(?,?,?,?,?)`
  ).bind(eventId,entityType,entityId||null,action,JSON.stringify(payload)).run();
}

export function bearerToken(request){
  const auth=String(request.headers.get("authorization")||"");
  if(auth.toLowerCase().startsWith("bearer "))return auth.slice(7).trim();
  return String(request.headers.get("x-organizer-token")||"").trim();
}
export async function sha256Hex(value){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(value||"")));
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
export function randomSecret(bytes=24){
  const a=new Uint8Array(bytes);crypto.getRandomValues(a);
  return [...a].map(x=>x.toString(16).padStart(2,"0")).join("");
}
export async function requireOrganizer(context,eventId){
  const event=await requireEvent(context.env,eventId);
  const token=bearerToken(context.request);
  if(!token||!event.organizer_token_hash)throw Object.assign(new Error("Organizer authorization required"),{status:403});
  if(await sha256Hex(token)!==String(event.organizer_token_hash))
    throw Object.assign(new Error("Organizer authorization failed"),{status:403});
  return event;
}
