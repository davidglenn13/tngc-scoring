
import { json, newId, cleanState } from "../_common.js";

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const state = cleanState(body.state || body);
    const id = newId();
    const name = state.outing.name;
    const date = state.outing.date;
    await context.env.DB.prepare(
      `INSERT INTO outings (id, name, outing_date, state_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).bind(id, name, date, JSON.stringify(state)).run();
    return json({ id, state }, 201);
  } catch (err) {
    return json({ error: err.message || "Unable to create outing" }, 400);
  }
}
