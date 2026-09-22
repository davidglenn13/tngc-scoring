export function courseHandicap(index,tee,par=72){
  return Math.round(Number(index)*(Number(tee.slope)/113)+(Number(tee.rating)-par));
}
export function strokesOff(chs){
  if(!chs.length)return [];
  const low=Math.min(...chs);
  return chs.map(ch=>ch-low);
}
export function holeStrokes(ph,si){
  ph=Number(ph); si=Number(si);
  if(ph===0)return 0;
  if(ph>0){const full=Math.floor(ph/18),rem=ph%18; return full+(si<=rem?1:0);}
  const abs=Math.abs(ph),full=Math.floor(abs/18),rem=abs%18;
  return -(full+(rem>0&&si>=19-rem?1:0));
}
export function relativePlayingHandicaps(players,tees,par=72){
  const rows=players.map(p=>({...p,courseHandicap:courseHandicap(p.index,tees[p.tee],par)}));
  const low=Math.min(...rows.map(x=>x.courseHandicap));
  return rows.map(x=>({...x,playingHandicap:x.courseHandicap-low}));
}
