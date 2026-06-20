// Latest AI research papers from the arXiv API (no key). Parsed from Atom XML.
import { getStore } from "@netlify/blobs";

export async function fetchPapers() {
  const url = "https://export.arxiv.org/api/query?search_query=cat:cs.LG+OR+cat:cs.CL+OR+cat:cs.AI&sortBy=submittedDate&sortOrder=descending&max_results=14";
  const r = await fetch(url, { headers: { "user-agent": "ai-transfer-window/1.0" } });
  if (!r.ok) return [];
  const xml = await r.text();
  const blocks = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];
  return blocks.map(m => {
    const b = m[1];
    const get = tag => { const mm = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)); return mm ? mm[1].trim().replace(/\s+/g, " ") : ""; };
    const id = (b.match(/<id>([\s\S]*?)<\/id>/) || [])[1] || "";
    const authors = [...b.matchAll(/<name>([\s\S]*?)<\/name>/g)].map(a => a[1].trim());
    return {
      title: get("title"),
      url: id.trim(),
      date: get("published"),
      authors: authors.slice(0, 4),
      moreAuthors: Math.max(0, authors.length - 4),
      summary: get("summary").slice(0, 240)
    };
  }).filter(p => p.title).slice(0, 10);
}

export default async () => {
  const store = getStore("papers");
  const now = Date.now();
  let cached = null;
  try { cached = await store.get("latest", { type: "json", consistency: "strong" }); } catch {}
  if (!cached || !cached.items || !cached.items.length || (now - (cached.fetchedAt || 0)) > 60 * 60 * 1000) {
    const items = await fetchPapers();
    cached = { items, fetchedAt: now };
    try { await store.setJSON("latest", cached); } catch {}
  }
  return new Response(JSON.stringify(cached), {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=0, s-maxage=900" }
  });
};
