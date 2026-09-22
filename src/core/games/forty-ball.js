// Ballyhack production parity:
// Each foursome MANUALLY selects exactly 40 of its 72 entered net hole scores.
// Selected scores are totaled relative to par. Lower total wins.

export function selectionKey(playerId,hole){ return `${playerId}|${hole}`; }

export function fortyBallSummary({players,selections={},getNet,getPar}){
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
  return {count:selected.length,relative:selected.reduce((sum,x)=>sum+x.relative,0),selected,complete:selected.length===40};
}
export function canSelectFortyBall({players,selections={},getNet,getPar,playerId,hole}){
  const k=selectionKey(playerId,hole);
  if(selections[k]) return {ok:true,action:"remove"};
  const player=players.find(p=>p.id===playerId);
  if(!player || getNet(player,hole)===null) return {ok:false,reason:"Enter the gross score first"};
  const summary=fortyBallSummary({players,selections,getNet,getPar});
  if(summary.count>=40) return {ok:false,reason:"40 scores are already counted"};
  return {ok:true,action:"add"};
}
export function fortyBallMatch({group1,group2,selections1={},selections2={},getNet,getPar}){
  const first=fortyBallSummary({players:group1,selections:selections1,getNet,getPar});
  const second=fortyBallSummary({players:group2,selections:selections2,getNet,getPar});
  const complete=first.count===40 && second.count===40;
  const winner=!complete?null:first.relative===second.relative?0:first.relative<second.relative?1:2;
  return {first,second,complete,winner};
}
