export class V2Api {
  constructor(base="/api/v2"){ this.base=base; this.organizerTokens=new Map(); }
  setOrganizerToken(id,token){if(token)this.organizerTokens.set(String(id),String(token));else this.organizerTokens.delete(String(id));}
  organizerHeaders(id){const t=this.organizerTokens.get(String(id));return t?{authorization:`Bearer ${t}`}:{}}

  async request(path,options={}){
    const res=await fetch(this.base+path,{
      cache:"no-store",
      headers:{"content-type":"application/json",...(options.headers||{})},
      ...options
    });
    let data={};
    try{ data=await res.json(); }catch{}
    if(!res.ok){
      const err=new Error(data.error||`API ${res.status}`);
      err.status=res.status; err.data=data; throw err;
    }
    return data;
  }

  createEvent(event,players){ return this.request("/events",{method:"POST",body:JSON.stringify({event,players})}); }
  snapshot(id){ return this.request(`/events/${encodeURIComponent(id)"}/snapshot`); }
  saveScore(id,payload){ return this.request(`/events/${encodeURIComponent(id)"}/scores`,{method:"PATCH",body:JSON.stringify(payload)}); }
  saveGames(id,games){ return this.request(`/events/${encodeURIComponent(id)"}/games`,{method:"PUT",headers:this.organizerHeaders(id),body:JSON.stringify({games})}); }
  configureGame(id,payload){ return this.request(`/events/${encodeURIComponent(id)"}/game-config`,{method:"PUT",headers:this.organizerHeaders(id),body:JSON.stringify(payload)}); }
  addPress(id,press){ return this.request(`/events/${encodeURIComponent(id)"}/presses`,{method:"POST",headers:this.organizerHeaders(id),body:JSON.stringify(press)}); }
  setFortyBallSelection(id,payload){ return this.request(`/events/${encodeURIComponent(id)"}/forty-ball`,{method:"PUT",body:JSON.stringify(payload)}); }
  audit(id,limit=30){ return this.request(`/events/${encodeURIComponent(id)"}/audit?limit=${limit}`,{headers:this.organizerHeaders(id)}); }
  scoreHistory(id,playerId="",hole=0){
    const q=new URLSearchParams(); if(playerId)q.set("player_id",playerId); if(hole)q.set("hole",String(hole));
    return this.request(`/events/${encodeURIComponent(id)"}/score-history?${q}`,{headers:this.organizerHeaders(id)});
  }
  backup(id){ return this.request(`/events/${encodeURIComponent(id)"}/backup`,{headers:this.organizerHeaders(id)}); }
  confirmation(id,foursomeNo,action="confirm",actor="organizer"){
    return this.request(`/events/${encodeURIComponent(id)"}/confirmation`,{method:"PUT",headers:action==="unlock"?this.organizerHeaders(id):{},body:JSON.stringify({foursome_no:foursomeNo,action,actor})});
  }
  restore(id,backup){ return this.request(`/events/${encodeURIComponent(id)"}/restore`,{method:"POST",headers:this.organizerHeaders(id),body:JSON.stringify({confirm:"RESTORE",backup})}); }
  reset(id,mode="scores"){ return this.request(`/events/${encodeURIComponent(id)"}/reset`,{method:"POST",headers:this.organizerHeaders(id),body:JSON.stringify({confirm:"RESET",mode})}); }
}

export function scoreMapFromSnapshot(snapshot){
  const scores={}, revisions={};
  for(const row of snapshot?.scores||[]){
    const key=`${row.player_id}-${row.hole}`;
    scores[key]=row.gross;
    revisions[key]=Number(row.revision||0);
  }
  return {scores,revisions};
}
