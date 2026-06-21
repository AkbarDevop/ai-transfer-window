// Multi-source AI news aggregator (auto-refreshed into a Blobs cache).
// Sources: Hacker News (Algolia) + Google News RSS + curated AI RSS feeds.
import { getStore } from "@netlify/blobs";

const UA = { "user-agent": "ai-transfer-window/1.0 (+https://ai-transfer-window.netlify.app)" };

const HN_TERMS = ["OpenAI", "Anthropic", "Google DeepMind", "xAI", "Mistral AI", "Thinking Machines", "AI researcher", "frontier model"];
const GNEWS_QUERIES = ["OpenAI OR Anthropic OR DeepMind AI", "AI lab researcher hire", "xAI OR Mistral OR \"Safe Superintelligence\""];
const RSS_FEEDS = [
  ["https://the-decoder.com/feed/", "The Decoder"],
  ["https://venturebeat.com/category/ai/feed/", "VentureBeat"],
  ["https://techcrunch.com/category/artificial-intelligence/feed/", "TechCrunch"],
  ["https://www.technologyreview.com/topic/artificial-intelligence/feed", "MIT Tech Review"],
  ["https://importai.substack.com/feed", "Import AI"],
  ["https://www.marktechpost.com/feed/", "MarkTechPost"]
];

const RELEVANT = /\b(AI|A\.I\.|artificial intelligence|model|models|LLM|GPT|Claude|Gemini|Llama|Grok|Mistral|OpenAI|Anthropic|DeepMind|xAI|Meta|researcher|research|neural|machine learning|AGI|superintelligence|training|inference|chatbot|alignment|transformer|agent|hire|hired|joins|poach|lab)\b/i;

function iso(d) { try { const t = new Date(d); return isNaN(t) ? null : t.toISOString(); } catch { return null; } }
function decode(s) { return s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/<[^>]+>/g, "").trim(); }

function parseRSS(xml, source) {
  const items = (xml.match(/<item[\s\S]*?<\/item>/g) || []).concat(xml.match(/<entry[\s\S]*?<\/entry>/g) || []);
  return items.map(it => {
    const g = tag => { const m = it.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)); return m ? decode(m[1]) : ""; };
    let title = g("title");
    let link = g("link"); if (!link) { const lm = it.match(/<link[^>]*href="([^"]+)"/); if (lm) link = lm[1]; }
    const date = iso(g("pubDate") || g("published") || g("updated") || g("dc:date"));
    return { title, url: link, source, date, points: 0, comments: 0 };
  }).filter(x => x.title && x.url && x.date);
}

async function fetchText(url) {
  try { const r = await fetch(url, { headers: UA }); return r.ok ? await r.text() : ""; } catch { return ""; }
}

async function fromHN() {
  const out = [];
  await Promise.all(HN_TERMS.map(async term => {
    try {
      const r = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(term)}&tags=story&hitsPerPage=12`, { headers: UA });
      if (!r.ok) return;
      const j = await r.json();
      for (const h of j.hits || []) {
        if (!h.title || !h.objectID) continue;
        if ((h.points || 0) < 5 && (h.num_comments || 0) < 3) continue;
        out.push({ title: h.title, url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`, source: "Hacker News", points: h.points || 0, comments: h.num_comments || 0, date: h.created_at });
      }
    } catch {}
  }));
  return out;
}

async function fromGoogleNews() {
  const out = [];
  await Promise.all(GNEWS_QUERIES.map(async q => {
    const xml = await fetchText(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`);
    if (xml) parseRSS(xml, "Google News").forEach(i => { i.title = i.title.replace(/\s+-\s+[^-]+$/, ""); out.push(i); });
  }));
  return out;
}

async function fromFeeds() {
  const out = [];
  await Promise.all(RSS_FEEDS.map(async ([url, name]) => {
    const xml = await fetchText(url);
    if (xml) out.push(...parseRSS(xml, name));
  }));
  return out;
}

export async function aggregate() {
  const groups = await Promise.all([fromHN(), fromGoogleNews(), fromFeeds()]);
  const seen = new Set();
  const items = [];
  for (const it of groups.flat()) {
    if (!it.title || !it.date) continue;
    if (!RELEVANT.test(it.title)) continue;
    const key = it.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 50);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(it);
  }
  items.sort((a, b) => new Date(b.date) - new Date(a.date));
  return items.slice(0, 60);
}

export default async () => {
  const store = getStore("news");
  const now = Date.now();
  let cached = null;
  try { cached = await store.get("latest", { type: "json", consistency: "strong" }); } catch {}
  if (!cached || !cached.items || !cached.items.length || (now - (cached.fetchedAt || 0)) > 20 * 60 * 1000) {
    const items = await aggregate();
    cached = { items, fetchedAt: now, sources: [...new Set(items.map(i => i.source))] };
    try { await store.setJSON("latest", cached); } catch {}
  }
  return new Response(JSON.stringify({ items: cached.items.slice(0, 36), fetchedAt: cached.fetchedAt, sources: cached.sources || [] }), {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=0, s-maxage=300" }
  });
};
