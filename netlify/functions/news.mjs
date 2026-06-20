// Live AI-lab news, server-side (no CORS issues), from the Hacker News Algolia API (no key).
const TERMS = ["OpenAI", "Anthropic", "DeepMind", "xAI", "Mistral", "AI researcher", "frontier model"];
// keep only headlines that are actually about AI / the labs / the people
const RELEVANT = /\b(AI|A\.I\.|artificial intelligence|model|models|LLM|GPT|Claude|Gemini|Llama|Grok|OpenAI|Anthropic|DeepMind|xAI|Mistral|Meta|researcher|research|neural|machine learning|AGI|superintelligence|training|inference|chatbot|hire|hired|joins|poach)\b/i;

export default async () => {
  const seen = new Set();
  const out = [];

  await Promise.all(TERMS.map(async (term) => {
    try {
      const r = await fetch(
        `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(term)}&tags=story&hitsPerPage=15`,
        { headers: { "user-agent": "ai-transfer-window/1.0" } }
      );
      if (!r.ok) return;
      const j = await r.json();
      for (const h of j.hits || []) {
        if (!h.title || !h.objectID || seen.has(h.objectID)) continue;
        if (!RELEVANT.test(h.title)) continue; // drop off-topic matches
        // keep stories with real traction
        if ((h.points || 0) < 8 && (h.num_comments || 0) < 4) continue;
        seen.add(h.objectID);
        out.push({
          title: h.title,
          url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
          hn: `https://news.ycombinator.com/item?id=${h.objectID}`,
          points: h.points || 0,
          comments: h.num_comments || 0,
          author: h.author || "",
          date: h.created_at,
          term
        });
      }
    } catch { /* ignore one bad term */ }
  }));

  out.sort((a, b) => new Date(b.date) - new Date(a.date));

  return new Response(JSON.stringify(out.slice(0, 20)), {
    headers: {
      "content-type": "application/json",
      // edge-cache 5 min so we don't hammer HN, still fresh enough for a news ticker
      "cache-control": "public, max-age=0, s-maxage=300"
    }
  });
};
