export function scoreKey(playerId,hole){ return `${playerId}-${hole}`; }

export function snapshotToMaps(rows=[]){
  const scores={},revisions={},meta={};
  for(const row of rows){
    const k=scoreKey(row.player_id,Number(row.hole));
    scores[k]=Number(row.gross);
    revisions[k]=Number(row.revision||0);
    meta[k]={updated_at:row.updated_at||null,updated_by:row.updated_by||null};
  }
  return {scores,revisions,meta};
}

export function mergeSnapshot({localScores={},localRevisions={},remoteRows=[],activeKey=null,activeValue=undefined,protectedValues={}}){
  const remote=snapshotToMaps(remoteRows);
  const scores={...remote.scores},revisions={...remote.revisions};
  for(const [k,v] of Object.entries(protectedValues||{})){
    scores[k]=v;
    if(remote.revisions[k]!==undefined)revisions[k]=remote.revisions[k];
    else if(localRevisions[k]!==undefined)revisions[k]=localRevisions[k];
  }
  if(activeKey && activeValue!==undefined){
    scores[activeKey]=activeValue;
    if(remote.revisions[activeKey]!==undefined)revisions[activeKey]=remote.revisions[activeKey];
    else if(localRevisions[activeKey]!==undefined)revisions[activeKey]=localRevisions[activeKey];
  }
  return {scores,revisions,meta:remote.meta};
}

export function nextExpectedRevision(revisions,key){
  const r=Number(revisions?.[key]||0);
  return r>0?r:null;
}

export function applySavedScore(state,result){
  const k=scoreKey(result.player_id,Number(result.hole));
  if(result.gross===null){ delete state.scores[k]; delete state.revisions[k]; }
  else{ state.scores[k]=Number(result.gross); state.revisions[k]=Number(result.revision||0); }
  return state;
}

export function applyConflict({scores,revisions},playerId,hole,server){
  const k=scoreKey(playerId,hole);
  if(server?.revision!==undefined) revisions[k]=Number(server.revision||0);
  return {scores,revisions,conflict:{key:k,serverGross:server?.gross??null,serverRevision:Number(server?.revision||0)}};
}
