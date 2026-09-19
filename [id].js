
import { json, cleanState } from "../_common.js";

export async function onRequestGet(context) {
  const id = context.params.id;
  const row = await context.env.DB.prepare(
    "SELECT id, state_json, updated_at FROM outings WHERE id = ?"
  ).bind(id).first();
  if (!row) return json({ error: "Outing not found" }, 404);
  return json({ id: row.id, state: JSON.parse(row.state_json), updatedAt: row.updated_at });
}

export async function onRequestPut(context) {
  try {
    const id = context.params.id;
    const body = await context.request.json();
    const state = cleanState(body.state || body);
    const existing = await context.env.DB.prepare(
      "SELECT id FROM outings WHERE id = ?"
    ).bind(id).first();
    if (!existing) return json({ error: "Outing not found" }, 404);

    await context.env.DB.prepare(
      `UPDATE outings
       SET name = ?, outing_date = ?, state_json = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).bind(state.outing.name, state.outing.date, JSON.stringify(state), id).run();
    return json({ id, state });
  } catch (err) {
    return json({ error: err.message || "Unable to update outing" }, 400);
  }
}


export async function onRequestPatch(context) {
  try {
    const id = context.params.id;
    const body = await context.request.json();
    const key = String(body.key || "");
    const value = body.value === "" || body.value === null ? "" : Number(body.value);

    if (!/^[A-Za-z0-9._:-]+-\d{1,2}$/.test(key)) {
      return json({ error: "Invalid score key" }, 400);
    }
    if (value !== "" && (!Number.isFinite(value) || value < 1 || value > 15)) {
      return json({ error: "Invalid score" }, 400);
    }

    const row = await context.env.DB.prepare(
      "SELECT state_json FROM outings WHERE id = ?"
    ).bind(id).first();
    if (!row) return json({ error: "Outing not found" }, 404);

    const state = JSON.parse(row.state_json);
    state.scores = state.scores && typeof state.scores === "object" ? state.scores : {};
    if (value === "") delete state.scores[key];
    else state.scores[key] = value;

    await context.env.DB.prepare(
      `UPDATE outings
       SET state_json = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).bind(JSON.stringify(state), id).run();

    return json({ id, key, value });
  } catch (err) {
    return json({ error: err.message || "Unable to update score" }, 400);
  }
}
