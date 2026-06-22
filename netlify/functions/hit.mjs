// First-party, ad-blocker-proof page-view tracking. Stores aggregates in Netlify Blobs.
import { getStore } from "@netlify/blobs";

export default async (req) => {
  if (req.method !== "POST") return new Response("", { status: 405 });
  let b = {};
  try { b = await req.json(); } catch { try { b = JSON.parse((await req.text()) || "{}"); } catch {} }

  const store = getStore("traffic");
  const m = (await store.get("agg", { type: "json", consistency: "strong" })) || { total: 0, days: {}, paths: {}, refs: {} };

  m.total++;
  const day = new Date().toISOString().slice(0, 10);
  m.days[day] = (m.days[day] || 0) + 1;

  const p = String(b.p || "/").slice(0, 80);
  m.paths[p] = (m.paths[p] || 0) + 1;

  let ref = "direct";
  if (b.r) { try { ref = new URL(b.r).hostname.replace(/^www\./, ""); } catch {} }
  if (/netlify\.app$|ai-transfer-window/.test(ref)) ref = "direct"; // ignore internal nav
  if (/^(t\.co|x\.com|twitter\.com)$/.test(ref)) ref = "X / Twitter";
  m.refs[ref] = (m.refs[ref] || 0) + 1;

  try { await store.setJSON("agg", m); } catch {}
  return new Response("ok");
};
