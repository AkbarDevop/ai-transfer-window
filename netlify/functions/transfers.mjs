// Dynamic transfer store backed by Netlify Blobs.
// GET  /api/transfers          -> list of dynamically-added transfers (JSON array)
// POST /api/transfers          -> add one (requires x-admin-key header == ADMIN_KEY env)
// DELETE /api/transfers?id=... -> remove one (requires x-admin-key)
import { getStore } from "@netlify/blobs";

const KEY = "list";

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default async (req) => {
  const store = getStore("transfers");
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

  // strong consistency so a freshly-added transfer is visible on the next read
  const list = (await store.get(KEY, { type: "json", consistency: "strong" })) || [];

  if (req.method === "GET") {
    return json(list);
  }

  // mutations require the admin key
  const provided = req.headers.get("x-admin-key") || "";
  if (!process.env.ADMIN_KEY || provided !== process.env.ADMIN_KEY) {
    return json({ error: "unauthorized" }, 401);
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

    const required = ["name", "from", "to", "date"];
    for (const f of required) {
      if (!body[f]) return json({ error: `missing field: ${f}` }, 400);
    }

    const entry = {
      id: body.id || `${slugify(body.name)}-${body.from}-${body.to}-${body.date}`,
      name: String(body.name).trim(),
      title: body.title ? String(body.title).trim() : "",
      from: String(body.from).trim(),
      to: String(body.to).trim(),
      date: String(body.date).trim(),
      role: body.role ? String(body.role).trim() : "",
      note: body.note ? String(body.note).trim() : "",
      fee: body.fee ? String(body.fee).trim() : null,
      rumored: !!body.rumored,
      sources: Array.isArray(body.sources) ? body.sources : (body.source ? [body.source] : [])
    };

    const next = list.filter((t) => t.id !== entry.id); // upsert by id
    next.push(entry);
    await store.setJSON(KEY, next);
    return json({ ok: true, entry, count: next.length });
  }

  if (req.method === "DELETE") {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return json({ error: "missing id" }, 400);
    const next = list.filter((t) => t.id !== id);
    await store.setJSON(KEY, next);
    return json({ ok: true, removed: list.length - next.length, count: next.length });
  }

  return json({ error: "method not allowed" }, 405);
};
