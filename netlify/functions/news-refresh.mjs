// Background pipeline: runs on a schedule, refreshes the AI-news cache in Blobs
// so the site always serves recent news without waiting on a live fetch.
import { getStore } from "@netlify/blobs";
import { aggregate } from "./news.mjs";
import { fetchPapers } from "./papers.mjs";

export default async () => {
  const now = Date.now();
  const [news, papers] = await Promise.all([aggregate(), fetchPapers().catch(() => [])]);
  await getStore("news").setJSON("latest", { items: news, fetchedAt: now });
  if (papers.length) await getStore("papers").setJSON("latest", { items: papers, fetchedAt: now });
  return new Response(`refreshed ${news.length} news, ${papers.length} papers`);
};

// every 30 minutes (UTC). Netlify invokes this automatically.
export const config = { schedule: "*/30 * * * *" };
