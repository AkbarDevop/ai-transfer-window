// Aggregated, auto-refreshed AI-lab news. Reads a Blobs cache that a scheduled
// function keeps warm; falls back to a live fetch if the cache is cold/stale.
import { getStore } from "@netlify/blobs";

const HN_TERMS = ["OpenAI", "Anthropic", "Google DeepMind", "xAI", "Mistral AI", "Thinking Machines", "Safe Superintelligence", "AI researcher", "frontier model", "AI lab", "Llama", "Gemini"];
const SUBREDDITS = ["MachineLearning", "singularity", "LocalLLaMA", "artificial"];

const RELEVANT = /\b(AI|A\.I\.|artificial intelligence|model|models|LLM|GPT|Claude|Gemini|Llama|Grok|Mistral|OpenAI|Anthropic|DeepMind|xAI|Meta|researcher|research|neural|machine learning|AGI|superintelligence|training|inference|chatbot|alignment|transformer|hire|hired|joins|poach|lab)\b/i;

async function fromHN() {
  const out = [];
  await Promise.all(HN_TERMS.map(async (term) => {
    try {
      const r = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(term)}&tags=story&hitsPerPage=12`, { headers: { "user-agent": "ai-transfer-window/1.0" } });
      if (!r.ok) return;
      const j = await r.json();
      for (const h of j.hits || []) {
        if (!h.title || !h.objectID) continue;
        if ((h.points || 0) < 6 && (h.num_comments || 0) < 3) continue;
        out.push({
          id: "hn-" + h.objectID, title: h.title,
          url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
          source: "Hacker News", points: h.points || 0, comments: h.num_comments || 0,
          date: h.created_at
        });
      }
    } catch {}
  }));
  return out;
}

async function fromReddit() {
  const out = [];
  await Promise.all(SUBREDDITS.map(async (sub) => {
    try {
      const r = await fetch(`https://www.reddit.com/r/${sub}/top.json?t=week&limit=20`, { headers: { "user-agent": "ai-transfer-window/1.0 (news aggregator)" } });
      if (!r.ok) return;
      const j = await r.json();
      for (const c of (j.data && j.data.children) || []) {
        const d = c.data || {};
        if (!d.title || d.stickied) continue;
        if ((d.score || 0) < 40) continue;
        out.push({
          id: "rd-" + d.id, title: d.title,
          url: d.url_overridden_by_dest || ("https://www.reddit.com" + d.permalink),
          source: "r/" + sub, points: d.score || 0, comments: d.num_comments || 0,
          date: new Date((d.created_utc || 0) * 1000).toISOString()
        });
      }
    } catch {}
  }));
  return out;
}

// shared aggregation used by both the on-demand reader and the scheduled refresher
export async function aggregate() {
  const [hn, rd] = await Promise.all([fromHN(), fromReddit()]);
  const seen = new Set();
  const items = [];
  for (const it of [...hn, ...rd]) {
    if (!RELEVANT.test(it.title)) continue;
    const key = it.title.toLowerCase().slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(it);
  }
  items.sort((a, b) => new Date(b.date) - new Date(a.date));
  return items.slice(0, 40);
}

export default async () => {
  const store = getStore("news");
  const now = Date.now();
  let cached = null;
  try { cached = await store.get("latest", { type: "json", consistency: "strong" }); } catch {}

  if (!cached || !cached.items || !cached.items.length || (now - (cached.fetchedAt || 0)) > 20 * 60 * 1000) {
    const items = await aggregate();
    cached = { items, fetchedAt: now };
    try { await store.setJSON("latest", cached); } catch {}
  }

  return new Response(JSON.stringify({ items: cached.items.slice(0, 30), fetchedAt: cached.fetchedAt }), {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=0, s-maxage=300" }
  });
};
