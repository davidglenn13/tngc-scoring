// Ballyhack production parity, generalized for the TNGC roster variants:
// four-player groups select 40 net scores; three-player groups select 30.
// Selected scores are totaled relative to par. Lower total wins.

export function selectionKey(playerId,hole){ return `${playerId}|${hole}`; }

export function fortyBallSummary({players,selections={},getNet,getPar,target=40}){
  const selected=[];
  for(const p of players){
    for(let h=1;h<=18;h++){
      if(!selections[selectionKey(p.id,h)]) continue;
      const net=getNet(p,h);
      if(net===null) continue;
      const par=Number(getPar(h));
      selected.push({playerId:p.id,hole:h,net,par,relative:net-par});
    }
  }
  target=Number(target)===30?30:40;
  return {count:selected.length,relative:selected.reduce((sum,x)=>sum+x.relative,0),selected,target,complete:selected.length===target};
}
export function canSelectFortyBall({players,selections={},getNet,getPar,playerId,hole,target=40}){
  target=Number(target)===30?30:40;
  const k=selectionKey(playerId,hole);
  if(selections[k]) return {ok:true,action:"remove"};
  const player=players.find(p=>p.id===playerId);
  if(!player || getNet(player,hole)===null) return {ok:false,reason:"Enter the gross score first"};
  const summary=fortyBallSummary({players,selections,getNet,getPar,target});
  if(summary.count>=target) return {ok:false,reason:`${target} scores are already counted`};
  return {ok:true,action:"add"};
}
export function fortyBallMatch({group1,group2,selections1={},selections2={},getNet,getPar,target=40}){
  target=Number(target)===30?30:40;
  const first=fortyBallSummary({players:group1,selections:selections1,getNet,getPar,target});
  const second=fortyBallSummary({players:group2,selections:selections2,getNet,getPar,target});
  const complete=first.count===target && second.count===target;
  const winner=!complete?null:first.relative===second.relative?0:first.relative<second.relative?1:2;
  return {first,second,complete,winner};
}
