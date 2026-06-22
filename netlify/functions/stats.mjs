// Private traffic stats. GET /api/stats?key=ADMIN_KEY
import { getStore } from "@netlify/blobs";

export default async (req) => {
  const key = new URL(req.url).searchParams.get("key");
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) return json({ error: "unauthorized" }, 401);

  const store = getStore("traffic");
  const m = (await store.get("agg", { type: "json", consistency: "strong" })) || { total: 0, days: {}, paths: {}, refs: {} };
  const today = new Date().toISOString().slice(0, 10);
  const top = o => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 12);
  // last 14 days series
  const series = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10); series.push({ day: d.slice(5), n: m.days[d] || 0 }); }

  return json({ total: m.total, today: m.days[today] || 0, topPaths: top(m.paths), topRefs: top(m.refs), series });
};
