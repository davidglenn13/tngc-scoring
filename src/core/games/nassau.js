export const NASSAU_PRESETS={
  "5-5-5-1-1-1":[
    {key:"first5",label:"Holes 1–5",holes:[1,2,3,4,5],pairing:0},
    {key:"second5",label:"Holes 6–10",holes:[6,7,8,9,10],pairing:1},
    {key:"third5",label:"Holes 11–15",holes:[11,12,13,14,15],pairing:2},
    {key:"16",label:"Hole 16",holes:[16],pairing:0,singleHole:true},
    {key:"17",label:"Hole 17",holes:[17],pairing:1,singleHole:true},
    {key:"18",label:"Hole 18",holes:[18],pairing:2,singleHole:true}
  ],
  "6-6-6":[
    {key:"first6",label:"Holes 1–6",holes:[1,2,3,4,5,6],pairing:0},
    {key:"second6",label:"Holes 7–12",holes:[7,8,9,10,11,12],pairing:1},
    {key:"third6",label:"Holes 13–18",holes:[13,14,15,16,17,18],pairing:2}
  ]
};

export function rotatingTeams(players,pairing=0){
  if(players.length!==4) throw new Error("Rotating Nassau requires four players");
  const order=[[0,1,2,3],[0,2,1,3],[0,3,1,2]][pairing]||[0,1,2,3];
  return [[players[order[0]],players[order[1]]],[players[order[2]],players[order[3]]]];
}

export function segmentResult({segment,players,getNet,throughHole=null}){
  const teams=rotatingTeams(players,segment.pairing);
  let aWins=0,bWins=0,halves=0,played=0;
  const holes=segment.holes.map(h=>{
    if(throughHole!==null && h>throughHole) return {hole:h,status:"pending"};
    const a=teams[0].map(p=>getNet(p,h));
    const b=teams[1].map(p=>getNet(p,h));
    if(a.some(v=>v===null)||b.some(v=>v===null)) return {hole:h,status:"pending"};
    played++;
    const av=Math.min(...a),bv=Math.min(...b);
    if(av<bv){aWins++;return {hole:h,a:av,b:bv,status:"a"};}
    if(bv<av){bWins++;return {hole:h,a:av,b:bv,status:"b"};}
    halves++;return {hole:h,a:av,b:bv,status:"half"};
  });
  const complete=played===segment.holes.length;
  const winner=complete?(aWins>bWins?"a":bWins>aWins?"b":"half"):null;
  const margin=aWins-bWins;
  const loser=!played||aWins===bWins?null:(aWins<bWins?"a":"b");
  return {teams,aWins,bWins,halves,played,total:segment.holes.length,complete,winner,margin,loser,holes};
}

export function nextUnplayedHole({segment,players,getNet}){
  return segment.holes.find(h=>players.some(p=>getNet(p,h)===null)) ?? null;
}

export function pressResult({segment,players,press,getNet}){
  if(segment.singleHole) return null;
  const holes=segment.holes.filter(h=>h>=Number(press.fromHole));
  return segmentResult({segment:{...segment,holes},players,getNet});
}

export function originalPress(presses,segmentKey){
  return (presses||[]).filter(p=>p.segmentKey===segmentKey&&!p.parentPressId)
    .sort((a,b)=>Number(a.fromHole)-Number(b.fromHole))[0]||null;
}
export function counterPress(presses,parent){
  return parent?(presses||[]).find(p=>String(p.parentPressId||"")===String(parent.id)):null;
}

export function pressAvailability({segment,players,presses=[],getNet,currentHole=null}){
  if(segment.singleHole) return {kind:null,reason:"No presses on standalone one-hole matches"};
  const next=nextUnplayedHole({segment,players,getNet});
  if(next===null) return {kind:null,reason:"Match complete"};
  const original=originalPress(presses,segment.key);

  // Ballyhack's live workflow evaluates the match only through the current
  // hole. A press is offered on the next unplayed hole, before that hole's
  // scores are entered; if a press already exists, the opposing side may
  // press that bet from the same next unplayed hole.
  const through=currentHole===null?null:Number(currentHole);
  const currentComplete=through!==null&&players.length>0&&players.every(p=>getNet(p,through)!==null);
  const evaluatedThrough=through===null?null:(currentComplete?through:through-1);
  const standing=segmentResult({
    segment,
    players,
    getNet,
    throughHole:evaluatedThrough
  });

  if(!original){
    if(next===segment.holes[0]) return {kind:null,reason:"Earliest press is the second hole of the segment",nextHole:next};
    if(!standing.loser) return {kind:null,reason:"Base match is all square",nextHole:next};
    return {kind:"press",nextHole:next,pressedBy:standing.loser,standing};
  }

  const latest=[...presses].filter(p=>p.segmentKey===segment.key)
    .sort((a,b)=>Number(b.fromHole)-Number(a.fromHole))[0]||original;
  const duplicate=presses.some(p=>p.segmentKey===segment.key&&Number(p.fromHole)===Number(next));
  if(duplicate)return {kind:null,reason:"A press has already been recorded from this hole",nextHole:next};
  const opposite=latest.pressedBy==="a"?"b":"a";
  return {
    kind:"counter",
    nextHole:next,
    pressedBy:opposite,
    parentPressId:latest.id,
    standing:pressResult({segment,players,press:latest,getNet})
  };
}

export function sanitizePresses({segment,presses=[],nextHole}){
  if(segment.singleHole) return presses.filter(p=>p.segmentKey!==segment.key);
  let out=[...presses];
  if(nextHole!==null){
    const minStart=segment.holes[1];
    out=out.filter(p=>p.segmentKey!==segment.key || (Number(p.fromHole)>=minStart && Number(p.fromHole)<=nextHole));
  }
  const originals=new Map(out.filter(p=>!p.parentPressId).map(p=>[String(p.id),p]));
  return out.filter(p=>{
    if(!p.parentPressId)return true;
    const parent=originals.get(String(p.parentPressId));
    return !!parent && p.segmentKey===parent.segmentKey &&
      p.pressedBy!==parent.pressedBy && Number(p.fromHole)>=Number(parent.fromHole);
  });
}

export function applyNassauOutcome(net,outcome,amount){
  amount=Number(amount||0);
  if(!amount||!outcome?.complete||!outcome.winner||outcome.winner==="half") return;
  const winners=outcome.winner==="a"?outcome.teams[0]:outcome.teams[1];
  const losers=outcome.winner==="a"?outcome.teams[1]:outcome.teams[0];
  winners.forEach(p=>net[p.id]=(net[p.id]||0)+amount);
  losers.forEach(p=>net[p.id]=(net[p.id]||0)-amount);
}

export function nassauGroupNet({players,preset,wager,presses=[],getNet}){
  const net=Object.fromEntries(players.map(p=>[p.id,0]));
  const segments=NASSAU_PRESETS[preset]||[];
  for(const seg of segments) applyNassauOutcome(net,segmentResult({segment:seg,players,getNet}),wager);
  for(const p of presses){
    const seg=segments.find(s=>s.key===p.segmentKey);
    if(!seg||seg.singleHole)continue;
    applyNassauOutcome(net,pressResult({segment:seg,players,press:p,getNet}),p.amount);
  }
  return net;
}
