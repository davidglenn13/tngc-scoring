import {json} from "./_common.js";

export async function onRequestGet(context){
  const environment=String(context.env.TNGC_ENV||"unknown");
  const expectedDatabase=String(context.env.TNGC_DB_NAME||"");
  let databaseReachable=false,databaseInfo=null,error=null;
  try{
    const row=await context.env.DB.prepare("SELECT COUNT(*) events FROM v2_events").first();
    databaseReachable=true;
    databaseInfo={events:Number(row?.events||0)};
  }catch(err){ error=String(err?.message||err); }

  return json({
    ok:databaseReachable,
    app:"tngc-scoring-v2",
    environment,
    expected_database:expectedDatabase||null,
    database_reachable:databaseReachable,
    database_info:databaseInfo,
    error,
    timestamp:new Date().toISOString()
  },databaseReachable?200:503);
}
