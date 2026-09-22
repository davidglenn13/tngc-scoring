import course from './src/course-tngc.json' with {type:'json'};
import {relativePlayingHandicaps} from './src/core/handicap.js';
import {netScore,stablefordPoints} from './src/core/scoring.js';
import {NASSAU_PRESETS,segmentResult,rotatingTeams,pressAvailability,pressResult,nassauGroupNet} from './src/core/games/nassau.js';
import {selectionKey,fortyBallSummary,canSelectFortyBall,fortyBallMatch} from './src/core/games/forty-ball.js';
import {paymentsFromNet,assertZeroSum} from './src/core/settlement.js';
import {V2Api,scoreMapFromSnapshot} from './src/core/api.js';
import {mergeSnapshot,nextExpectedRevision,applyConflict} from './src/core/sync.js';
import {outboxUpsert,outboxRemove,protectedValuesFromOutbox,updateOutboxRevision} from './src/core/outbox.js';

const $=s=>document.querySelector(s);
const api=new V2Api();
const state={
 builderStep:1,event:{name:'TNGC Round',date:new Date().toISOString().slice(0,10)},
 players:[],games:{nassau:false,nassauPreset:'5-5-5-1-1-1',nassauWager:5,nassauByGroup:{1:{enabled:false,preset:'5-5-5-1-1-1',wager:5},2:{enabled:false,preset:'5-5-5-1-1-1',wager:5}},forty:false,fortyWager:5},
 scores:{},scoreRevisions:{},currentHole:1,currentFoursome:1,visited18:false,
 eventId:null,cloudMode:true,lastSync:null,pollTimer:null,pendingScores:new Map(),auditEvents:[],commandBusy:false,fortySelections:{1:{},2:{}},presses:[],remoteGames:[],confirmations:{1:'in_progress',2:'in_progress'},scoreConflict:null,outbox:[],flushingOutbox:false,organizerToken:null
};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const uid=()=>crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2);

const LOCAL_KEY="tngc-v2-device";

const organizerKey=id=>`tngc-v2-organizer:${id}`;
const outboxKey=id=>`tngc-v2-outbox:${id}`;
function loadOrganizerToken(id){try{return localStorage.getItem(organizerKey(id))||null;}catch{return null;}}
function saveOrganizerToken(id,token){
 state.organizerToken=token||null;api.setOrganizerToken(id,token||null);
 try{if(token)localStorage.setItem(organizerKey(id),token);else localStorage.removeItem(organizerKey(id));}catch{}
}
function isOrganizer(){return !!state.organizerToken;}
function loadOutbox(id){try{const x=JSON.parse(localStorage.getItem(outboxKey(id))||"[]");return Array.isArray(x)?x:[];}catch{return [];}}
function saveOutbox(){if(!state.eventId)return;try{localStorage.setItem(outboxKey(state.eventId),JSON.stringify(state.outbox||[]));}catch{}}
function deviceId(){
 const k="tngc-v2-device-id";try{let id=localStorage.getItem(k);if(!id){id=`d_${Math.random().toString(36).slice(2,10)}`;localStorage.setItem(k,id);}return id;}catch{return "shared-link";}
}

function saveDeviceState(){
  try{
    localStorage.setItem(LOCAL_KEY,JSON.stringify({
      eventId:state.eventId||null,
      currentHole:state.currentHole,
      currentFoursome:state.currentFoursome,
      visited18:state.visited18,
      savedAt:Date.now()
    }));
  }catch{}
}
function loadDeviceState(){
  try{return JSON.parse(localStorage.getItem(LOCAL_KEY)||"null");}catch{return null;}
}
function clearDeviceState(){
  try{localStorage.removeItem(LOCAL_KEY);}catch{}
}
function preferredResume(eventId){
  const d=loadDeviceState();
  if(!d||String(d.eventId||"")!==String(eventId||""))return null;
  return d;
}
function nextIncompleteHole(g){
  const ps=groupPlayers(g);
  if(!ps.length)return 1;
  for(let h=1;h<=18;h++){
    if(ps.some(p=>!Number(state.scores[key(p.id,h)]||0)))return h;
  }
  return 18;
}

const hasSecondFoursome=()=>state.players.length>=5;
function normalizeFoursomes(){if(!hasSecondFoursome())state.players.forEach(p=>p.foursome=1);}
function addPlayer(){if(state.players.length>=8)return;const n=state.players.length;state.players.push({id:uid(),name:'',index:'',tee:'Blue',foursome:n<4?1:2});normalizeFoursomes();renderBuilder();}
function removePlayer(id){state.players=state.players.filter(p=>p.id!==id);normalizeFoursomes();renderBuilder();}
function playerRows(){normalizeFoursomes();const second=hasSecondFoursome();return state.players.map((p,i)=>`<div class="player-builder ${second?'':'single'}"><label>Name<input data-player="${p.id}" data-key="name" value="${esc(p.name)}" placeholder="Player ${i+1}"></label><label>Index<input data-player="${p.id}" data-key="index" type="number" step=".1" min="-10" max="54" value="${p.index}"></label><label>Tee<select data-player="${p.id}" data-key="tee">${Object.keys(course.tees).map(t=>`<option ${p.tee===t?'selected':''}>${t}</option>`).join('')}</select></label>${second?`<label>Foursome<select data-player="${p.id}" data-key="foursome"><option value="1" ${p.foursome===1?'selected':''}>1</option><option value="2" ${p.foursome===2?'selected':''}>2</option></select></label>`:''}<button type="button" class="remove-btn" data-remove="${p.id}">×</button></div>`).join('');}
function stepHtml(){
 if(state.builderStep===1)return `<div class="field-grid"><label>Outing name<input id="eventName" value="${esc(state.event.name)}"></label><label>Date<input id="eventDate" type="date" value="${state.event.date}"></label></div><p class="muted">TNGC Charlotte course data is preloaded and validated.</p>`;
 if(state.builderStep===2)return `<div>${playerRows()}</div><div class="inline-actions"><span class="muted">${state.players.length}/8 players</span><button id="addPlayer" class="btn secondary" type="button">+ Add Player</button></div><p class="muted">${hasSecondFoursome()?'Assign up to four players to each foursome.':'With 2–4 players, everyone stays in Foursome 1 automatically.'}</p>`;
 if(state.builderStep===3)return `<div class="game-choice"><div><h3>Nassau</h3><p>Rotating partners with trusted Ballyhack logic.</p></div><input id="nassauToggle" type="checkbox" ${state.games.nassau?'checked':''}></div>${state.games.nassau?`<div class="field-grid"><label>Preset<select id="nassauPreset"><option value="5-5-5-1-1-1" ${state.games.nassauPreset==='5-5-5-1-1-1'?'selected':''}>5-5-5-1-1-1</option><option value="6-6-6" ${state.games.nassauPreset==='6-6-6'?'selected':''}>6-6-6</option></select></label><label>Wager ($)<input id="nassauWager" type="number" min="0" value="${state.games.nassauWager}"></label></div>`:''}<div class="game-choice"><div><h3>40 Ball</h3><p>Lowest 40 net scores from each foursome count.</p></div><input id="fortyToggle" type="checkbox" ${state.games.forty?'checked':''}></div>${state.games.forty?`<label>Wager per player ($)<input id="fortyWager" type="number" min="0" value="${state.games.fortyWager}"></label>`:''}`;
 return `<div class="review-grid"><div class="review-card"><h3>Round</h3><p>${esc(state.event.name)}</p><p>${state.event.date}</p></div><div class="review-card"><h3>Players</h3><p>${state.players.length} golfers</p><p>${hasSecondFoursome()?'Two foursomes':'One foursome'}</p></div><div class="review-card"><h3>Games</h3><p>${state.games.nassau?`Nassau ${state.games.nassauPreset} · $${state.games.nassauWager}`:'No Nassau'}</p><p>${state.games.forty?`40 Ball · $${state.games.fortyWager}`:'No 40 Ball'}</p></div><div class="review-card"><h3>Ready</h3><p>Scores drive games, scorecards and Ledger automatically.</p></div></div>`;
}
function bindBuilder(){
 $('#eventName')?.addEventListener('input',e=>state.event.name=e.target.value);$('#eventDate')?.addEventListener('change',e=>state.event.date=e.target.value);$('#addPlayer')?.addEventListener('click',addPlayer);
 document.querySelectorAll('[data-player]').forEach(el=>el.addEventListener('change',()=>{const p=state.players.find(x=>x.id===el.dataset.player);let v=el.value;if(el.dataset.key==='index')v=v===''?'':Number(v);if(el.dataset.key==='foursome')v=Number(v);p[el.dataset.key]=v;normalizeFoursomes();}));
 document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>removePlayer(b.dataset.remove));
 $('#nassauToggle')?.addEventListener('change',e=>{state.games.nassau=e.target.checked;renderBuilder();});$('#fortyToggle')?.addEventListener('change',e=>{state.games.forty=e.target.checked;renderBuilder();});
 $('#nassauPreset')?.addEventListener('change',e=>state.games.nassauPreset=e.target.value);$('#nassauWager')?.addEventListener('change',e=>state.games.nassauWager=Math.max(0,Number(e.target.value||0)));$('#fortyWager')?.addEventListener('change',e=>state.games.fortyWager=Math.max(0,Number(e.target.value||0)));
}
function renderBuilder(){$('#builderStep').innerHTML=stepHtml();$('#builderStepBadge').textContent=`${state.builderStep} of 4`;document.querySelectorAll('.step').forEach(b=>{const n=+b.dataset.step;b.classList.toggle('active',n===state.builderStep);b.classList.toggle('done',n<state.builderStep)});$('#backBtn').style.visibility=state.builderStep===1?'hidden':'visible';$('#nextBtn').textContent=state.builderStep===4?'Start Scoring':'Continue';bindBuilder();}
function validate(){if(state.builderStep===1&&(!state.event.name.trim()||!state.event.date))return 'Complete the round details.';if(state.builderStep===2){if(state.players.length<2)return 'Add at least two players.';if(state.players.some(p=>!p.name.trim()||p.index===''))return 'Enter a name and index for every player.';const n=state.players.map(p=>p.name.trim().toLowerCase());if(new Set(n).size!==n.length)return 'Player names must be unique.';if(hasSecondFoursome()){const c=[1,2].map(g=>state.players.filter(p=>p.foursome===g).length);if(c.some(x=>x<1||x>4))return 'Use both foursomes with no more than four players in either.';}}if(state.builderStep===3&&state.games.nassau){for(const g of [1,2]){const ps=state.players.filter(p=>p.foursome===g);if(ps.length&&ps.length!==4)return 'Rotating Nassau requires four players in each participating foursome.';}}return '';}
$('#backBtn').onclick=()=>{if(state.builderStep>1){state.builderStep--;renderBuilder();}};$('#nextBtn').onclick=()=>{const e=validate();if(e)return alert(e);if(state.builderStep<4){state.builderStep++;renderBuilder();}else startScoring();};

const groupPlayers=g=>state.players.filter(p=>p.foursome===g);

function nassauCfg(g){
 state.games.nassauByGroup??={1:{enabled:false,preset:"5-5-5-1-1-1",wager:5},2:{enabled:false,preset:"5-5-5-1-1-1",wager:5}};
 state.games.nassauByGroup[g]??={enabled:false,preset:"5-5-5-1-1-1",wager:5};
 return state.games.nassauByGroup[g];
}
function syncLegacyGameFlags(){
 state.games.nassau=!!(nassauCfg(1).enabled||nassauCfg(2).enabled);
 const first=[1,2].find(g=>nassauCfg(g).enabled);
 if(first){state.games.nassauPreset=nassauCfg(first).preset;state.games.nassauWager=nassauCfg(first).wager;}
}

const playingRows=g=>relativePlayingHandicaps(groupPlayers(g),course.tees,72);
const key=(pid,h)=>`${pid}-${h}`;
function netFor(p,h){const info=playingRows(p.foursome).find(x=>x.id===p.id);return netScore(state.scores[key(p.id,h)]??'',info.playingHandicap,course.strokeIndex[h-1]);}
async function startScoring(){
 $('#builderView').classList.add('hidden');$('#commandView').classList.add('hidden');$('#scoringView').classList.remove('hidden');
 state.currentFoursome=1;state.currentHole=1;
 if(state.games.nassau && !nassauCfg(1).enabled && !nassauCfg(2).enabled){
   for(const g of [1,2])if(groupPlayers(g).length)nassauCfg(g).enabled=true,nassauCfg(g).preset=state.games.nassauPreset,nassauCfg(g).wager=state.games.nassauWager;
 }
 renderScoring();
 await ensureCloudEvent();
 const resume=preferredResume(state.eventId);
 if(resume){
   state.currentFoursome=hasSecondFoursome()&&[1,2].includes(Number(resume.currentFoursome))?Number(resume.currentFoursome):1;
   state.currentHole=Math.max(1,Math.min(18,Number(resume.currentHole)||1));
   state.visited18=!!resume.visited18;
 }else{
   state.currentHole=nextIncompleteHole(state.currentFoursome);
 }
 renderScoring();
 startPolling();
}

function playerPayloads(){
  const all=[];
  for(const g of [1,2]){
    const rows=playingRows(g);
    for(const p of rows){
      all.push({
        id:p.id,display_name:p.name,handicap_index:Number(p.index),tee_key:p.tee,
        course_handicap:p.courseHandicap,foursome_no:p.foursome
      });
    }
  }
  return all;
}
function gamePayloads(){
 const out=[];
 if(state.games.forty){
   out.push({game_type:"forty_ball",preset_key:"manual-40-relative-to-par",foursome_no:null,wager_cents:Math.round(state.games.fortyWager*100),config:{}});
 }else{
   for(const g of [1,2]){
     const c=nassauCfg(g);
     if(c.enabled&&groupPlayers(g).length){
       out.push({game_type:"nassau",preset_key:c.preset,foursome_no:g,wager_cents:Math.round(c.wager*100),config:{}});
     }
   }
 }
 return out;
}
function setCloudStatus(text,kind=""){
  const el=document.querySelector(".sync-badge");
  if(el){el.textContent=text;el.dataset.kind=kind;}
}
async function ensureCloudEvent(){
  if(state.eventId)return;
  try{
    const created=await api.createEvent({
      name:state.event.name,event_date:state.event.date,course_id:course.id,mode:"casual",course_version:"tngc-2026-validated",course_data:course
    },playerPayloads());
    state.eventId=created.id;
    saveOrganizerToken(state.eventId,created.organizer_token);
    state.outbox=loadOutbox(state.eventId);
    await api.saveGames(state.eventId,gamePayloads());
    state.cloudMode=true;
    await pullSnapshot();state.lastSync=new Date();
    const u=new URL(location.href);u.searchParams.set("event",state.eventId);history.replaceState(null,"",u);
    setCloudStatus("CLOUD LIVE","ok");
  }catch(err){
    state.cloudMode=false;
    setCloudStatus("LOCAL FALLBACK","warn");
    console.warn("V2 cloud unavailable",err);
  }
}
async function pushScore(pid,hole,value){
 if(!state.eventId)return;
 const k=key(pid,hole),gross=value===""?null:Number(value);
 state.outbox=outboxUpsert(state.outbox,{playerId:pid,hole,gross,expectedRevision:nextExpectedRevision(state.scoreRevisions,k),updatedBy:deviceId(),queuedAt:Date.now()});
 saveOutbox();state.pendingScores.set(k,Date.now());
 setCloudStatus(navigator.onLine?"SYNC PENDING":"OFFLINE CACHE","warn");
 if(state.cloudMode&&navigator.onLine)flushOutbox();
}
async function flushOutbox(){
 if(state.flushingOutbox||!state.eventId||!state.cloudMode||!navigator.onLine||state.scoreConflict)return;
 state.flushingOutbox=true;
 try{
  while(state.outbox.length){
   const item=state.outbox[0],k=key(item.playerId,item.hole);
   try{
    const saved=await api.saveScore(state.eventId,{player_id:item.playerId,hole:item.hole,gross:item.gross,expected_revision:item.expectedRevision,updated_by:item.updatedBy||deviceId()});
    if(saved.revision!==undefined)state.scoreRevisions[k]=Number(saved.revision||0);
    state.outbox=outboxRemove(state.outbox,k);state.pendingScores.delete(k);saveOutbox();state.lastSync=new Date();
   }catch(err){
    if(err.status===409&&err.data?.server){
     const c=applyConflict({scores:state.scores,revisions:state.scoreRevisions},item.playerId,item.hole,err.data.server);
     state.scoreConflict=c.conflict;state.outbox=updateOutboxRevision(state.outbox,k,Number(err.data.server.revision||0));saveOutbox();
     setCloudStatus("SCORE CONFLICT","warn");renderConflictBanner();
    }else setCloudStatus("SYNC PENDING","warn");
    break;
   }
  }
  if(!state.outbox.length&&!state.scoreConflict)setCloudStatus("SYNCED","ok");
 }finally{state.flushingOutbox=false;}
}
async function pullSnapshot(){
  if(!state.eventId||!state.cloudMode)return;
  try{
    const snap=await api.snapshot(state.eventId);
    const active=document.activeElement;
    const activePid=active?.dataset?.scorePlayer||null;
    const activeKey=activePid?key(activePid,state.currentHole):null;
    const localActive=activeKey?state.scores[activeKey]:undefined;
    const merged=mergeSnapshot({localScores:state.scores,localRevisions:state.scoreRevisions,remoteRows:snap.scores||[],activeKey,activeValue:localActive,protectedValues:protectedValuesFromOutbox(state.outbox)});
    state.scores=merged.scores;state.scoreRevisions=merged.revisions;
    state.remoteGames=snap.games||[];
    state.games.nassauByGroup={1:{enabled:false,preset:"5-5-5-1-1-1",wager:5},2:{enabled:false,preset:"5-5-5-1-1-1",wager:5}};
    const fortyGame=(snap.games||[]).find(g=>g.game_type==="forty_ball");
    state.games.forty=!!fortyGame;
    if(fortyGame)state.games.fortyWager=Number(fortyGame.wager_cents||0)/100;
    for(const ng of (snap.games||[]).filter(g=>g.game_type==="nassau")){
      const gg=Number(ng.foursome_no);
      if([1,2].includes(gg))state.games.nassauByGroup[gg]={enabled:true,preset:ng.preset_key,wager:Number(ng.wager_cents||0)/100};
    }
    syncLegacyGameFlags();
    const gameById=Object.fromEntries((snap.games||[]).map(g=>[g.id,g]));
    state.presses=(snap.presses||[]).map(p=>({id:p.id,gameId:p.game_id,segmentKey:p.segment_key,fromHole:Number(p.from_hole),pressedBy:p.pressed_by_side,amount:Number(p.wager_cents||0)/100,parentPressId:p.parent_press_id||null,foursome_no:Number(gameById[p.game_id]?.foursome_no||0)}));
    state.fortySelections={1:{},2:{}};
    for(const x of snap.forty_ball_selections||[]){state.fortySelections[Number(x.foursome_no)]??={};state.fortySelections[Number(x.foursome_no)][selectionKey(x.player_id,Number(x.hole))]=true;}
    state.confirmations={1:'in_progress',2:'in_progress'};for(const c of snap.confirmations||[])state.confirmations[Number(c.foursome_no)]=c.status;
    state.lastSync=new Date();setCloudStatus("SYNCED","ok");
    renderScoring();
  }catch(err){
    setCloudStatus("OFFLINE CACHE","warn");
  }
}
function startPolling(){
  if(state.pollTimer)clearInterval(state.pollTimer);
  state.pollTimer=setInterval(()=>{if(!document.hidden)pullSnapshot();},3000);
}
window.addEventListener("online",()=>{state.cloudMode=true;pullSnapshot().then(()=>flushOutbox());});
window.addEventListener("offline",()=>setCloudStatus("OFFLINE","warn"));


function gameLabel(){
 if(state.games.forty)return "40 Ball";
 const c=nassauCfg(state.currentFoursome);
 if(c.enabled)return `Nassau ${c.preset}`;
 return "None";
}
function renderQuickGameSetup(){
 const host=$("#quickGameSetup");
 if(!host)return;
 const selected=gameLabel();
 host.innerHTML=`<div class="quick-game-head"><div><div class="eyebrow">SIDE GAME</div><b>${esc(selected)}</b></div>${isOrganizer()?`<button id="editGameBtn" class="btn ghost" type="button">${selected==="None"?"Select Game":"Edit"}</button>`:`<span class="organizer-lock">Organizer controls</span>`}</div>
 <div id="quickGameBody" class="hidden"></div>`;
 $("#editGameBtn")?.addEventListener("click",()=>{
   const body=$("#quickGameBody");
   body.classList.toggle("hidden");
   if(!body.classList.contains("hidden"))renderQuickGameBody();
 });
}
function renderQuickGameBody(){
 const body=$("#quickGameBody");if(!body)return;
 const g=state.currentFoursome,c=nassauCfg(g);
 const mode=state.games.forty?"forty":c.enabled?(c.preset==="6-6-6"?"nassau66":"nassau55"):"none";
 const wager=state.games.forty?state.games.fortyWager:c.wager;
 body.innerHTML=`<div class="quick-game-grid">
   <label>Game
     <select id="quickGameSelect">
       <option value="none" ${mode==="none"?"selected":""}>None</option>
       <option value="nassau55" ${mode==="nassau55"?"selected":""}>Nassau 5-5-5-1-1-1</option>
       <option value="nassau66" ${mode==="nassau66"?"selected":""}>Nassau 6-6-6</option>
       <option value="forty" ${mode==="forty"?"selected":""} ${g===2?"disabled":""}>${g===2?"40 Ball — Foursome 1 Must Select":"40 Ball"}</option>
     </select>
   </label>
   <label>Wager ($)<input id="quickGameWager" type="number" min="0" max="9999" step="1" value="${wager}"></label>
 </div>
 <div class="quick-game-note">${state.games.forty
   ?"40 Ball is round-wide. Both foursomes manually select exactly 40 counted net scores."
   :c.enabled
   ?"Nassau is active only for this foursome. Wager applies to every base match and any elected press."
   :g===2
   ?"Select Nassau for this foursome. 40 Ball must be selected from Foursome 1 because it applies to both foursomes."
   :"Select a Nassau format for this foursome, or select round-wide 40 Ball."}</div>
 <button id="saveQuickGameBtn" class="btn primary" type="button">Save Game</button>`;
 $("#saveQuickGameBtn").onclick=async()=>{
   const type=$("#quickGameSelect").value,wager=Math.max(0,Number($("#quickGameWager").value||0));
   if(!state.eventId||!state.cloudMode)return alert("Game setup requires the shared cloud outing.");
   try{
     if(type==="forty"){
       if(g!==1)return alert("40 Ball must be selected from Foursome 1.");
       await api.configureGame(state.eventId,{mode:"forty_ball",foursome_no:1,wager_cents:Math.round(wager*100)});
     }else if(type==="nassau55"||type==="nassau66"){
       await api.configureGame(state.eventId,{mode:"nassau",foursome_no:g,preset_key:type==="nassau66"?"6-6-6":"5-5-5-1-1-1",wager_cents:Math.round(wager*100)});
     }else{
       if(state.games.forty){
         if(g!==1)return alert("Round-wide 40 Ball can only be cleared from Foursome 1.");
         await api.configureGame(state.eventId,{mode:"none",scope:"round",foursome_no:1});
       }else{
         await api.configureGame(state.eventId,{mode:"none",scope:"foursome",foursome_no:g});
       }
     }
     await pullSnapshot();
   }catch(err){
     alert("Game change was not saved: "+err.message);
     await pullSnapshot();
   }
   renderScoring();
 };
}
function renderConflictBanner(){
 let host=document.querySelector("#scoreConflictBanner");
 if(!host){host=document.createElement("div");host.id="scoreConflictBanner";host.className="conflict-banner hidden";document.querySelector("#scoringView .score-topbar")?.insertAdjacentElement("afterend",host);}
 const c=state.scoreConflict;if(!c){host.classList.add("hidden");host.innerHTML="";return;}
 const pos=c.key.lastIndexOf("-"),pid=c.key.slice(0,pos),hole=Number(c.key.slice(pos+1)),player=state.players.find(p=>p.id===pid);
 const local=state.outbox.find(x=>(x.key||`${x.playerId}-${x.hole}`)===c.key),mine=local?.gross??null;
 host.classList.remove("hidden");
 host.innerHTML=`<div><b>Score changed on another device</b><span>${esc(player?.name||"Player")} · Hole ${hole} · yours ${mine??"cleared"} · cloud ${c.serverGross??"cleared"}</span></div><div class="conflict-actions"><button id="conflictMineBtn" class="btn primary" type="button">Keep Mine</button><button id="conflictCloudBtn" class="btn secondary" type="button">Use Cloud</button></div>`;
 $("#conflictMineBtn")?.addEventListener("click",async()=>{state.scoreConflict=null;renderConflictBanner();await flushOutbox();await pullSnapshot();});
 $("#conflictCloudBtn")?.addEventListener("click",async()=>{state.outbox=outboxRemove(state.outbox,c.key);state.pendingScores.delete(c.key);saveOutbox();state.scoreConflict=null;await pullSnapshot();renderConflictBanner();});
}

function renderScoring(){
 saveDeviceState();
 const cmd=$('#commandBtn');if(cmd)cmd.classList.toggle('hidden',!isOrganizer());
 renderConflictBanner();
 $('#outingLabel').textContent=`${state.event.name} · ${state.event.date}`;const show2=hasSecondFoursome();$('#foursomeSwitcher').classList.toggle('hidden',!show2);if(!show2)state.currentFoursome=1;
 if(show2){$('#foursomeSwitcher').innerHTML=[1,2].map(g=>`<button data-foursome="${g}" class="${state.currentFoursome===g?'active':''}">Foursome ${g}</button>`).join('');document.querySelectorAll('[data-foursome]').forEach(b=>b.onclick=()=>{state.currentFoursome=+b.dataset.foursome;renderScoring();});}
 renderQuickGameSetup();
 const h=state.currentHole;$('#holeNumber').textContent=h;$('#holeMeta').textContent=`Par ${course.par[h-1]} · HCP ${course.strokeIndex[h-1]}`;$('#prevHole').disabled=h===1&&!state.visited18;
 const ps=groupPlayers(state.currentFoursome),rows=playingRows(state.currentFoursome);
 $('#scoreRows').innerHTML=ps.map(p=>{const info=rows.find(x=>x.id===p.id),gross=state.scores[key(p.id,h)]??'',net=gross!==''?netFor(p,h):null,pts=net!==null?stablefordPoints(net,course.par[h-1]):null;return `<div class="score-player"><div><b>${esc(p.name)}</b><small>${p.tee} · HI ${Number(p.index).toFixed(1)} · CH ${info.courseHandicap} · ${info.playingHandicap===0?'Plays off 0':`Playing Hcp ${info.playingHandicap}`}</small></div><input class="score-input" data-score-player="${p.id}" inputmode="numeric" type="number" min="1" max="15" value="${gross}" placeholder="—" ${state.confirmations[state.currentFoursome]==='confirmed'?'disabled':''}><div class="score-result">${gross!==''?`Net ${net} · <strong>${pts} pts</strong>`:`${info.playingHandicap===0?'No stroke':`${Math.max(0,info.playingHandicap)} playing hcp`} · enter gross`}</div>${state.games.forty?`<button type="button" class="forty-toggle ${fortySelectionsFor(state.currentFoursome)[selectionKey(p.id,h)]?'selected':''}" data-forty-player="${p.id}" ${gross===''?'disabled':''}>${fortySelectionsFor(state.currentFoursome)[selectionKey(p.id,h)]?'✓ Counted':'Count in 40 Ball'}</button>`:''}</div>`;}).join('');
 document.querySelectorAll('[data-score-player]').forEach(inp=>inp.oninput=()=>{let v=inp.value===''?'':Math.max(1,Math.min(15,Number(inp.value)));if(v!=='')inp.value=v;const h=state.currentHole,pid=inp.dataset.scorePlayer;state.scores[key(pid,h)]=v;if(v===''&&state.games.forty){const g=state.currentFoursome,k40=selectionKey(pid,h);if(fortySelectionsFor(g)[k40]){delete fortySelectionsFor(g)[k40];if(state.eventId&&state.cloudMode)api.setFortyBallSelection(state.eventId,{foursome_no:g,player_id:pid,hole:h,value:false}).catch(()=>{});}}pushScore(pid,h,v);renderScoring();});
 document.querySelectorAll('[data-forty-player]').forEach(b=>b.onclick=()=>toggleForty(b.dataset.fortyPlayer,state.currentHole));
 const holes=[...Array(18)].filter((_,i)=>ps.length&&ps.every(p=>Number(state.scores[key(p.id,i+1)]||0)>0)).length,entered=Object.values(state.scores).filter(v=>Number(v)>0).length,total=state.players.length*18;$('#groupProgress').textContent=`${show2?`Foursome ${state.currentFoursome} · `:''}${holes}/18 holes complete`;$('#roundProgress').textContent=`${entered}/${total} scores`;$('#progressFill').style.width=`${Math.round(holes/18*100)}%`;
 let jump=$("#jumpMissingBtn");
 if(!jump){
   jump=document.createElement("button");jump.id="jumpMissingBtn";jump.type="button";jump.className="jump-missing";
   document.querySelector(".progress-wrap")?.appendChild(jump);
 }
 const nextMissing=nextIncompleteHole(state.currentFoursome);
 jump.textContent=holes===18?"Card complete":`Jump to next missing · Hole ${nextMissing}`;
 jump.disabled=holes===18;
 jump.onclick=()=>{state.currentHole=nextMissing;renderScoring();};

 renderGameStrip();renderLiveNassau();renderScorecard();renderConfirmation();renderGames();renderLedger();
}
$('#prevHole').onclick=()=>{if(state.currentHole===1){if(state.visited18)state.currentHole=18;else return;}else state.currentHole--;renderScoring();};
$('#nextHole').onclick=()=>{if(state.currentHole===18){state.visited18=true;state.currentHole=1;}else state.currentHole++;if(state.currentHole===18)state.visited18=true;renderScoring();};

function currentNassauSegment(){const c=nassauCfg(state.currentFoursome);return c.enabled?(NASSAU_PRESETS[c.preset]||[]).find(s=>s.holes.includes(state.currentHole))||null:null;}
function nassauGameForGroup(g){return (state.remoteGames||[]).find(x=>x.game_type==="nassau"&&Number(x.foursome_no)===g)||null;}
async function addLivePress(avail){
 const g=state.currentFoursome,seg=currentNassauSegment(),game=nassauGameForGroup(g);if(!seg||!game)return alert("Nassau game is not synced yet.");
 try{const saved=await api.addPress(state.eventId,{game_id:game.id,segment_key:seg.key,from_hole:avail.nextHole,pressed_by_side:avail.pressedBy,wager_cents:Math.round(nassauCfg(g).wager*100),parent_press_id:avail.parentPressId||null});state.presses.push({id:saved.id,gameId:saved.game_id,segmentKey:saved.segment_key,fromHole:saved.from_hole,pressedBy:saved.pressed_by_side,amount:saved.wager_cents/100,parentPressId:saved.parent_press_id||null,foursome_no:g});renderScoring();}catch(err){alert(err.message);}
}
function renderLiveNassau(){
 let host=document.querySelector("#liveNassauCard");if(!host){host=document.createElement("section");host.id="liveNassauCard";host.className="live-nassau";document.querySelector("#gameStrip").insertAdjacentElement("afterend",host);}
 const cfg=nassauCfg(state.currentFoursome);if(!cfg.enabled){host.classList.add("hidden");host.innerHTML="";return;}
 const g=state.currentFoursome,ps=groupPlayers(g),seg=currentNassauSegment();if(ps.length!==4||!seg){host.classList.add("hidden");return;}
 const result=segmentResult({segment:seg,players:ps,getNet:(p,h)=>netFor(p,h),throughHole:state.currentHole});
 const teamName=t=>t.map(p=>p.name.split(" ")[0]).join(" / ");
 const standing=!result.played?"Not started":result.aWins===result.bWins?"All square":`${teamName(result.aWins>result.bWins?result.teams[0]:result.teams[1])} ${Math.abs(result.aWins-result.bWins)} up`;
 const presses=pressesForGroup(g).filter(p=>p.segmentKey===seg.key),avail=pressAvailability({segment:seg,players:ps,presses,getNet:(p,h)=>netFor(p,h)});
 host.classList.remove("hidden");
 host.innerHTML=`<div class="eyebrow">LIVE NASSAU · ${esc(seg.label.toUpperCase())}</div>
 <div class="live-nassau-head"><div><h3>${esc(standing)}</h3><p>${teamName(result.teams[0])} vs ${teamName(result.teams[1])}</p></div>${avail.kind&&isOrganizer()?`<button id="addLivePressBtn" class="btn primary">${avail.kind==="counter"?"Press the Press":"Press"} · Hole ${avail.nextHole}</button>`:""}</div>
 <div class="nassau-kpis"><div><span>BASE WAGER</span><b>$${cfg.wager}</b></div><div><span>HOLES PLAYED</span><b>${result.played}/${result.total}</b></div><div><span>ACTIVE PRESSES</span><b>${presses.length}</b></div></div>
 ${presses.length?`<div class="press-history">${presses.map(pr=>{const o=pressResult({segment:seg,players:ps,press:pr,getNet:(p,h)=>netFor(p,h)});let st="Pending";if(o?.complete)st=o.winner==="half"?"Halved":`${teamName(o.winner==="a"?o.teams[0]:o.teams[1])} win`;return `<div><span><b>${pr.parentPressId?"Press the Press":"Press"}</b><small>Starts Hole ${pr.fromHole} · $${pr.amount}</small></span><strong>${esc(st)}</strong></div>`;}).join("")}</div>`:""}
 ${seg.singleHole?`<p class="muted">Standalone full-wager one-hole match. Presses are not available.</p>`:avail.kind?"":`<p class="muted">${esc(avail.reason||"")}</p>`}`;
 document.querySelector("#addLivePressBtn")?.addEventListener("click",()=>addLivePress(avail));
}


function groupComplete(g){
 const ps=groupPlayers(g);
 return !!ps.length && ps.every(p=>[...Array(18)].every((_,i)=>Number(state.scores[key(p.id,i+1)]||0)>0));
}
async function confirmCurrentCard(){
 const g=state.currentFoursome;
 if(!groupComplete(g))return alert("Every player in this foursome needs 18 scores before confirmation.");
 if(!state.eventId||!state.cloudMode){
   state.confirmations[g]="confirmed";renderScoring();return;
 }
 try{await api.confirmation(state.eventId,g,"confirm","shared-link");state.confirmations[g]="confirmed";renderScoring();}
 catch(err){alert(err.message);}
}
async function unlockCard(g){
 if(!state.eventId||!state.cloudMode){state.confirmations[g]="in_progress";renderCommand();return;}
 try{await api.confirmation(state.eventId,g,"unlock","organizer");state.confirmations[g]="in_progress";await refreshCommandData();renderCommand();}
 catch(err){alert(err.message);}
}
function renderConfirmation(){
 let host=document.querySelector("#confirmationCard");
 if(!host){host=document.createElement("section");host.id="confirmationCard";host.className="confirmation-card";document.querySelector("#roundScorecard").closest("details").insertAdjacentElement("beforebegin",host);}
 const g=state.currentFoursome,status=state.confirmations[g]||"in_progress",complete=groupComplete(g);
 if(status==="confirmed"){
   host.innerHTML=`<div><span class="status-dot confirmed"></span><div><b>Scorecard confirmed</b><small>Foursome ${g} is locked. Organizer can unlock it for a correction.</small></div></div>`;
 }else if(complete){
   host.innerHTML=`<div><span class="status-dot ready"></span><div><b>Ready to confirm</b><small>Review the gross scorecard, then lock this foursome.</small></div></div><button id="confirmCardBtn" class="btn primary" type="button">Confirm Card</button>`;
   document.querySelector("#confirmCardBtn")?.addEventListener("click",confirmCurrentCard);
 }else{
   host.innerHTML=`<div><span class="status-dot"></span><div><b>In progress</b><small>Confirmation becomes available when all scores are entered.</small></div></div>`;
 }
}

function renderGameStrip(){
 const out=[];
 if(state.games.forty)out.push(`<span class="game-pill">40 Ball · round-wide</span>`);
 else{
   const c=nassauCfg(state.currentFoursome);
   if(c.enabled)out.push(`<span class="game-pill live">Nassau ${c.preset} · $${c.wager}</span>`);
 }
 if(!out.length)out.push(`<span class="game-pill">No side game for this foursome</span>`);
 $("#gameStrip").innerHTML=out.join("");
}
function renderScorecard(){const ps=groupPlayers(state.currentFoursome),holes=[...Array(18)].map((_,i)=>i+1);$('#roundScorecard').innerHTML=`<div class="scorecard-scroll"><table class="scorecard-table"><thead><tr><th>Player</th>${holes.map(h=>`<th>${h}</th>`).join('')}<th>Total</th></tr></thead><tbody>${ps.map(p=>{const vals=holes.map(h=>Number(state.scores[key(p.id,h)]||0));return `<tr><th class="name">${esc(p.name.split(' ')[0])}</th>${vals.map(v=>`<td>${v||'—'}</td>`).join('')}<td><b>${vals.reduce((a,b)=>a+b,0)||'—'}</b></td></tr>`;}).join('')}</tbody></table></div>`;}
function nassauResults(g){const ps=groupPlayers(g),c=nassauCfg(g);if(ps.length!==4||!c.enabled)return [];return (NASSAU_PRESETS[c.preset]||[]).map(seg=>({seg,r:segmentResult({segment:seg,players:ps,getNet:(p,h)=>netFor(p,h)})}));}

function fortySelectionsFor(g){state.fortySelections[g]??={};return state.fortySelections[g];}
function fortySummaryFor(g){return fortyBallSummary({players:groupPlayers(g),selections:fortySelectionsFor(g),getNet:(p,h)=>netFor(p,h),getPar:h=>course.par[h-1]});}
function fortyMatch(){return fortyBallMatch({group1:groupPlayers(1),group2:groupPlayers(2),selections1:fortySelectionsFor(1),selections2:fortySelectionsFor(2),getNet:(p,h)=>netFor(p,h),getPar:h=>course.par[h-1]});}
async function toggleForty(pid,hole){
 const g=state.currentFoursome,map=fortySelectionsFor(g),k=selectionKey(pid,hole);
 const check=canSelectFortyBall({players:groupPlayers(g),selections:map,getNet:(p,h)=>netFor(p,h),getPar:h=>course.par[h-1],playerId:pid,hole});
 if(!check.ok)return alert(check.reason);
 const next=!map[k];if(next)map[k]=true;else delete map[k];renderScoring();
 if(state.eventId&&state.cloudMode){try{await api.setFortyBallSelection(state.eventId,{foursome_no:g,player_id:pid,hole,value:next});}catch(err){if(next)delete map[k];else map[k]=true;renderScoring();alert(err.message);}}
}
function pressesForGroup(g){return (state.presses||[]).filter(p=>Number(p.foursome_no||0)===g);}

function renderGames(){
 const blocks=[];
 if(state.games.forty){
   const a=fortySummaryFor(1),b=hasSecondFoursome()?fortySummaryFor(2):null,fmt=x=>x===0?'E':x>0?`+${x}`:`${x}`;
   blocks.push(`<div class="game-status"><h3>40 Ball</h3><p>Foursome 1: <b>${fmt(a.relative)}</b> · ${a.count}/40 counted${b?` · Foursome 2: <b>${fmt(b.relative)}</b> · ${b.count}/40 counted`:''}</p><p>Exactly 40 scores are selected manually. Lower selected net total relative to par wins. Wager $${state.games.fortyWager} per player.</p></div>`);
 }else{
   for(const g of [1,2]){
     const ps=groupPlayers(g),c=nassauCfg(g);if(!ps.length||!c.enabled)continue;
     const rs=nassauResults(g);
     blocks.push(`<div class="game-status"><h3>Foursome ${g} · Nassau ${c.preset}</h3><p>${rs.length?rs.map(x=>`${x.seg.label}: ${x.r.complete?(x.r.winner==='half'?'Halved':`${x.r.winner==='a'?'Side A':'Side B'} wins`):`${x.r.played}/${x.seg.holes.length} holes`}`).join(' · '):'Requires four players.'}</p><p>Wager $${c.wager} per match${c.preset==="5-5-5-1-1-1"?". Holes 16–18 are separate full-wager one-hole matches.":""}</p></div>`);
   }
 }
 $('#gamesContent').innerHTML=blocks.length?blocks.join(''):'<p class="muted">No side games selected.</p>';
}
function ledgerNet(){
 const net=Object.fromEntries(state.players.map(p=>[p.id,0]));
 if(!state.games.forty){
   for(const g of [1,2]){
     const ps=groupPlayers(g),c=nassauCfg(g);if(ps.length!==4||!c.enabled)continue;
     const n=nassauGroupNet({players:ps,preset:c.preset,wager:c.wager,presses:pressesForGroup(g),getNet:(p,h)=>netFor(p,h)});
     Object.entries(n).forEach(([id,v])=>net[id]+=Number(v||0));
   }
 }
 if(state.games.forty&&hasSecondFoursome()){
   const m=fortyMatch();if(m.complete&&m.winner)state.players.forEach(p=>net[p.id]+=p.foursome===m.winner?state.games.fortyWager:-state.games.fortyWager);
 }
 return net;
}
function renderLedger(){
 const net=ledgerNet();assertZeroSum(net);const pays=paymentsFromNet(net);
 $('#ledgerContent').innerHTML=`
 <div class="ledger-status"><span>LIVE</span><p>Nassau base matches, presses and 40 Ball results settle automatically from entered scores.</p></div>
 <div class="ledger-net">${state.players.map(p=>{const v=net[p.id]||0;return `<button type="button" class="ledger-player" data-chit-player="${p.id}"><span><b>${esc(p.name)}</b><small>${v>0?'RECEIVES':v<0?'OWES':'EVEN'} · tap for chit</small></span><strong class="${v>0?'positive':v<0?'negative':''}">${v>0?'+':''}$${Number(v).toFixed(0)}</strong></button>`;}).join('')}</div>
 <h3>Who Pays Who</h3>
 ${pays.length?pays.map(x=>{const f=state.players.find(p=>p.id===x.from)?.name,t=state.players.find(p=>p.id===x.to)?.name;return `<div class="payment-row"><span><b>${esc(f)}</b> pays <b>${esc(t)}</b></span><strong>$${x.amount.toFixed(0)}</strong></div>`;}).join(''):'<p class="muted">Completed side-game payments will appear here automatically.</p>'}`;
 document.querySelectorAll('[data-chit-player]').forEach(b=>b.onclick=()=>openChit(b.dataset.chitPlayer));
}
document.querySelectorAll('.bottom-nav [data-pane]').forEach(b=>b.onclick=()=>{document.querySelectorAll('.bottom-nav [data-pane]').forEach(x=>x.classList.toggle('active',x===b));['gamesPane','ledgerPane'].forEach(id=>$('#'+id).classList.add('hidden'));if(b.dataset.pane!=='scorePane')$('#'+b.dataset.pane).classList.remove('hidden');});

function formatAudit(a){
  const p=a.payload||{};
  const player=state.players.find(x=>x.id===p.player_id)?.name||"";
  if(a.action==="score_created")return `${player} · Hole ${p.hole}: ${p.new_gross}`;
  if(a.action==="score_updated")return `${player} · Hole ${p.hole}: ${p.old_gross} → ${p.new_gross}`;
  if(a.action==="score_deleted")return `${player} · Hole ${p.hole}: score cleared`;
  if(a.action==="press_created")return `Press added · ${p.segment_key} from Hole ${p.from_hole}`;
  if(a.action==="games_replaced")return `Games updated · ${p.count} active`;
  if(a.action==="event_reset")return `Event reset · ${p.mode}`;
  if(a.action==="event_restored")return `Backup restored · ${p.scores||0} scores`;
  if(a.action==="scorecard_confirmed")return `Foursome ${p.foursome_no} scorecard confirmed`;
  if(a.action==="scorecard_unlocked")return `Foursome ${p.foursome_no} unlocked for correction`;
  return a.action.replaceAll("_"," ");
}
async function refreshCommandData(){
  if(!state.eventId||!state.cloudMode)return;
  try{
    const data=await api.audit(state.eventId,40);
    state.auditEvents=data.events||[];
  }catch(err){console.warn(err);}
}
function downloadJson(name,data){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function startNewOuting(){
 if(!confirm("Start a new outing on this device? The current cloud outing will remain saved."))return;
 clearDeviceState();
 const u=new URL(location.href);u.searchParams.delete("event");history.replaceState(null,"",u);
 location.reload();
}

async function createBackup(){
  if(!state.eventId)return alert("This local V2 outing has not been created in Cloudflare.");
  try{
    const data=await api.backup(state.eventId);
    downloadJson(`tngc-${state.eventId}-backup.json`,data);
  }catch(err){alert("Backup failed: "+err.message);}
}

async function restoreFromFile(file){
 if(!state.eventId)return alert("No cloud event to restore.");
 let backup;
 try{backup=JSON.parse(await file.text());}catch{return alert("That backup file is not valid JSON.");}
 if(String(backup?.event?.id||"")!==String(state.eventId))return alert("This backup belongs to a different outing.");
 const phrase=prompt("Type RESTORE to replace scores, games, presses, and 40 Ball selections with this backup.");
 if(phrase!=="RESTORE")return;
 try{
   await api.restore(state.eventId,backup);
   await pullSnapshot();await refreshCommandData();renderCommand();
   alert("Backup restored.");
 }catch(err){alert("Restore failed: "+err.message);}
}

async function controlledReset(){
  if(!state.eventId)return alert("No cloud event to reset.");
  const phrase=prompt('Type RESET to clear all scores for this outing. Games and setup will remain.');
  if(phrase!=="RESET")return;
  try{
    await createBackup();
    await api.reset(state.eventId,"scores");
    state.scores={};state.scoreRevisions={};state.auditEvents=[];
    await pullSnapshot();await refreshCommandData();renderCommand();
    alert("Scores cleared. A backup was downloaded first.");
  }catch(err){alert("Reset failed: "+err.message);}
}
function missingScoreRows(){
  const rows=[];
  for(const g of [1,2]){
    const ps=groupPlayers(g);if(!ps.length)continue;
    for(let h=1;h<=18;h++){
      const missing=ps.filter(p=>!Number(state.scores[key(p.id,h)]||0));
      if(missing.length)rows.push({g,h,names:missing.map(p=>p.name)});
    }
  }
  return rows;
}
function playerChit(playerId){
 const p=state.players.find(x=>x.id===playerId);if(!p)return "";const lines=[];
 if(!state.games.forty){const g=p.foursome,ps=groupPlayers(g),c=nassauCfg(g);if(ps.length===4&&c.enabled){const segments=NASSAU_PRESETS[c.preset]||[];for(const seg of segments){const o=segmentResult({segment:seg,players:ps,getNet:(pp,h)=>netFor(pp,h)});if(o.complete&&o.winner!=="half"){const w=o.winner==="a"?o.teams[0]:o.teams[1],l=o.winner==="a"?o.teams[1]:o.teams[0],amount=w.some(x=>x.id===playerId)?c.wager:l.some(x=>x.id===playerId)?-c.wager:0;if(amount)lines.push({order:Math.min(...seg.holes),kind:0,text:`Nassau · ${seg.label}`,amount});}}for(const pr of pressesForGroup(g)){const seg=segments.find(s=>s.key===pr.segmentKey);if(!seg||seg.singleHole)continue;const o=pressResult({segment:seg,players:ps,press:pr,getNet:(pp,h)=>netFor(pp,h)});if(o?.complete&&o.winner!=="half"){const w=o.winner==="a"?o.teams[0]:o.teams[1],l=o.winner==="a"?o.teams[1]:o.teams[0],amount=w.some(x=>x.id===playerId)?pr.amount:l.some(x=>x.id===playerId)?-pr.amount:0;if(amount)lines.push({order:Number(pr.fromHole),kind:pr.parentPressId?2:1,text:`${pr.parentPressId?'Press the Press':'Nassau Press'} · ${seg.label} · starts Hole ${pr.fromHole}`,amount});}}}}
 if(state.games.forty&&hasSecondFoursome()){const m=fortyMatch();if(m.complete&&m.winner)lines.push({order:19,kind:9,text:"40 Ball",amount:p.foursome===m.winner?state.games.fortyWager:-state.games.fortyWager});}
 lines.sort((a,b)=>a.order-b.order||a.kind-b.kind);const total=lines.reduce((s,x)=>s+x.amount,0);
 return `<div class="chit-card"><div class="chit-head"><div><div class="eyebrow">PLAYER CHIT</div><h3>${esc(p.name)}</h3></div><strong class="${total>0?"positive":total<0?"negative":""}">${total>0?"+":""}$${total.toFixed(0)}</strong></div>${lines.length?lines.map(x=>`<div class="chit-line"><span>${esc(x.text)}</span><b class="${x.amount>0?"positive":"negative"}">${x.amount>0?"+":""}$${x.amount.toFixed(0)}</b></div>`).join(""):`<p class="muted">No completed side-game transactions yet.</p>`}</div>`;
}
function openChit(playerId){
  let host=document.querySelector("#chitModal");
  if(!host){host=document.createElement("div");host.id="chitModal";document.body.appendChild(host);}
  host.innerHTML=`<div class="modal-backdrop"><section class="modal-card"><button type="button" class="modal-close">×</button>${playerChit(playerId)}</section></div>`;
  host.querySelector(".modal-close").onclick=()=>host.remove();
  host.querySelector(".modal-backdrop").onclick=e=>{if(e.target===e.currentTarget)host.remove();};
}

function renderCommand(){
 const total=state.players.length*18,entered=Object.values(state.scores).filter(v=>Number(v)>0).length;
 const missing=missingScoreRows();
 const groups=[1,2].map(g=>{
   const ps=groupPlayers(g);if(!ps.length)return '';
   const holes=[...Array(18)].filter((_,i)=>ps.every(p=>Number(state.scores[key(p.id,i+1)]||0)>0)).length;
   const next=[...Array(18)].map((_,i)=>i+1).find(h=>ps.some(p=>!Number(state.scores[key(p.id,h)]||0)))||'Complete';
   const status=state.confirmations[g]||'in_progress';return `<div class="command-group"><div class="command-title"><div><h3>Foursome ${g}</h3><p>${ps.map(p=>esc(p.name.split(' ')[0])).join(' · ')}</p></div><span class="card-status ${status}">${status==='confirmed'?'CONFIRMED':holes===18?'READY':'IN PROGRESS'}</span></div><p><b>${holes}/18 holes complete</b> · Next missing: ${next}</p>${status==='confirmed'?`<button class="btn secondary" type="button" data-unlock-group="${g}">Unlock for Correction</button>`:''}</div>`;
 }).join('');
 const activity=(state.auditEvents||[]).slice(0,12);
 $('#commandContent').innerHTML=`
 <div class="command-grid">
   <div class="metric"><span>PLAYERS</span><strong>${state.players.length}</strong></div>
   <div class="metric"><span>SCORES ENTERED</span><strong>${entered}</strong></div>
   <div class="metric"><span>ROUND COMPLETE</span><strong>${total?Math.round(entered/total*100):0}%</strong></div>
   <div class="metric"><span>SYNC</span><strong class="${state.cloudMode?'health-good':'health-warn'}">${state.cloudMode?'GOOD':'LOCAL'}</strong><small>${state.lastSync?`Last ${Math.max(0,Math.round((Date.now()-state.lastSync.getTime())/1000))}s ago`:''}</small></div>
 </div>
 ${groups}
 <div class="command-group">
   <div class="command-title"><div><h3>Missing Scores</h3><p>${missing.length} hole${missing.length===1?'':'s'} have at least one missing score.</p></div></div>
   ${missing.length?`<div class="missing-list">${missing.slice(0,12).map(x=>`<div><b>F${x.g} · Hole ${x.h}</b><span>${x.names.map(esc).join(', ')}</span></div>`).join('')}${missing.length>12?`<p class="muted">+ ${missing.length-12} more</p>`:''}</div>`:`<p class="health-good">All scores are complete.</p>`}
 </div>
 <div class="command-group">
   <div class="command-title"><div><h3>Recent Changes</h3><p>Score corrections and organizer actions are shown newest first.</p></div><button id="refreshAuditBtn" class="btn secondary" type="button">Refresh</button></div>
   <div class="audit-list">${activity.length?activity.map(a=>`<div class="audit-row"><span>${esc(formatAudit(a))}</span><small>${esc(a.created_at||'')}</small></div>`).join(''):'<p class="muted">No cloud activity loaded yet.</p>'}</div>
 </div>
 <div class="command-group">
   <h3>Recovery & Safeguards</h3>
   <p>Backups export the complete event data, including scores, games, presses and audit history.</p>
   <div class="command-actions"><button id="backupBtn" class="btn secondary" type="button">Download Backup</button><label class="file-btn btn secondary">Restore Backup<input id="restoreBackupInput" type="file" accept="application/json,.json"></label><button id="newOutingBtn" class="btn secondary" type="button">New Outing</button><button id="resetScoresBtn" class="btn danger" type="button">Reset Scores</button></div>
 </div>`;
 $('#refreshAuditBtn')?.addEventListener('click',async()=>{await refreshCommandData();renderCommand();});
 $('#backupBtn')?.addEventListener('click',createBackup);
 $('#restoreBackupInput')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)restoreFromFile(f);});
 $('#resetScoresBtn')?.addEventListener('click',controlledReset);
 $('#newOutingBtn')?.addEventListener('click',startNewOuting);
 document.querySelectorAll('[data-unlock-group]').forEach(b=>b.onclick=()=>unlockCard(Number(b.dataset.unlockGroup)));
}
$('#commandBtn').onclick=async()=>{if(!isOrganizer())return alert('Command Center is available on the organizer device.');$('#scoringView').classList.add('hidden');$('#commandView').classList.remove('hidden');await refreshCommandData();renderCommand();};$('#closeCommandBtn').onclick=()=>{$('#commandView').classList.add('hidden');$('#scoringView').classList.remove('hidden');renderScoring();};
async function loadSharedEventFromUrl(){
 const eventId=new URL(location.href).searchParams.get("event");
 if(!eventId)return false;
 try{
   const snap=await api.snapshot(eventId);
   state.eventId=eventId;state.cloudMode=true;saveOrganizerToken(eventId,loadOrganizerToken(eventId));state.outbox=loadOutbox(eventId);
   state.event={name:snap.event.name,date:snap.event.event_date};
   state.players=(snap.players||[]).map(p=>({
     id:p.id,name:p.display_name,index:Number(p.handicap_index),tee:p.tee_key,foursome:Number(p.foursome_no)
   }));
   const mapped=scoreMapFromSnapshot(snap);state.scores=mapped.scores;state.scoreRevisions=mapped.revisions;
    state.remoteGames=snap.games||[];
    state.games.nassauByGroup={1:{enabled:false,preset:"5-5-5-1-1-1",wager:5},2:{enabled:false,preset:"5-5-5-1-1-1",wager:5}};
    const fortyGame=(snap.games||[]).find(g=>g.game_type==="forty_ball");
    state.games.forty=!!fortyGame;
    if(fortyGame)state.games.fortyWager=Number(fortyGame.wager_cents||0)/100;
    for(const ng of (snap.games||[]).filter(g=>g.game_type==="nassau")){
      const gg=Number(ng.foursome_no);
      if([1,2].includes(gg))state.games.nassauByGroup[gg]={enabled:true,preset:ng.preset_key,wager:Number(ng.wager_cents||0)/100};
    }
    syncLegacyGameFlags();
    const gameById=Object.fromEntries((snap.games||[]).map(g=>[g.id,g]));
    state.presses=(snap.presses||[]).map(p=>({id:p.id,gameId:p.game_id,segmentKey:p.segment_key,fromHole:Number(p.from_hole),pressedBy:p.pressed_by_side,amount:Number(p.wager_cents||0)/100,parentPressId:p.parent_press_id||null,foursome_no:Number(gameById[p.game_id]?.foursome_no||0)}));
    state.fortySelections={1:{},2:{}};
    for(const x of snap.forty_ball_selections||[]){state.fortySelections[Number(x.foursome_no)]??={};state.fortySelections[Number(x.foursome_no)][selectionKey(x.player_id,Number(x.hole))]=true;}
    state.confirmations={1:'in_progress',2:'in_progress'};for(const c of snap.confirmations||[])state.confirmations[Number(c.foursome_no)]=c.status;
   syncLegacyGameFlags();
   $("#builderView").classList.add("hidden");$("#scoringView").classList.remove("hidden");
   const resume=preferredResume(eventId);
   state.currentFoursome=resume&&hasSecondFoursome()&&[1,2].includes(Number(resume.currentFoursome))?Number(resume.currentFoursome):1;
   state.currentHole=resume?Math.max(1,Math.min(18,Number(resume.currentHole)||1)):nextIncompleteHole(state.currentFoursome);
   state.visited18=!!resume?.visited18;
   renderScoring();startPolling();setCloudStatus("CLOUD LIVE","ok");
   return true;
 }catch(err){console.warn(err);return false;}
}
checkEnvironment();
loadSharedEventFromUrl().then(ok=>{
 if(!ok){for(let i=0;i<4;i++)addPlayer();renderBuilder();}
});
