import {json,bad,cleanId,newId,audit,requireOrganizer} from "../../_common.js";
import {NASSAU_PRESETS,pressAvailability} from "../../../../../src/core/games/nassau.js";
import {holeStrokes} from "../../../../../src/core/handicap.js";

function pressRows(rows=[]){
  return rows.map(p=>({
    id:p.id,
    segmentKey:p.segment_key,
    fromHole:Number(p.from_hole),
    pressedBy:p.pressed_by_side,
    amount:Number(p.wager_cents||0)/100,
    parentPressId:p.parent_press_id||null
  }));
}

export async function onRequestPost(context){
  try{
    const eventId=cleanId(context.params.id);
    const event=await requireOrganizer(context,eventId);
    const body=await context.request.json();
    const gameId=String(body.game_id||"");
    const segmentKey=String(body.segment_key||"");
    const requestedHole=Number(body.from_hole);
    const requestedSide=String(body.pressed_by_side||"");
    const requestedParent=body.parent_press_id?String(body.parent_press_id):null;

    const game=await context.env.DB.prepare(
      `SELECT id,preset_key,foursome_no,wager_cents
       FROM v2_games
       WHERE id=? AND event_id=? AND game_type='nassau' AND status='active'`
    ).bind(gameId,eventId).first();
    if(!game)return bad("Nassau game not found",404);

    const segment=(NASSAU_PRESETS[game.preset_key]||[]).find(s=>s.key===segmentKey);
    if(!segment)return bad("Invalid Nassau segment",409);
    if(segment.singleHole)return bad("Presses are not available on standalone one-hole matches",409);

    const playerRowsResult=await context.env.DB.prepare(
      `SELECT id,course_handicap FROM v2_players
       WHERE event_id=? AND foursome_no=? ORDER BY sort_order,id`
    ).bind(eventId,Number(game.foursome_no)).all();
    const players=(playerRowsResult.results||[]).map(p=>({id:p.id,courseHandicap:Number(p.course_handicap)}));
    if(players.length!==4)return bad("Rotating Nassau requires four players",409);
    const low=Math.min(...players.map(p=>p.courseHandicap));
    players.forEach(p=>p.playingHandicap=p.courseHandicap-low);

    let courseData={};
    try{courseData=JSON.parse(event.course_data_json||"{}");}catch{}
    const strokeIndex=courseData.strokeIndex;
    if(!Array.isArray(strokeIndex)||strokeIndex.length!==18)return bad("Event course data is incomplete",409);

    const scoreResult=await context.env.DB.prepare(
      `SELECT player_id,hole,gross FROM v2_score_revisions
       WHERE event_id=? AND gross IS NOT NULL`
    ).bind(eventId).all();
    const scoreMap=new Map((scoreResult.results||[]).map(s=>[`${s.player_id}:${Number(s.hole)}`,Number(s.gross)]));
    const getNet=(p,h)=>{
      const gross=scoreMap.get(`${p.id}:${h}`);
      if(gross===undefined)return null;
      return gross-holeStrokes(p.playingHandicap,Number(strokeIndex[h-1]));
    };

    const existingResult=await context.env.DB.prepare(
      `SELECT id,segment_key,from_hole,pressed_by_side,wager_cents,parent_press_id
       FROM v2_presses WHERE game_id=? ORDER BY created_at,id`
    ).bind(gameId).all();
    const existing=pressRows(existingResult.results||[]);
    const available=pressAvailability({segment,players,presses:existing,getNet,currentHole:requestedHole});

    const expectedKind=requestedParent?"counter":"press";
    if(available.kind!==expectedKind)return bad(available.reason||"Press is not available",409);
    if(Number(available.nextHole)!==requestedHole)return bad(`Press must start on Hole ${available.nextHole}`,409);
    if(available.pressedBy!==requestedSide)return bad("Only the eligible losing side may press",409);
    if((available.parentPressId||null)!==requestedParent)return bad("Invalid Press the Press parent",409);

    const id=newId("pr_");
    const wager=Number(game.wager_cents||0);
    await context.env.DB.prepare(
      `INSERT INTO v2_presses(id,game_id,segment_key,from_hole,pressed_by_side,wager_cents,parent_press_id)
       VALUES(?,?,?,?,?,?,?)`
    ).bind(id,gameId,segmentKey,requestedHole,requestedSide,wager,requestedParent).run();

    await audit(context.env,eventId,"press",id,"press_created",{
      game_id:gameId,segment_key:segmentKey,from_hole:requestedHole,
      pressed_by_side:requestedSide,wager_cents:wager,parent_press_id:requestedParent
    });

    return json({
      id,game_id:gameId,segment_key:segmentKey,from_hole:requestedHole,
      pressed_by_side:requestedSide,wager_cents:wager,parent_press_id:requestedParent
    },201);
  }catch(err){
    return bad(err.message||"Unable to create press",err.status||400);
  }
}
