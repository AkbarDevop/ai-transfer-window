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

function crestBadge(labId) {
  const lab = LABS[labId] || { short: "?", color: "#888", logo: null, name: labId };
  const inner = lab.logo
    ? `<span class="crest-logo" style="background:${lab.color};-webkit-mask-image:url(${lab.logo});mask-image:url(${lab.logo})"></span>`
    : `<span class="crest-mono" style="color:${lab.color}">${lab.short}</span>`;
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
function photoUrl(t) {
  if (t.photo) return t.photo;
  if (t.gh) return `https://github.com/${t.gh}.png?size=160`;
  return null;
}
function avatar(t, cls) {
  const url = photoUrl(t);
  if (url) {
    return `<span class="${cls} has-photo" style="background:${avColor(t)};background-image:url(${esc(url)});background-size:cover;background-position:center top"></span>`;
  }
  if (t.wiki) {
    return `<span class="${cls}" data-wiki="${esc(t.wiki)}" style="background:${avColor(t)}">${initials(t.name)}</span>`;
  }
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
    const url = await getPhoto(wiki);
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
        ? `<div class="photo" data-wiki="${esc(t.wiki)}"></div>`
        : `<div class="photo mono" style="background:${avColor(t)}">${initials(t.name)}</div>`;
    return `<article class="spot ${lead ? "lead" : ""}">
      ${photo}<div class="scrim"></div>
      <div class="meta">
        <div class="kicker">${esc(kicker)}</div>
        <div class="headline">${esc(t.name)} ${verb} ${esc(labName(t.to))}</div>
        <div class="sub">${sub}</div>
      </div>
      <a class="cover" href="${shareLink(t)}" target="_blank" rel="noopener" title="Share on X"></a>
    </article>`;
  };
  document.getElementById("spotlightGrid").innerHTML =
    top.map((t, i) => card(t, i === 0)).join("");
  hydratePhotos();
}

/* ---------- News ticker ---------- */
async function renderNews() {
  const box = document.getElementById("newsTicker");
  let items = [];
  try {
    const r = await fetch("/api/news");
    if (r.ok) items = await r.json();
  } catch { /* offline */ }
  if (!Array.isArray(items) || !items.length) {
    box.innerHTML = `<div class="loading">News ticker is live once deployed (pulls AI lab headlines from Hacker News).</div>`;
    return;
  }
  const cols = [[], [], []];
  items.slice(0, 18).forEach((n, i) => cols[i % 3].push(n));
  box.innerHTML = cols.map(col => `<div>${col.map(n => {
    let host = ""; try { host = new URL(n.url).hostname.replace(/^www\./, ""); } catch {}
    return `<div class="tick">
      <span class="when">${timeAgo(n.date)}</span>
      <span class="body">
        <a class="t" href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a>
        <span class="src">${esc(host)} · <span class="pts">▲ ${n.points}</span> · ${n.comments} comments</span>
      </span>
    </div>`;
  }).join("")}</div>`).join("");
}

/* ---------- mini lists (tri-column) ---------- */
function miniRow(t, mode) {
  const feeCls = t.rumored ? "rumor" : "has";
  let right;
  if (mode === "deals") right = `<div class="mfee has">${esc(t.fee || "—")}</div>`;
  else if (mode === "rumours") right = `<div class="mfee rumor">RUMOUR</div><div class="mdate">${fmtDate(t.date)}</div>`;
  else right = `<div class="mdate">${fmtDate(t.date)}</div>${t.fee ? `<div class="mfee ${feeCls}">${esc(t.fee)}</div>` : ""}`;
  return `<div class="mini">
    ${avatar(t, "av")}
    <div class="info">
      <div class="mname">${esc(t.name)}</div>
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

  const rows = list.map((t, i) => {
    const roleTag = t.rumored ? `<span class="tag rumor">Rumored</span>` : (t.role ? `<span class="tag">${esc(t.role)}</span>` : "");
    const feeCls = t.fee ? (t.rumored ? "rumor" : "has") : "none";
    return `<tr title="${esc(t.note)}">
      <td class="rank">${i + 1}</td>
      <td><div class="player">${avatar(t, "avatar")}<span>
        <span class="pname">${esc(t.name)}</span>
        ${t.title ? `<span class="ptitle">${esc(t.title)}</span>` : ""}
      </span></div></td>
      <td>${crest(t.from)}</td>
      <td>${crest(t.to)}</td>
      <td>${roleTag}</td>
      <td class="date">${fmtDate(t.date)}</td>
      <td class="right"><span class="fee ${feeCls}">${t.fee ? esc(t.fee) : "—"}</span></td>
      <td class="right"><a class="share" href="${shareLink(t)}" target="_blank" rel="noopener" title="Share on X">↗</a></td>
    </tr>`;
  }).join("");

  document.getElementById("transferTable").innerHTML =
    `<thead><tr><th class="rank">#</th><th>Researcher</th><th>From</th><th>To</th><th>Role</th><th>Date</th><th class="right">Fee</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="8" class="empty">No matches.</td></tr>`}</tbody>`;
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
    const [labs, seed, dynamic] = await Promise.all([
      fetch("data/labs.json").then(r => r.json()),
      fetch("data/transfers.json").then(r => r.json()),
      fetch("/api/transfers").then(r => (r.ok ? r.json() : [])).catch(() => [])
    ]);
    LABS = labs;
    const byId = new Map();
    [...(seed.transfers || seed), ...(Array.isArray(dynamic) ? dynamic : [])].forEach(t => byId.set(t.id, t));
    TRANSFERS = [...byId.values()];

    renderSpotlight();
    renderMinis();
    renderFilters();
    renderTransfers();
    renderStandings();
    wireSearch();
    renderNews();
  } catch (e) {
    console.error(e);
    document.getElementById("transferTable").innerHTML =
      `<tbody><tr><td style="padding:20px;color:#6b7686">Could not load data. Serve over HTTP.</td></tr></tbody>`;
  }
}
boot();
