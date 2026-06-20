# AI Transfer Window ⚡

The transfer market for **AI researchers**. A soccer-style tracker of named moves between the frontier labs — OpenAI, Anthropic, Google DeepMind, Meta, xAI, Thinking Machines Lab, and the rest.

Built as a content engine for X: every new signing is a post, the site is the linkable home.

## Why
The AI talent war is constant and newsworthy (John Jumper, Karpathy, the Thinking Machines Lab carousel…), but coverage is scattered across tech press. This is one structured place to see who went where — with "standings" for net talent flow per lab.

## Run locally
No build step. Just serve the folder over HTTP:
```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Add a transfer
Edit `data/transfers.json` — append an entry to the `transfers` array:
```json
{
  "id": "unique-slug",
  "name": "Researcher Name",
  "title": "short descriptor",
  "from": "openai",          // lab id from data/labs.json
  "to": "anthropic",
  "date": "2026-06-19",      // YYYY-MM-DD, drives sort + standings
  "role": "Research",        // Research | Engineering | Safety | ...
  "note": "context, one or two sentences",
  "fee": "~$1.5B / 6yr (disputed)",  // or null
  "rumored": false,          // true => disputed/unconfirmed badge
  "sources": ["https://..."]
}
```
**Rule: every row should be defensible with a real source link.** Accuracy is the whole moat.

## Add a lab
Edit `data/labs.json` — `id: { name, short, color }`. The `short` is the crest text, `color` drives its badge.

## Config
Your X handle lives at the top of `app.js` (`X_HANDLE`). All "Follow" / "Share" CTAs point there.

## Deploy
Netlify (never Vercel):
```bash
netlify deploy --prod --dir .
```

---
Curated, not automated. Not affiliated with any lab. Comp figures are reported/rumored where labeled.
