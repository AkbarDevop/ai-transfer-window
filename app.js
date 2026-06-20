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
  if (t.gh) return `https://github.com/${t.gh}.png?size=160`;
  return null;
}
function avatar(t, cls) {
  const url = photoUrl(t);
  if (url) return `<span class="${cls} has-photo" style="background:${avColor(t)};background-image:url(${esc(url)});background-size:cover;background-position:center top"></span>`;
  if (t.wiki) return `<span class="${cls}" data-wiki="${esc(t.wiki)}"${t.x ? ` data-x="${esc(t.x)}"` : ""} style="background:${avColor(t)}">${initials(t.name)}</span>`;
  if (t.x) return `<span class="${cls} has-photo" style="background:${avColor(t)};background-image:url(${xAvatar(t.x)});background-size:cover;background-position:center top"></span>`;
  return `<span class="${cls}" style="background:${avColor(t)}">${initials(t.name)}</span>`;
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
async function getPhoto(wiki) {
  if (!wiki) return null;
  if (wiki in PHOTOS) return PHOTOS[wiki];
  try {
    const r = await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(wiki));
    if (!r.ok) return (PHOTOS[wiki] = null);
    const j = await r.json();
    return (PHOTOS[wiki] = (j.thumbnail && j.thumbnail.source) || null);
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
    el.style.backgroundPosition = "center top";
    el.classList.add("has-photo");
    if (el.classList.contains("photo")) el.classList.remove("mono");
    else el.textContent = ""; // hide initials on avatar chips
  });
}

/* ---------- Spotlight ---------- */
function renderSpotlight() {
  const top = TRANSFERS.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const card = (t, lead) => {
    const verb = t.rumored ? "linked with" : "joins";
    const kicker = t.rumored ? "Rumour" : ((t.role || "Transfer") + " · Official");
    const sub = `From ${labName(t.from)}${t.fee ? " · " + esc(t.fee) : ""}`;
    const url = photoUrl(t);
    const photo = url
      ? `<div class="photo has-photo" style="background-image:url(${esc(url)});background-size:cover;background-position:center top"></div>`
      : t.wiki
        ? `<div class="photo" data-wiki="${esc(t.wiki)}"${t.x ? ` data-x="${esc(t.x)}"` : ""}></div>`
        : t.x
          ? `<div class="photo has-photo" style="background-image:url(${xAvatar(t.x)});background-size:cover;background-position:center top"></div>`
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
async function renderNews() {
  const box = document.getElementById("newsTicker");
  let items = [], fetchedAt = null;
  try {
    const r = await fetch("/api/news");
    if (r.ok) { const d = await r.json(); items = d.items || d; fetchedAt = d.fetchedAt; }
  } catch { /* offline */ }
  if (!Array.isArray(items) || !items.length) {
    box.innerHTML = `<div class="loading">News ticker is live once deployed (auto-refreshed from Hacker News + Reddit every 30 min).</div>`;
    return;
  }
  const liveEl = document.querySelector("#news .live");
  if (liveEl && fetchedAt) liveEl.textContent = `updated ${timeAgo(new Date(fetchedAt).toISOString())} ago · live`;

  const cols = [[], [], []];
  items.slice(0, 24).forEach((n, i) => cols[i % 3].push(n));
  box.innerHTML = cols.map(col => `<div>${col.map(n => {
    let host = n.source || ""; if (!host) { try { host = new URL(n.url).hostname.replace(/^www\./, ""); } catch {} }
    return `<div class="tick">
      <span class="when">${timeAgo(n.date)}</span>
      <span class="body">
        <a class="t" href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a>
        <span class="src">${esc(host)} · <span class="pts">▲ ${n.points}</span> · ${n.comments || 0} comments</span>
      </span>
    </div>`;
  }).join("")}</div>`).join("");
}

/* ---------- arXiv papers ---------- */
async function renderPapers() {
  const box = document.getElementById("papers");
  if (!box) return;
  let items = [];
  try { const r = await fetch("/api/papers"); if (r.ok) { const d = await r.json(); items = d.items || d; } } catch {}
  if (!Array.isArray(items) || !items.length) {
    box.innerHTML = `<div class="loading">Recent arXiv papers load once deployed (cs.LG / cs.CL / cs.AI).</div>`;
    return;
  }
  box.innerHTML = items.slice(0, 8).map(p => {
    const authors = (p.authors || []).join(", ") + (p.moreAuthors ? ` +${p.moreAuthors}` : "");
    return `<a class="paper" href="${esc(p.url)}" target="_blank" rel="noopener">
      <div class="paper-t">${esc(p.title)}</div>
      <div class="paper-a">${esc(authors)}</div>
      <div class="paper-d">${timeAgo(p.date)} ago · arXiv</div>
    </a>`;
  }).join("");
}

/* ---------- mini lists (tri-column) ---------- */
function miniRow(t, mode) {
  const feeCls = t.rumored ? "rumor" : "has";
  let right;
  if (mode === "deals") right = `<div class="mfee has">${esc(t.fee || "—")}</div>`;
  else if (mode === "rumours") right = `<div class="mfee rumor">RUMOUR</div><div class="mdate">${fmtDate(t.date)}</div>`;
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
  const fill = (id, list, mode) =>
    document.getElementById(id).innerHTML = list.length ? list.map(t => miniRow(t, mode)).join("") : `<div class="empty">Nothing here yet.</div>`;
  fill("lastTransfers", last, "last");
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
    return `<tr><td>${crest(r.id)}</td><td class="num">${r.in}</td><td class="num">${r.out}</td><td class="num net ${cls}">${r.net > 0 ? "+" : ""}${r.net}</td></tr>`;
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
      // backfill photo sources from researcher links: x is the wiki-fails fallback; gh only when no primary source
      const r = researchers[slugify(t.name)];
      if (r && r.links) {
        if (!t.x && r.links.x) t.x = r.links.x;
        if (!t.photo && !t.gh && !t.wiki && r.links.github) t.gh = r.links.github;
      }
      return t;
    });

    renderSpotlight();
    renderMinis();
    renderFilters();
    renderTransfers();
    renderStandings();
    wireSearch();
    renderNews();
    renderPapers();
  } catch (e) {
    console.error(e);
    document.getElementById("transferTable").innerHTML =
      `<tbody><tr><td style="padding:20px;color:#6b7686">Could not load data. Serve over HTTP.</td></tr></tbody>`;
  }
}
boot();
