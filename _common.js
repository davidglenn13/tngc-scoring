
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return [...bytes].map(b => b.toString(36).padStart(2, "0")).join("").slice(0, 12);
}

export function cleanState(input) {
  if (!input || typeof input !== "object") throw new Error("Invalid outing state");
  const players = Array.isArray(input.players) ? input.players.slice(0, 8) : [];
  return {
    outing: {
      name: String(input.outing?.name || "TNGC Round").slice(0, 80),
      date: String(input.outing?.date || "").slice(0, 10)
    },
    players: players.map((p, i) => ({
      id: String(p.id || `p${i+1}`).slice(0, 80),
      name: String(p.name || "").slice(0, 80),
      index: Number(p.index),
      tee: String(p.tee || "Blue").slice(0, 20),
      group: Number(p.group) === 2 ? 2 : 1
    })),
    scores: input.scores && typeof input.scores === "object" ? input.scores : {},
    hole: Math.min(18, Math.max(1, Number(input.hole || 1))),
    group: Number(input.group) === 2 ? 2 : 1,
    visited18: Boolean(input.visited18),
    games: {
      nassau: {
        enabled: Boolean(input.games?.nassau?.enabled),
        wager: Math.max(0, Number(input.games?.nassau?.wager || 0)),
        presses: Array.isArray(input.games?.nassau?.presses) ? input.games.nassau.presses.slice(0, 30).map(p=>({
          id:String(p.id||"").slice(0,80),
          group:Number(p.group)===2?2:1,
          segment:["front","back"].includes(String(p.segment))?String(p.segment):"front",
          fromHole:Math.min(18,Math.max(1,Number(p.fromHole||1))),
          pressedBy:p.pressedBy==="b"?"b":"a",
          amount:Math.max(0,Number(p.amount||0))
        })) : []
      },
      forty: {
        enabled: Boolean(input.games?.forty?.enabled),
        wager: Math.max(0, Number(input.games?.forty?.wager || 0))
      }
    },
    organizerMode: Boolean(input.organizerMode),
    nassauTeams: input.nassauTeams && typeof input.nassauTeams === "object" ? input.nassauTeams : {}
  };
}
