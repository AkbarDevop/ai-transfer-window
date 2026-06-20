// Background pipeline: runs on a schedule, refreshes the AI-news cache in Blobs
// so the site always serves recent news without waiting on a live fetch.
import { getStore } from "@netlify/blobs";
import { aggregate } from "./news.mjs";

export default async () => {
  const items = await aggregate();
  const store = getStore("news");
  await store.setJSON("latest", { items, fetchedAt: Date.now() });
  return new Response(`refreshed ${items.length} items`);
};

// every 30 minutes (UTC). Netlify invokes this automatically.
export const config = { schedule: "*/30 * * * *" };
