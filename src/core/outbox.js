export function outboxUpsert(items,item){
  const key=`${item.playerId}-${item.hole}`;
  return [...(items||[]).filter(x=>(x.key||`${x.playerId}-${x.hole}`)!==key),{...item,key}]
    .sort((a,b)=>(a.queuedAt||0)-(b.queuedAt||0));
}
export function outboxRemove(items,key){
  return (items||[]).filter(x=>(x.key||`${x.playerId}-${x.hole}`)!==key);
}
export function protectedValuesFromOutbox(items=[]){
  return Object.fromEntries(items.map(x=>[x.key||`${x.playerId}-${x.hole}`,x.gross===null?"":x.gross]));
}
export function updateOutboxRevision(items,key,revision){
  return (items||[]).map(x=>(x.key||`${x.playerId}-${x.hole}`)===key?{...x,expectedRevision:revision}:x);
}
