
const COURSE = {
  name: "Trump National Golf Club Charlotte",
  par: [4,5,3,4,4,4,3,5,4,4,4,5,3,4,3,5,4,4],
  handicap: [8,6,14,12,4,2,16,18,10,1,7,15,9,5,17,11,13,3],
  tees: {
    Black: {rating:75.7,slope:146,yards:7296},
    Gold: {rating:73.8,slope:142,yards:6904},
    "Gold/Blue Hybrid": {rating:72.6,slope:139,yards:6637},
    Blue: {rating:71.1,slope:137,yards:6325},
    "Blue/White Hybrid": {rating:70.0,slope:127,yards:6004},
    White: {rating:68.2,slope:120,yards:5628}
  }
};

const state = {
  outing:{name:"TNGC Round",date:""},
  players:[],
  scores:{},
  hole:1,
  group:1,
  visited18:false,
  outingId:null,
  cloudMode:true,
  syncTimer:null,
  games:{
    nassau:{enabled:false,wager:5,presses:[]},
    forty:{enabled:false,wager:5}
  },
  organizerMode:true,
  nassauTeams:{}
};

const $ = s => document.querySelector(s);
const playersEl = $("#players");
const today = new Date().toISOString().slice(0,10);
$("#outingDate").value = today;

function courseHandicap(index, tee){
  const t = COURSE.tees[tee];
  return Math.round(index * (t.slope/113) + (t.rating - 72));
}

function addPlayer(data={}){
  if(state.players.length >= 8) return;
  state.players.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()),
    name:data.name || "",
    index:data.index ?? "",
    tee:data.tee || "Blue",
    group:data.group || (state.players.length < 4 ? 1 : 2)
  });
  renderPlayers();
}

function hasSecondFoursome(){ return state.players.length >= 5; }

function normalizeFoursomes(){
  if(!hasSecondFoursome()){
    state.players.forEach(p=>{ p.group=1; });
    state.group=1;
  }
}

function renderPlayers(){
  normalizeFoursomes();
  playersEl.innerHTML = "";
  const showFoursomeSelector=hasSecondFoursome();
  state.players.forEach((p,i)=>{
    const row = document.createElement("div");
    row.className=`player-row${showFoursomeSelector?"":" single-foursome"}`;
    row.innerHTML=`
      <label>Name<input data-k="name" value="${escapeHtml(p.name)}" placeholder="Player ${i+1}"></label>
      <label>Index<input data-k="index" type="number" step=".1" min="-10" max="54" value="${p.index}"></label>
      <label>Tee<select data-k="tee">${Object.keys(COURSE.tees).map(t=>`<option ${t===p.tee?"selected":""}>${t}</option>`).join("")}</select></label>
      ${showFoursomeSelector?`<label>Foursome<select data-k="group"><option value="1" ${p.group==1?"selected":""}>1</option><option value="2" ${p.group==2?"selected":""}>2</option></select></label>`:""}
      <button class="secondary" aria-label="Remove">×</button>`;
    row.querySelectorAll("input,select").forEach(el=>el.addEventListener("change",()=>{
      let v=el.value;
      if(el.dataset.k==="index") v = v==="" ? "" : Number(v);
      if(el.dataset.k==="group") v=Number(v);
      p[el.dataset.k]=v;
    }));
    row.querySelector("button").onclick=()=>{state.players.splice(i,1);renderPlayers()};
    playersEl.appendChild(row);
  });
  $("#addPlayerBtn").disabled = state.players.length>=8 || !state.organizerMode;
  applyOrganizerMode();
}

function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]))}

$("#addPlayerBtn").onclick=()=>addPlayer();

$("#startRoundBtn").onclick=async()=>{
  state.outing.name=$("#outingName").value.trim()||"TNGC Round";
  state.outing.date=$("#outingDate").value;
  if(state.players.length<2) return alert("Add at least two players.");
  if(state.players.some(p=>!p.name.trim() || p.index==="")) return alert("Enter a name and index for every player.");
  const names=state.players.map(p=>p.name.trim().toLowerCase());
  if(new Set(names).size!==names.length) return alert("Player names must be unique.");
  const g1=state.players.filter(p=>p.group===1).length, g2=state.players.filter(p=>p.group===2).length;
  if(g1>4 || g2>4) return alert("Each foursome can have no more than 4 players.");
  if(hasSecondFoursome() && (g1===0 || g2===0)) return alert("Assign at least one player to each foursome.");
  state.hole=1; state.group=1; state.visited18=false;
  await ensureCloudOuting();
  $("#setupView").classList.add("hidden");
  $("#scoreView").classList.remove("hidden");
  $("#nav").classList.remove("hidden");
  renderScoring();
  renderGames();
  renderScorecard();
  renderLedger();
};

$("#editSetupBtn").onclick=()=>{
  $("#scoreView").classList.add("hidden");
  $("#setupView").classList.remove("hidden");
};

$("#resetBtn").onclick=()=>{
  if(!confirm("Start a new outing? Current beta data on this device will be cleared.")) return;
  state.players=[]; state.scores={}; state.hole=1; state.group=1; state.visited18=false; state.outingId=null;
  state.games={nassau:{enabled:false,wager:5,presses:[]},forty:{enabled:false,wager:5}};
  state.nassauTeams={};
  $("#outingName").value="TNGC Round"; $("#outingDate").value=today;
  const u=new URL(location.href); u.searchParams.delete("outing"); history.replaceState(null,"",u);
  renderPlayers();
  $("#nav").classList.add("hidden");
  ["scoreView","gamesView","scorecardView","ledgerView"].forEach(id=>$("#"+id).classList.add("hidden"));
  $("#setupView").classList.remove("hidden");
  setSyncStatus("New outing ready","");
};

document.querySelectorAll(".group-tab").forEach(btn=>btn.onclick=()=>{
  const joined=joinedPlayer();
  if(joined && joined.group!==Number(btn.dataset.group)) return alert("You joined Foursome "+joined.group+". This shared scorecard is limited to your foursome.");
  state.group=Number(btn.dataset.group);
  renderScoring();
});

$("#prevHole").onclick=()=>{
  if(state.hole===1){
    if(state.visited18) state.hole=18;
    else return;
  } else state.hole--;
  renderScoring();
};
$("#nextHole").onclick=()=>{
  if(state.hole===18){ state.visited18=true; state.hole=1; }
  else state.hole++;
  if(state.hole===18) state.visited18=true;
  renderScoring();
};

function renderScoring(){
  $("#roundLabel").textContent=`${state.outing.name} · ${state.outing.date}`;
  $("#holeNumber").textContent=state.hole;
  const idx=state.hole-1;
  $("#holeMeta").textContent=`Par ${COURSE.par[idx]} · Handicap ${COURSE.handicap[idx]}`;
  const showFoursomeSelector=hasSecondFoursome();
  $("#foursomeTabs").classList.toggle("hidden",!showFoursomeSelector);
  if(!showFoursomeSelector) state.group=1;
  document.querySelectorAll(".group-tab").forEach(b=>b.classList.toggle("active",Number(b.dataset.group)===state.group));
  $("#prevHole").style.opacity=(state.hole===1&&!state.visited18)?.35:1;

  const groupPlayers=state.players.filter(p=>p.group===state.group);
  const completedHoles=[...Array(18)].filter((_,i)=>groupPlayers.length>0 && groupPlayers.every(p=>Number(state.scores[`${p.id}-${i+1}`]||0)>0)).length;
  $("#groupProgress").textContent=`${showFoursomeSelector?`Foursome ${state.group}: `:""}${completedHoles}/18 holes complete`;
  const rows=$("#scoreRows"); rows.innerHTML="";
  groupPlayers.forEach(p=>{
    const key=`${p.id}-${state.hole}`;
    const ch=courseHandicap(Number(p.index),p.tee);
    const row=document.createElement("div");
    row.className="score-row";
    row.innerHTML=`
      <div><div class="player-name">${escapeHtml(p.name)}</div><div class="player-meta">${p.tee} · Index ${Number(p.index).toFixed(1)} · Course Hcp ${ch}</div></div>
      <div class="score-stepper">
        <button type="button" class="score-step" data-step="-1" aria-label="Decrease score">−</button>
        <input class="score-input" data-score-key="${key}" inputmode="numeric" type="number" min="1" max="15" value="${state.scores[key]??""}" placeholder="—">
        <button type="button" class="score-step" data-step="1" aria-label="Increase score">+</button>
      </div>`;
    const input=row.querySelector("input");
    input.oninput=e=>{
      let v=e.target.value===""?"":Math.max(1,Math.min(15,Number(e.target.value)));
      if(v!=="") e.target.value=v;
      state.scores[key]=v;
      saveLocal(true);
      pushScoreCloud(key,v);
      renderGames(); renderScorecard(); renderLedger(); renderPressCard();
    };
    row.querySelectorAll("[data-step]").forEach(btn=>btn.onclick=()=>{
      const cur=Number(input.value||COURSE.par[state.hole-1]);
      const next=Math.max(1,Math.min(15,cur+Number(btn.dataset.step)));
      input.value=next; state.scores[key]=next;
      saveLocal(true); pushScoreCloud(key,next); renderScoring();
    });
    rows.appendChild(row);
  });
  const entered=Object.values(state.scores).filter(v=>v!=="").length;
  const allComplete=state.players.length>0 && state.players.every(p=>[...Array(18)].every((_,i)=>Number(state.scores[`${p.id}-${i+1}`]||0)>0));
  $("#summary").innerHTML=allComplete
    ? `<b>Round complete.</b> All ${state.players.length} players have 18 scores entered.`
    : `${entered} gross hole scores entered.`;
  renderGames();
  renderScorecard();
  renderLedger();
  renderPressCard();
  saveLocal(true);
}



function strokesOffForGroup(group){
  const ps=groupPlayers(group);
  if(!ps.length) return {};
  const handicaps=Object.fromEntries(ps.map(p=>[p.id,courseHandicap(Number(p.index),p.tee)]));
  const low=Math.min(...Object.values(handicaps));
  return Object.fromEntries(ps.map(p=>[p.id,handicaps[p.id]-low]));
}

function strokesOnHole(player,hole){
  const ch=courseHandicap(Number(player.index),player.tee);
  if(ch<=0) return 0;
  const si=COURSE.handicap[hole-1];
  const base=Math.floor(ch/18);
  const rem=ch%18;
  return base + (si<=rem ? 1 : 0);
}

function netScore(player,hole){
  const gross=Number(state.scores[`${player.id}-${hole}`]||0);
  if(!gross) return null;
  return gross-strokesOnHole(player,hole);
}

function stablefordPoints(player,hole){
  const n=netScore(player,hole);
  if(n===null) return null;
  const diff=n-COURSE.par[hole-1];
  if(diff<=-3) return 5;
  if(diff===-2) return 4;
  if(diff===-1) return 3;
  if(diff===0) return 2;
  if(diff===1) return 1;
  return 0;
}

function groupPlayers(g){ return state.players.filter(p=>p.group===g); }

function nassauTeamsForGroup(group,pairing=0){
  const ps=groupPlayers(group);
  // Ballyhack's rotating-partner Nassau: 5-5-5-1-1-1.
  // With a full foursome, partners rotate for each segment.
  if(ps.length===4){
    const orders=[[0,1,2,3],[0,2,1,3],[0,3,1,2]];
    const o=orders[pairing]||orders[0];
    return {a:[ps[o[0]],ps[o[1]]],b:[ps[o[2]],ps[o[3]]]};
  }
  const saved=state.nassauTeams?.[group] || {};
  const a=[], b=[];
  ps.forEach((p,i)=>{
    const side=saved[p.id] || (i%2===0 ? "a" : "b");
    (side==="b" ? b : a).push(p);
  });
  return {a,b};
}

function nassauSegmentResult(group, holes, pairing=0){
  const {a,b}=nassauTeamsForGroup(group,pairing);
  if(!a.length || !b.length) return {complete:false,label:"Assign Nassau teams"};
  let aWins=0,bWins=0,played=0;
  for(const h of holes){
    const av=a.map(p=>netScore(p,h)).filter(v=>v!==null);
    const bv=b.map(p=>netScore(p,h)).filter(v=>v!==null);
    if(!av.length||!bv.length) continue;
    played++;
    const aa=Math.min(...av), bb=Math.min(...bv);
    if(aa<bb)aWins++; else if(bb<aa)bWins++;
  }
  const complete=played===holes.length;
  const winner=complete?(aWins>bWins?"a":bWins>aWins?"b":"half"):null;
  return {complete,winner,a,b,aWins,bWins,played,total:holes.length};
}

function teamName(team){ return team.map(p=>p.name.split(" ")[0]).join(" / "); }


function nassauSegments(){
  if(state.games?.nassau?.format==="666") return [
    {key:"first6",name:"Holes 1–6",holes:[1,2,3,4,5,6],pairing:0},
    {key:"second6",name:"Holes 7–12",holes:[7,8,9,10,11,12],pairing:1},
    {key:"third6",name:"Holes 13–18",holes:[13,14,15,16,17,18],pairing:2}
  ];
  return [
    {key:"first5",name:"Holes 1–5",holes:[1,2,3,4,5],pairing:0},
    {key:"second5",name:"Holes 6–10",holes:[6,7,8,9,10],pairing:1},
    {key:"third5",name:"Holes 11–15",holes:[11,12,13,14,15],pairing:2},
    {key:"hole16",name:"Hole 16",holes:[16],pairing:0,singleHole:true},
    {key:"hole17",name:"Hole 17",holes:[17],pairing:1,singleHole:true},
    {key:"hole18",name:"Hole 18",holes:[18],pairing:2,singleHole:true}
  ];
}

function currentNassauSegment(hole){
  return nassauSegments().find(seg=>seg.holes.includes(hole)) || nassauSegments()[0];
}

function currentSegmentStanding(group, seg){
  const r=nassauSegmentResult(group, seg.holes.filter(h=>h<state.hole || (h===state.hole && groupPlayers(group).every(p=>Number(state.scores[`${p.id}-${h}`]||0)>0))),seg.pairing);
  if(!r.a || !r.b) return {margin:0,loser:null,...r};
  const margin=Math.abs(r.aWins-r.bWins);
  const loser=r.aWins===r.bWins?null:(r.aWins<r.bWins?"a":"b");
  return {margin,loser,...r};
}

function nextUnplayedHoleForGroup(group, seg){
  for(const h of seg.holes){
    const complete=groupPlayers(group).every(p=>Number(state.scores[`${p.id}-${h}`]||0)>0);
    if(!complete) return h;
  }
  return null;
}

function activePressesFor(group, segKey){
  const list=Array.isArray(state.games?.nassau?.presses)?state.games.nassau.presses:[];
  return list.filter(p=>Number(p.group)===Number(group) && p.segment===segKey);
}

function latestPressFor(group, segKey){
  return activePressesFor(group,segKey).sort((a,b)=>Number(b.fromHole)-Number(a.fromHole))[0] || null;
}

function pressOutcome(press){
  const seg=nassauSegments().find(s=>s.key===press.segment);
  if(!seg) return null;
  const holes=seg.holes.filter(h=>h>=Number(press.fromHole));
  return nassauSegmentResult(Number(press.group),holes,seg.pairing);
}

function canPressNow(group){
  if(!state.games?.nassau?.enabled) return {ok:false,reason:"Nassau is not enabled."};
  const seg=currentNassauSegment(state.hole);
  if(seg.singleHole) return {ok:false,reason:`${seg.name} is a standalone Nassau match; presses are not available.`,seg};
  const next=nextUnplayedHoleForGroup(group,seg);
  if(next===null) return {ok:false,reason:"This Nassau match is complete.",seg};
  if(state.hole!==next) return {ok:false,reason:`Presses can only start on the next unplayed hole, Hole ${next}.`,seg};
  if(state.hole===seg.holes[0]) return {ok:false,reason:`A press cannot start on the first hole of ${seg.name}.`,seg};
  const latest=latestPressFor(group,seg.key);
  const duplicate=activePressesFor(group,seg.key).some(p=>Number(p.fromHole)===state.hole);
  if(duplicate) return {ok:false,reason:"A press has already been recorded from this hole.",seg};
  if(latest){
    const pressingSide=latest.pressedBy==="a"?"b":"a";
    return {ok:true,seg,loser:pressingSide,type:"press-back",parent:latest,reason:"The opposing side may press the press on this next unplayed hole."};
  }
  const standing=currentSegmentStanding(group,seg);
  if(!standing.loser) return {ok:false,reason:"A press is available only to the side currently losing the match.",seg,standing};
  return {ok:true,seg,standing,loser:standing.loser,type:"press"};
}

function addPress(group){
  if(!state.organizerMode) return alert("Organizer Mode is required to add a press.");
  const check=canPressNow(group);
  if(!check.ok) return alert(check.reason);
  const wager=Number(state.games?.nassau?.wager||0);
  if(!wager) return alert("Enter the Nassau wager first.");
  const teams=nassauTeamsForGroup(group,check.seg.pairing);
  const pressingTeam=check.loser==="a"?teams.a:teams.b;
  const label=teamName(pressingTeam);
  const action=check.type==="press-back"?"press the press":"press";
  if(!confirm(`${label} ${action} from Hole ${state.hole} for $${wager}?`)) return;

  state.games.nassau.presses ??=[];
  state.games.nassau.presses.push({
    id:`p${Date.now()}${Math.random().toString(36).slice(2,6)}`,
    group,
    segment:check.seg.key,
    fromHole:state.hole,
    pressedBy:check.loser,
    amount:wager,
    parentId:check.parent?.id || null,
    type:check.type
  });
  renderPressCard();
  renderGames();
  renderLedger();
  saveLocal();
}

function removePress(id){
  if(!state.organizerMode) return;
  state.games.nassau.presses=(state.games.nassau.presses||[]).filter(p=>p.id!==id);
  renderPressCard(); renderGames(); renderLedger(); saveLocal();
}

function renderPressCard(){
  const host=$("#pressCard"); if(!host)return;
  if(!state.games?.nassau?.enabled){
    host.classList.add("hidden"); host.innerHTML=""; return;
  }
  const g=state.group, seg=currentNassauSegment(state.hole), check=canPressNow(g);
  const teams=nassauTeamsForGroup(g,seg.pairing), presses=activePressesFor(g,seg.key);
  const standing=currentSegmentStanding(g,seg);
  let standingText="All square";
  if(standing.loser){
    const winning=standing.loser==="a"?teams.b:teams.a;
    standingText=`${teamName(winning)} ${standing.margin} up`;
  }
  host.classList.remove("hidden");
  host.innerHTML=`
    <div class="eyebrow">LIVE NASSAU · ${seg.name.toUpperCase()}</div>
    <div class="press-head"><div><h3>Press Bet</h3><p>${escapeHtml(check.reason || `${teamName(check.loser==="a"?teams.a:teams.b)} may press from Hole ${state.hole}.`)}</p></div>
    <button id="pressNowBtn" class="primary" ${check.ok && state.organizerMode ? "" : "disabled"}>${check.type==="press-back"?"Press the Press":"Press Now"}</button></div>
    <div class="press-meta"><span>Standing <b>${escapeHtml(standingText)}</b></span><span>Wager <b>$${Number(state.games.nassau.wager||0)}</b></span><span>Recorded <b>${presses.length}</b></span></div>
    ${presses.length?`<div class="press-list">${presses.map(p=>{
      const o=pressOutcome(p);
      let status="Pending";
      if(o?.complete){
        status=o.winner==="half"?"Halved":`${teamName(o.winner==="a"?o.a:o.b)} win`;
      }
      return `<div class="press-row"><span>${p.type==="press-back"?"Press the Press · ":""}From Hole ${p.fromHole} · $${p.amount}</span><b>${escapeHtml(status)}</b>${state.organizerMode?`<button data-remove-press="${p.id}" class="ghost">×</button>`:""}</div>`;
    }).join("")}</div>`:""}
  `;
  $("#pressNowBtn")?.addEventListener("click",()=>addPress(g));
  host.querySelectorAll("[data-remove-press]").forEach(b=>b.onclick=()=>removePress(b.dataset.removePress));
}

function allNassauResults(){
  const segs=nassauSegments();
  const out=[];
  for(const g of [1,2]){
    for(const seg of segs) out.push({group:g,seg,...nassauSegmentResult(g,seg.holes,seg.pairing)});
  }
  return out;
}

function fortyBallResult(){
  const results={};
  for(const g of [1,2]){
    const pts=[];
    groupPlayers(g).forEach(p=>{
      for(let h=1;h<=18;h++){
        const x=stablefordPoints(p,h);
        if(x!==null) pts.push(x);
      }
    });
    pts.sort((a,b)=>b-a);
    results[g]={count:pts.length,total:pts.slice(0,40).reduce((a,b)=>a+b,0)};
  }
  const complete=results[1].count>=40 && results[2].count>=40;
  const winner=complete?(results[1].total>results[2].total?1:results[2].total>results[1].total?2:0):null;
  return {complete,winner,results};
}

function calculateLedger(){
  const net=Object.fromEntries(state.players.map(p=>[p.id,0]));
  if(state.games?.nassau?.enabled){
    const wager=Number(state.games.nassau.wager||0);
    for(const r of allNassauResults()){
      if(!r.complete || r.winner==="half" || !wager) continue;
      const winners=r.winner==="a"?r.a:r.b;
      const losers=r.winner==="a"?r.b:r.a;
      winners.forEach(p=>net[p.id]+=wager);
      losers.forEach(p=>net[p.id]-=wager);
    }
    for(const p of (state.games.nassau.presses||[])){
      const r=pressOutcome(p);
      if(!r?.complete || r.winner==="half") continue;
      const amt=Number(p.amount||wager||0);
      const winners=r.winner==="a"?r.a:r.b;
      const losers=r.winner==="a"?r.b:r.a;
      winners.forEach(x=>net[x.id]+=amt);
      losers.forEach(x=>net[x.id]-=amt);
    }
  }
  if(state.games?.forty?.enabled){
    const w=Number(state.games.forty.wager||0), r=fortyBallResult();
    if(r.complete && r.winner && w){
      state.players.forEach(p=> net[p.id] += p.group===r.winner ? w : -w);
    }
  }
  return net;
}

function paymentsFromNet(net){
  const creditors=[], debtors=[];
  for(const p of state.players){
    const cents=Math.round(Number(net[p.id]||0)*100);
    if(cents>0) creditors.push({p,c:cents});
    if(cents<0) debtors.push({p,c:-cents});
  }
  creditors.sort((a,b)=>b.c-a.c); debtors.sort((a,b)=>b.c-a.c);
  const out=[]; let i=0,j=0;
  while(i<debtors.length && j<creditors.length){
    const c=Math.min(debtors[i].c,creditors[j].c);
    out.push({from:debtors[i].p,to:creditors[j].p,amount:c/100});
    debtors[i].c-=c; creditors[j].c-=c;
    if(!debtors[i].c)i++; if(!creditors[j].c)j++;
  }
  return out;
}

function renderNassauTeams(){
  const host=$("#nassauTeams"); if(!host)return;
  if(!state.games?.nassau?.enabled){host.innerHTML="";return;}
  const blocks=[1,2].map(g=>{
    const ps=groupPlayers(g);
    if(!ps.length) return "";
    const t=nassauTeamsForGroup(g);
    return `<section class="team-block"><h3>Group ${g} Nassau Teams</h3><p class="fineprint">Assign each player to Side A or Side B.</p>${
      ps.map(p=>{
        const side=(state.nassauTeams?.[g]?.[p.id]) || (ps.indexOf(p)%2===0?"a":"b");
        return `<div class="team-row"><span>${escapeHtml(p.name)}</span><select data-team-player="${p.id}" data-team-group="${g}" ${state.organizerMode?"":"disabled"}><option value="a" ${side==="a"?"selected":""}>Side A</option><option value="b" ${side==="b"?"selected":""}>Side B</option></select></div>`;
      }).join("")
    }<div class="team-summary"><b>A:</b> ${escapeHtml(teamName(t.a)||"—")} &nbsp; <b>B:</b> ${escapeHtml(teamName(t.b)||"—")}</div></section>`;
  }).join("");
  host.innerHTML=blocks;
  host.querySelectorAll("[data-team-player]").forEach(sel=>sel.onchange=()=>{
    const g=Number(sel.dataset.teamGroup);
    state.nassauTeams ??={}; state.nassauTeams[g] ??={};
    state.nassauTeams[g][sel.dataset.teamPlayer]=sel.value;
    renderNassauTeams(); renderGames(); renderLedger(); saveLocal();
  });
}

function applyOrganizerMode(){
  const editableSelectors=[
    "#outingName","#outingDate","#addPlayerBtn","#startRoundBtn",
    "#nassauEnabled","#nassauWager","#fortyEnabled","#fortyWager"
  ];
  editableSelectors.forEach(s=>{const el=$(s); if(el) el.disabled=!state.organizerMode;});
  document.querySelectorAll("#players input,#players select,#players button").forEach(el=>el.disabled=!state.organizerMode);
  document.querySelectorAll("[data-team-player]").forEach(el=>el.disabled=!state.organizerMode);
  const edit=$("#editSetupBtn"); if(edit) edit.style.display=state.organizerMode?"":"none";
}

function renderGames(){
  if(!$("#nassauEnabled")) return;
  $("#nassauEnabled").checked=!!state.games?.nassau?.enabled;
  $("#nassauWager").value=state.games?.nassau?.wager ?? 5;
  $("#nassauFormat").value=state.games?.nassau?.format ?? "555111";
  $("#fortyEnabled").checked=!!state.games?.forty?.enabled;
  $("#fortyWager").value=state.games?.forty?.wager ?? 5;
  const lines=[];
  if(state.games?.nassau?.enabled){
    for(const r of allNassauResults()){
      const status=!r.complete?`${r.played}/${r.total} holes complete`:r.winner==="half"?"Halved":`${teamName(r.winner==="a"?r.a:r.b)} win`;
      const pressCount=activePressesFor(r.group,r.seg.key).length;
      lines.push(`Group ${r.group} ${r.seg.name}: ${status}${pressCount?` · ${pressCount} press${pressCount===1?"":"es"}`:""}`);
    }
  }
  if(state.games?.forty?.enabled){
    const r=fortyBallResult();
    lines.push(`40 Ball: G1 ${r.results[1].total} pts · G2 ${r.results[2].total} pts${r.complete?(r.winner?` · Group ${r.winner} wins`:" · Tie"):" · in progress"}`);
  }
  $("#gameStatus").innerHTML=lines.length?lines.map(x=>`<div>${escapeHtml(x)}</div>`).join(""):"Select the games being played today.";
  renderNassauTeams();
  applyOrganizerMode();
}


function playerRoundStatus(player){
  const vals=[...Array(18)].map((_,i)=>Number(state.scores[`${player.id}-${i+1}`]||0));
  const entered=vals.filter(v=>v>0).length;
  return {entered,complete:entered===18,total:vals.reduce((a,b)=>a+b,0)};
}

function renderScorecard(){
  const host=$("#scorecardTable"); if(!host)return;
  const holes=[...Array(18)].map((_,i)=>i+1);
  host.innerHTML=`<div class="scorecard-scroll"><table class="scorecard-table"><thead><tr><th>Player</th>${holes.map(h=>`<th>${h}</th>`).join("")}<th>Total</th></tr></thead><tbody>${
    state.players.map(p=>{
      const vals=holes.map(h=>Number(state.scores[`${p.id}-${h}`]||0));
      const status=playerRoundStatus(p);
      return `<tr><th>${escapeHtml(p.name)}<small>${status.complete?"Complete":`${status.entered}/18`}</small></th>${vals.map(v=>`<td>${v||"—"}</td>`).join("")}<td><b>${status.total||"—"}</b></td></tr>`;
    }).join("")
  }</tbody></table></div>`;
}

function renderLedger(){
  const host=$("#ledgerContent"); if(!host)return;
  const net=calculateLedger(), pay=paymentsFromNet(net);
  host.innerHTML=`
    <div class="ledger-net">${state.players.map(p=>`<div><span>${escapeHtml(p.name)}</span><strong>${net[p.id]>0?"+":""}$${Number(net[p.id]||0).toFixed(0)}</strong></div>`).join("")}</div>
    <h3>Who Pays Who</h3>
    ${pay.length?pay.map(x=>`<div class="payment"><b>${escapeHtml(x.from.name)}</b><span>pays</span><b>${escapeHtml(x.to.name)}</b><strong>$${x.amount.toFixed(0)}</strong></div>`).join(""):`<p class="summary">Completed side-game settlements will appear here automatically.</p>`}
  `;
}


function setSyncStatus(text, kind=""){
  const el=$("#syncStatus"); if(!el)return;
  el.textContent=text;
  el.dataset.kind=kind;
}

function joinedPlayer(){
  if(!state.outingId) return null;
  const id=sessionStorage.getItem(`tngc-joined-${state.outingId}`);
  return state.players.find(p=>p.id===id) || null;
}

function showJoinGame(){
  if(!state.outingId || joinedPlayer()) return;
  const overlay=document.createElement("div");
  overlay.className="join-overlay";
  overlay.innerHTML=`<section class="join-card"><div class="eyebrow">TNGC SCORING</div><h2>Join Game</h2><p>Select your name to enter scores for your foursome.</p><select id="joinPlayer"><option value="">Select your name</option>${state.players.map(p=>`<option value="${p.id}">${escapeHtml(p.name)} · Foursome ${p.group}</option>`).join("")}</select><button id="joinGameBtn" class="primary">Join Game</button></section>`;
  overlay.querySelector("#joinGameBtn").onclick=()=>{
    const id=overlay.querySelector("#joinPlayer").value;
    const player=state.players.find(p=>p.id===id);
    if(!player) return alert("Select your name to join this game.");
    sessionStorage.setItem(`tngc-joined-${state.outingId}`,id);
    state.group=player.group;
    overlay.remove();
    renderScoring();
  };
  document.body.appendChild(overlay);
}

window.addEventListener("online",()=>{
  setSyncStatus(state.outingId ? "Back online · syncing" : "Online","ok");
  if(state.outingId){ state.cloudMode=true; pushCloudState(); }
});
window.addEventListener("offline",()=>setSyncStatus("Offline · scoring locally","warn"));

function serializableState(){
  return {
    outing: state.outing,
    players: state.players,
    scores: state.scores,
    hole: state.hole,
    group: state.group,
    visited18: state.visited18,
    games: state.games,
    organizerMode: state.organizerMode,
    nassauTeams: state.nassauTeams
  };
}

function saveLocal(skipCloud=false){
  localStorage.setItem("tngc-scoring-beta",JSON.stringify({
    ...serializableState(),
    outingId: state.outingId
  }));
  if(!skipCloud) scheduleCloudSync();
}

function scheduleCloudSync(){
  if(!state.cloudMode || !state.outingId) return;
  clearTimeout(state.syncTimer);
  state.syncTimer = setTimeout(pushCloudState, 300);
}

async function ensureCloudOuting(){
  if(state.outingId) {
    await pushCloudState();
    updateShareUrl();
    return;
  }
  try{
    const res = await fetch("/api/outings",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({state:serializableState()})
    });
    if(!res.ok) throw new Error("Cloud create failed");
    const data = await res.json();
    state.outingId = data.id;
    setSyncStatus("Shared round active","ok");
    localStorage.setItem("tngc-scoring-beta",JSON.stringify({...serializableState(),outingId:state.outingId}));
    updateShareUrl();
  }catch(err){
    state.cloudMode=false;
    setSyncStatus("Local-only fallback","warn");
    console.warn("Using local-only beta fallback",err);
  }
}


async function pushScoreCloud(key,value){
  if(!state.outingId || !state.cloudMode) return;
  try{
    const res=await fetch(`/api/outings/${encodeURIComponent(state.outingId)}`,{
      method:"PATCH",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({key,value})
    });
    if(!res.ok) throw new Error("Score sync failed");
    setSyncStatus("Score synced","ok");
  }catch(err){
    setSyncStatus("Score saved locally · sync pending","warn");
    console.warn(err);
  }
}

async function pushCloudState(){
  if(!state.outingId || !state.cloudMode) return;
  try{
    const res = await fetch(`/api/outings/${encodeURIComponent(state.outingId)}`,{
      method:"PUT",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({state:serializableState()})
    });
    if(!res.ok) throw new Error("Cloud sync failed");
    setSyncStatus("Synced","ok");
  }catch(err){
    setSyncStatus("Sync issue · saved locally","warn");
    console.warn(err);
  }
}

async function loadCloudOuting(id){
  try{
    const res=await fetch(`/api/outings/${encodeURIComponent(id)}`,{cache:"no-store"});
    if(!res.ok) throw new Error("Outing not found");
    const data=await res.json();
    Object.assign(state,data.state,{outingId:id,cloudMode:true});
    setSyncStatus("Shared round active","ok");
    $("#outingName").value=state.outing?.name||"TNGC Round";
    $("#outingDate").value=state.outing?.date||today;
    if($("#organizerMode")) $("#organizerMode").checked=state.organizerMode!==false;
    renderPlayers();
    $("#setupView").classList.add("hidden");
    $("#scoreView").classList.remove("hidden");
    $("#nav").classList.remove("hidden");
    renderScoring();
    renderGames();
    renderScorecard();
    renderLedger();
    showJoinGame();
    startPolling();
    return true;
  }catch(err){
    console.warn(err);
    return false;
  }
}

function updateShareUrl(){
  if(!state.outingId) return;
  const u=new URL(location.href);
  u.searchParams.set("outing",state.outingId);
  history.replaceState(null,"",u);
  if(!document.querySelector("#shareLink")){
    const b=document.createElement("button");
    b.id="shareLink"; b.className="secondary"; b.textContent="Share Round";
    b.onclick=async()=>{
      try{await navigator.clipboard.writeText(location.href); b.textContent="Link Copied"; setTimeout(()=>b.textContent="Share Round",1400)}
      catch{prompt("Copy this link",location.href)}
    };
    document.querySelector("#scoreView .section-heading").appendChild(b);
  }
}

function startPolling(){
  if(window.__tngcPoll) clearInterval(window.__tngcPoll);
  window.__tngcPoll=setInterval(async()=>{
    if(!state.outingId || document.hidden) return;
    try{
      const res=await fetch(`/api/outings/${encodeURIComponent(state.outingId)}`,{cache:"no-store"});
      if(!res.ok) return;
      const data=await res.json();
      // Pull only shared scoring/setup data; preserve this phone's current hole/group navigation.
      state.players=data.state.players;
      const active=document.activeElement;
      const activeKey=active?.classList?.contains("score-input") ? active.dataset.scoreKey : null;
      if(activeKey){
        const localValue=state.scores[activeKey];
        state.scores=data.state.scores||{};
        state.scores[activeKey]=localValue;
      }else{
        state.scores=data.state.scores||{};
      }
      state.outing=data.state.outing;
      if(data.state.games) state.games=data.state.games;
      if(data.state.nassauTeams) state.nassauTeams=data.state.nassauTeams;
      if(typeof data.state.organizerMode==="boolean") state.organizerMode=data.state.organizerMode;
      renderScoring();
      renderGames();
      renderScorecard();
      renderLedger();
    }catch{}
  },3000);
}

function loadLocal(){
  try{
    const saved=JSON.parse(localStorage.getItem("tngc-scoring-beta"));
    if(saved && saved.players){
      Object.assign(state,saved);
      state.outingId=saved.outingId||null;
      $("#outingName").value=state.outing?.name||"TNGC Round";
      $("#outingDate").value=state.outing?.date||today;
      if($("#organizerMode")) $("#organizerMode").checked=state.organizerMode!==false;
    }
  }catch(e){}
}


document.querySelectorAll("#nav [data-view]").forEach(btn=>btn.onclick=()=>{
  const target=btn.dataset.view;
  ["scoreView","gamesView","scorecardView","ledgerView"].forEach(id=>$("#"+id).classList.toggle("hidden",id!==target));
  document.querySelectorAll("#nav [data-view]").forEach(b=>b.classList.toggle("active",b===btn));
  if(target==="gamesView")renderGames();
  if(target==="scorecardView")renderScorecard();
  if(target==="ledgerView")renderLedger();
});

function bindGameControls(){
  ["nassauEnabled","nassauWager","nassauFormat","fortyEnabled","fortyWager"].forEach(id=>{
    const el=$("#"+id); if(!el)return;
    el.addEventListener("change",()=>{
      state.games ??={nassau:{enabled:false,wager:5,presses:[]},forty:{enabled:false,wager:5}};
      state.games.nassau ??={enabled:false,wager:5,presses:[]};
      state.games.forty ??={enabled:false,wager:5};
      state.games.nassau.enabled=$("#nassauEnabled").checked;
      state.games.nassau.wager=Math.max(0,Number($("#nassauWager").value||0));
      state.games.nassau.format=$("#nassauFormat").value;
      state.games.forty.enabled=$("#fortyEnabled").checked;
      state.games.forty.wager=Math.max(0,Number($("#fortyWager").value||0));
      renderGames(); renderLedger(); saveLocal();
    });
  });
}
bindGameControls();

const organizerBox=$("#organizerMode");
if(organizerBox){
  organizerBox.checked=state.organizerMode!==false;
  organizerBox.addEventListener("change",()=>{
    state.organizerMode=organizerBox.checked;
    applyOrganizerMode();
    saveLocal();
  });
}


loadLocal();
const sharedId = new URL(location.href).searchParams.get("outing");
if(sharedId){
  loadCloudOuting(sharedId).then(ok=>{
    if(!ok){
      if(state.players.length===0){ addPlayer({group:1}); addPlayer({group:1}); addPlayer({group:1}); addPlayer({group:1}); }
      else renderPlayers();
    }
  });
}else{
  if(state.players.length===0){ addPlayer({group:1}); addPlayer({group:1}); addPlayer({group:1}); addPlayer({group:1}); }
  else renderPlayers();
  if(state.outingId) updateShareUrl();
}
