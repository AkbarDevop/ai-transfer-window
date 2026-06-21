// ===== AI Transfer Window — Transfermarkt-style homepage =====
const X_HANDLE = "mendurmen";

(function wireX() {
  const p = `https://x.com/${X_HANDLE}`;
  ["navX", "sideX", "footX"].forEach(id => { const el = document.getElementById(id); if (el) el.href = p; });
})();

let LABS = {};
let TRANSFERS = [];
let activeFilter = "all";
let searchQuery = "";
const PHOTOS = {}; // wiki title -> url | null (cache)

const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const profileLink = t => `researcher.html?r=${slugify(t.name)}`;
const initials = n => n.split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
const fmtDate = iso => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
const esc = s => String(s == null ? "" : s).replace(/"/g, "&quot;").replace(/</g, "&lt;");
const labName = id => (LABS[id] || {}).name || id;

function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return Math.max(1, Math.round(s / 60)) + "m";
  if (s < 86400) return Math.round(s / 3600) + "h";
  return Math.round(s / 86400) + "d";
}

function faviconUrl(domain) { return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`; }
function crestBadge(labId) {
  const lab = LABS[labId] || { short: "?", color: "#888", logo: null, name: labId };
  let inner;
  if (lab.logo) inner = `<span class="crest-logo" style="background:${lab.color};-webkit-mask-image:url(${lab.logo});mask-image:url(${lab.logo})"></span>`;
  else if (lab.favicon) inner = `<img class="crest-img" src="${faviconUrl(lab.favicon)}" alt="" loading="lazy">`;
  else inner = `<span class="crest-mono" style="color:${lab.color}">${lab.short}</span>`;
  return `<span class="crest-badge" title="${esc(lab.name)}">${inner}</span>`;
}
function crest(labId) {
  return `<span class="crest">${crestBadge(labId)}<span class="crest-name">${esc(labName(labId))}</span></span>`;
}
function avColor(t) {
  const c = (LABS[t.to] || {}).color || "#16233c";
  return /^#0a0a0a$/i.test(c) ? "#16233c" : c;
}
// resolve a synchronous photo URL (direct url or GitHub avatar); wiki is async
const xAvatar = x => `https://unavatar.io/x/${x}?fallback=false`;
// synchronous sources only (direct photo / github). wiki + x are resolved async (wiki preferred).
function photoUrl(t) {
  if (t.photo) return t.photo;
  if (t.gh) return `https://github.com/${t.gh}.png?size=240`;
  return null;
}
// onerror fallback chain: advance to next candidate, finally show initials
window.avErr = function (img) {
  const rest = (img.getAttribute("data-cands") || "").split("|").filter(Boolean);
  if (rest.length) { img.setAttribute("data-cands", rest.slice(1).join("|")); img.src = rest[0]; }
  else { img.parentElement.textContent = img.getAttribute("data-init") || ""; }
};
// prefer clean square avatars (direct photo / X / GitHub) over editorial Wikipedia photos
function avatarCands(t) {
  const c = [];
  if (t.photo) c.push(esc(t.photo));
  if (t.gh) c.push("https://github.com/" + esc(t.gh) + ".png?size=240");
  if (t.x) c.push(xAvatar(t.x));
  if (t.wikiUrl) c.push(esc(t.wikiUrl));
  return c;
}
function avatar(t, cls) {
  const col = avColor(t), cands = avatarCands(t);
  if (!cands.length) return `<span class="${cls}" style="background:${col}">${initials(t.name)}</span>`;
  return `<span class="${cls}" style="background:${col}"><img class="av-img" src="${cands[0]}" data-cands="${cands.slice(1).join("|")}" data-init="${initials(t.name)}" onerror="avErr(this)" alt="" loading="lazy"></span>`;
}
function shareLink(t) {
  const tag = t.rumored ? "🔮 RUMOR" : "🔁";
  const text = `${tag} ${t.name}: ${labName(t.from)} → ${labName(t.to)}\n\nTracked on the AI Transfer Window`;
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(location.origin + "/")}`;
}
function feeAmount(t) {
  if (!t.fee) return -1;
  const m = String(t.fee).match(/([\d.]+)\s*([bm])/i);
  if (!m) return 0;
  return parseFloat(m[1]) * (/b/i.test(m[2]) ? 1000 : 1);
}

/* ---------- Wikipedia photos ---------- */
// upscale Wikipedia thumbnail URLs (…/330px-Name.jpg → …/500px-…) for crisp avatars
const hiRes = u => u ? u.replace(/\/\d+px-/, "/500px-") : u;
async function getPhoto(wiki) {
  if (!wiki) return null;
  if (wiki in PHOTOS) return PHOTOS[wiki];
  try {
    const r = await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(wiki));
    if (!r.ok) return (PHOTOS[wiki] = null);
    const j = await r.json();
    return (PHOTOS[wiki] = (j.thumbnail && hiRes(j.thumbnail.source)) || null);
  } catch { return (PHOTOS[wiki] = null); }
}
function hydratePhotos() {
  document.querySelectorAll("[data-wiki]").forEach(async el => {
    const wiki = el.getAttribute("data-wiki");
    if (!wiki || el.dataset.done) return;
    el.dataset.done = "1";
    let url = await getPhoto(wiki);
    if (!url) { const x = el.getAttribute("data-x"); if (x) url = xAvatar(x); }
    if (!url) return;
    el.style.backgroundImage = `url(${url})`;
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
    el.classList.add("has-photo");
    if (el.classList.contains("photo")) el.classList.remove("mono");
    else el.textContent = ""; // hide initials on avatar chips
  });
}

/* ---------- Spotlight ---------- */
function renderSpotlight() {
  const top = TRANSFERS.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const card = (t, lead) => {
    const verb = t.rumored ? "linked with" : "joins";
    const kicker = t.rumored ? "Rumour" : ((t.role || "Transfer") + " · Official");
    const sub = `From ${labName(t.from)}${t.fee ? " · " + esc(t.fee) : ""}`;
    const cands = avatarCands(t);
    const photo = cands.length
      ? `<div class="photo"><img class="av-img" src="${cands[0]}" data-cands="${cands.slice(1).join("|")}" data-init="${initials(t.name)}" onerror="avErr(this)" alt=""></div>`
      : `<div class="photo mono" style="background:${avColor(t)}">${initials(t.name)}</div>`;
    return `<article class="spot ${lead ? "lead" : ""}">
      ${photo}<div class="scrim"></div>
      <div class="meta">
        <div class="kicker">${esc(kicker)}</div>
        <div class="headline">${esc(t.name)} ${verb} ${esc(labName(t.to))}</div>
        <div class="sub">${sub}</div>
      </div>
      <a class="cover" href="${profileLink(t)}" title="View ${esc(t.name)}'s profile"></a>
    </article>`;
  };
  document.getElementById("spotlightGrid").innerHTML =
    top.map((t, i) => card(t, i === 0)).join("");
  hydratePhotos();
}

/* ---------- News ticker ---------- */
let NEWS = [], newsExpanded = false;
function paintNews() {
  const box = document.getElementById("newsTicker");
  const list = (newsExpanded ? NEWS.slice(0, 30) : NEWS.slice(0, 9));
  const cols = [[], [], []];
  list.forEach((n, i) => cols[i % 3].push(n));
  box.innerHTML = cols.map(col => `<div>${col.map(n => {
    let host = n.source || ""; if (!host) { try { host = new URL(n.url).hostname.replace(/^www\./, ""); } catch {} }
    const pts = n.points ? ` · <span class="pts">▲ ${n.points}</span>` : "";
    return `<div class="tick">
      <span class="when">${timeAgo(n.date)}</span>
      <span class="body">
        <a class="t" href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a>
        <span class="src">${esc(host)}${pts}</span>
      </span>
    </div>`;
  }).join("")}</div>`).join("");
}
async function renderNews() {
  let fetchedAt = null;
  try {
    const r = await fetch("/api/news");
    if (r.ok) { const d = await r.json(); NEWS = d.items || d; fetchedAt = d.fetchedAt; }
  } catch { /* offline */ }
  if (!Array.isArray(NEWS) || !NEWS.length) {
    document.getElementById("newsTicker").innerHTML = `<div class="loading">News loads once deployed (auto-refreshed every 30 min from Hacker News, Google News, TechCrunch and more).</div>`;
    return;
  }
  const upd = document.getElementById("newsUpd");
  if (upd && fetchedAt) upd.textContent = `· updated ${timeAgo(new Date(fetchedAt).toISOString())} ago`;
  const btn = document.getElementById("newsMore");
  if (btn) { btn.hidden = NEWS.length <= 9; btn.onclick = () => { newsExpanded = !newsExpanded; btn.textContent = newsExpanded ? "Show less" : `Show more news (${NEWS.length})`; paintNews(); }; btn.textContent = `Show more news (${NEWS.length})`; }
  paintNews();
}

/* ---------- arXiv papers ---------- */
let PAPERS = [], papersExpanded = false;
function paintPapers() {
  const box = document.getElementById("papers");
  const list = papersExpanded ? PAPERS.slice(0, 8) : PAPERS.slice(0, 4);
  box.innerHTML = list.map(p => {
    const authors = (p.authors || []).join(", ") + (p.moreAuthors ? ` +${p.moreAuthors}` : "");
    return `<a class="paper" href="${esc(p.url)}" target="_blank" rel="noopener">
      <div class="paper-t">${esc(p.title)}</div>
      <div class="paper-a">${esc(authors)}</div>
      <div class="paper-d">${timeAgo(p.date)} ago · arXiv</div>
    </a>`;
  }).join("");
}
async function renderPapers() {
  const box = document.getElementById("papers");
  if (!box) return;
  try { const r = await fetch("/api/papers"); if (r.ok) { const d = await r.json(); PAPERS = d.items || d; } } catch {}
  if (!Array.isArray(PAPERS) || !PAPERS.length) {
    box.innerHTML = `<div class="loading">Recent arXiv papers load once deployed (cs.LG / cs.CL / cs.AI).</div>`;
    return;
  }
  const btn = document.getElementById("papersMore");
  if (btn) { btn.hidden = PAPERS.length <= 4; btn.onclick = () => { papersExpanded = !papersExpanded; btn.textContent = papersExpanded ? "Show less" : "Show more papers"; paintPapers(); }; btn.textContent = "Show more papers"; }
  paintPapers();
}

/* ---------- mini lists (tri-column) ---------- */
function miniRow(t, mode) {
  const feeCls = t.rumored ? "rumor" : "has";
  let right;
  if (mode === "deals") right = `<div class="mfee has">${esc(t.fee || "—")}</div>`;
  else if (mode === "rumours") right = `<div class="mfee rumor">${t.probability ? t.probability + "%" : "RUMOUR"}</div><div class="mdate">${fmtDate(t.date)}</div>`;
  else right = `<div class="mdate">${fmtDate(t.date)}</div>${t.fee ? `<div class="mfee ${feeCls}">${esc(t.fee)}</div>` : ""}`;
  return `<div class="mini">
    <a href="${profileLink(t)}">${avatar(t, "av")}</a>
    <div class="info">
      <a class="mname plink" href="${profileLink(t)}">${esc(t.name)}</a>
      <div class="mmove">${crestBadge(t.from)} <span class="move-arrow">→</span> ${crestBadge(t.to)}</div>
    </div>
    <div class="mright">${right}</div>
  </div>`;
}
function renderMinis() {
  const byDate = TRANSFERS.slice().sort((a, b) => b.date.localeCompare(a.date));
  const last = byDate.filter(t => !t.rumored).slice(0, 6);
  const rumours = byDate.filter(t => t.rumored).slice(0, 6);
  const deals = TRANSFERS.slice().filter(t => feeAmount(t) > 0).sort((a, b) => feeAmount(b) - feeAmount(a)).slice(0, 6);
  const fill = (id, list, mode) => { const el = document.getElementById(id); if (el) el.innerHTML = list.length ? list.map(t => miniRow(t, mode)).join("") : `<div class="empty">Nothing here yet.</div>`; };
  fill("topRumours", rumours, "rumours");
  fill("biggestDeals", deals, "deals");
  hydratePhotos();
}

/* ---------- full table ---------- */
function renderTransfers() {
  const q = searchQuery.toLowerCase();
  const list = TRANSFERS
    .filter(t => activeFilter === "all" || t.from === activeFilter || t.to === activeFilter)
    .filter(t => !q || (t.name + " " + (t.title || "") + " " + labName(t.from) + " " + labName(t.to)).toLowerCase().includes(q))
    .slice().sort((a, b) => b.date.localeCompare(a.date));

  const rows = list.map((t) => {
    const roleTag = t.rumored ? `<span class="tag rumor">Rumored</span>` : (t.role ? `<span class="tag">${esc(t.role)}</span>` : "");
    const feeCls = t.fee ? (t.rumored ? "rumor" : "has") : "none";
    return `<div class="trow" title="${esc(t.note)}">
      <a class="tr-av" href="${profileLink(t)}">${avatar(t, "avatar")}</a>
      <div class="tr-idy">
        <a class="tr-name plink" href="${profileLink(t)}">${esc(t.name)}</a>
        ${t.title ? `<span class="tr-title">${esc(t.title)}</span>` : ""}
      </div>
      <div class="tr-move" title="${esc(labName(t.from))} → ${esc(labName(t.to))}">${crestBadge(t.from)}<span class="move-arrow">→</span>${crestBadge(t.to)}</div>
      <div class="tr-tags">${roleTag}</div>
      <div class="tr-date">${fmtDate(t.date)}</div>
      <div class="tr-fee"><span class="fee ${feeCls}">${t.fee ? esc(t.fee) : "—"}</span></div>
      <a class="tr-share share" href="${shareLink(t)}" target="_blank" rel="noopener" title="Share on X">↗</a>
    </div>`;
  }).join("");

  document.getElementById("transferTable").innerHTML = rows || `<div class="empty" style="padding:16px 14px">No matches.</div>`;
  document.getElementById("count").textContent =
    `${list.length} transfer${list.length === 1 ? "" : "s"}${activeFilter === "all" ? "" : " · " + labName(activeFilter)}${q ? ` · “${searchQuery}”` : ""}`;
  hydratePhotos();
}

function renderStandings() {
  const rows = {};
  Object.keys(LABS).forEach(id => (rows[id] = { in: 0, out: 0 }));
  TRANSFERS.forEach(t => { if (rows[t.to]) rows[t.to].in++; if (rows[t.from]) rows[t.from].out++; });
  const sorted = Object.entries(rows).map(([id, r]) => ({ id, ...r, net: r.in - r.out }))
    .filter(r => r.in || r.out).sort((a, b) => b.net - a.net || b.in - a.in);
  const body = sorted.map(r => {
    const cls = r.net > 0 ? "pos" : r.net < 0 ? "neg" : "zero";
    return `<tr><td><a class="lab-link" href="lab.html?l=${r.id}">${crest(r.id)}</a></td><td class="num">${r.in}</td><td class="num">${r.out}</td><td class="num net ${cls}">${r.net > 0 ? "+" : ""}${r.net}</td></tr>`;
  }).join("");
  document.getElementById("standings").innerHTML =
    `<thead><tr><th>Lab</th><th class="num">In</th><th class="num">Out</th><th class="num">Net</th></tr></thead><tbody>${body}</tbody>`;
}

function renderFilters() {
  const used = new Set();
  TRANSFERS.forEach(t => { used.add(t.from); used.add(t.to); });
  const chips = [`<button class="chip ${activeFilter === "all" ? "active" : ""}" data-f="all">All</button>`];
  Object.keys(LABS).filter(id => used.has(id)).forEach(id =>
    chips.push(`<button class="chip ${activeFilter === id ? "active" : ""}" data-f="${id}">${esc((LABS[id] || {}).short || id)}</button>`));
  const el = document.getElementById("filters");
  el.innerHTML = chips.join("");
  el.querySelectorAll(".chip").forEach(c =>
    c.addEventListener("click", () => { activeFilter = c.dataset.f; renderFilters(); renderTransfers(); }));
}

function wireSearch() {
  const s = document.getElementById("search");
  if (s) s.addEventListener("input", () => { searchQuery = s.value.trim(); renderTransfers(); });
  document.querySelectorAll(".footer-cols a[data-lab]").forEach(a =>
    a.addEventListener("click", e => {
      e.preventDefault(); activeFilter = a.dataset.lab; renderFilters(); renderTransfers();
      document.getElementById("transfers").scrollIntoView({ behavior: "smooth" });
    }));
}

async function boot() {
  try {
    const [labs, seed, researchers, dynamic] = await Promise.all([
      fetch("data/labs.json").then(r => r.json()),
      fetch("data/transfers.json").then(r => r.json()),
      fetch("data/researchers.json").then(r => r.json()).catch(() => ({})),
      fetch("/api/transfers").then(r => (r.ok ? r.json() : [])).catch(() => [])
    ]);
    LABS = labs;
    const byId = new Map();
    [...(seed.transfers || seed), ...(Array.isArray(dynamic) ? dynamic : [])].forEach(t => byId.set(t.id, t));
    TRANSFERS = [...byId.values()].map(t => {
      // pull photo hints from researcher links (X preferred over editorial Wikipedia photos)
      const r = researchers[slugify(t.name)];
      if (r && r.links) {
        if (!t.x && r.links.x) t.x = r.links.x;
        if (!t.wiki && r.links.wikipedia && !/^https?:/.test(r.links.wikipedia)) t.wiki = r.links.wikipedia;
      }
      return t;
    });
    // pre-resolve Wikipedia thumbnail URLs so they sit in the onerror fallback chain
    await Promise.all(TRANSFERS.map(async t => { if (t.wiki) t.wikiUrl = await getPhoto(t.wiki); }));

    renderSpotlight();
    renderMinis();
    renderFilters();
    renderTransfers();
    renderStandings();
    wireSearch();
    renderNews();
    renderPapers();
    if (new URLSearchParams(location.search).get("subscribed")) {
      const f = document.querySelector(".news-signup"); if (f) f.classList.add("done");
    }
  } catch (e) {
    console.error(e);
    document.getElementById("transferTable").innerHTML =
      `<tbody><tr><td style="padding:20px;color:#6b7686">Could not load data. Serve over HTTP.</td></tr></tbody>`;
  }
}
boot();
