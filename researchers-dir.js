// ===== Researchers directory (Metis-style) =====
const X_HANDLE = "mendurmen";
document.getElementById("navX").href = `https://x.com/${X_HANDLE}`;

const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const initials = n => n.split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
const faviconUrl = d => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64`;
const xAvatar = x => `https://unavatar.io/x/${x}?fallback=false`;

let LABS = {}, PEOPLE = [], activeFilter = "all", q = "", sortKey = "value";
const PHOTOS = {};

// transparent influence estimate (Transfermarkt-style "market value")
function influence(role, knownFor, moves, cites) {
  const base = { "Leadership": 86, "Research": 70, "AI Safety": 68, "Safety": 68, "Engineering": 56, "Product": 62 }[role] || 64;
  let v = base; const kf = (knownFor || "").toLowerCase();
  if (/found/.test(kf)) v += 11;
  if (/nobel|transformer|alphafold|chatgpt|gpt|alexnet|pytorch|sora/.test(kf)) v += 8;
  v += Math.min(10, (moves || 1) * 3.5);
  if (cites) v += Math.min(22, Math.log10(cites + 1) * 4.2); // real academic impact
  return Math.min(99, Math.round(v));
}
const marketValue = s => Math.round(s * 2.4);
const fmtCites = c => c >= 1000 ? (c / 1000).toFixed(c >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k" : "" + c;
const SORTS = [["value", "Most valuable"], ["cites", "Most cited"], ["recent", "Most recent move"], ["name", "A–Z"]];
async function getScholar(name) {
  try {
    const r = await fetch(`https://api.openalex.org/authors?search=${encodeURIComponent(name)}&per-page=1&mailto=k.akbarme@gmail.com`);
    if (!r.ok) return null;
    const a = ((await r.json()).results || [])[0];
    return a && a.cited_by_count ? a.cited_by_count : null;
  } catch { return null; }
}

function crestBadge(labId) {
  const lab = LABS[labId] || { short: "?", color: "#888", name: labId };
  let inner;
  if (lab.logo) inner = `<span class="crest-logo" style="background:${lab.color};-webkit-mask-image:url(${lab.logo});mask-image:url(${lab.logo})"></span>`;
  else if (lab.favicon) inner = `<img class="crest-img" src="${faviconUrl(lab.favicon)}" alt="" loading="lazy">`;
  else inner = `<span class="crest-mono" style="color:${lab.color}">${lab.short}</span>`;
  return `<span class="crest-badge" title="${esc(lab.name)}">${inner}</span>`;
}
function avColor(labId) { const c = (LABS[labId] || {}).color || "#16233c"; return /^#0a0a0a$/i.test(c) ? "#16233c" : c; }

const hiRes = u => u ? u.replace(/\/\d+px-/, "/500px-") : u;
async function getPhoto(wiki) {
  if (!wiki || wiki in PHOTOS) return PHOTOS[wiki];
  try { const r = await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(wiki)); if (r.ok) { const j = await r.json(); return PHOTOS[wiki] = (j.thumbnail && hiRes(j.thumbnail.source)) || null; } } catch {}
  return PHOTOS[wiki] = null;
}
// onerror fallback chain: try the next candidate URL, finally show initials
window.avErr = function (img) {
  const rest = (img.getAttribute("data-cands") || "").split("|").filter(Boolean);
  if (rest.length) { img.setAttribute("data-cands", rest.slice(1).join("|")); img.src = rest[0]; }
  else { const sp = img.parentElement; sp.textContent = img.getAttribute("data-init") || ""; }
};
function hydrate() {}
// prefer clean square avatars (X / GitHub) over editorial Wikipedia photos (often group shots)
function avatarHtml(p) {
  const col = avColor(p.lab);
  const cands = [];
  if (p.photo) cands.push(esc(p.photo));
  if (p.gh) cands.push("https://github.com/" + esc(p.gh) + ".png?size=240");
  if (p.x) cands.push("https://unavatar.io/x/" + esc(p.x) + "?fallback=false");
  if (p.wikiUrl) cands.push(esc(p.wikiUrl));
  if (!cands.length) return `<span class="ravatar" style="background:${col}">${initials(p.name)}</span>`;
  return `<span class="ravatar" style="background:${col}"><img class="av-img" src="${cands[0]}" data-cands="${cands.slice(1).join("|")}" data-init="${initials(p.name)}" onerror="avErr(this)" alt="" loading="lazy"></span>`;
}

function sorter(a, b) {
  if (sortKey === "value") return b.value - a.value;
  if (sortKey === "cites") return (b.cites || 0) - (a.cites || 0);
  if (sortKey === "name") return a.name.localeCompare(b.name);
  return (b.lastDate || "").localeCompare(a.lastDate || "");
}
function renderSort() {
  document.getElementById("sortbar").innerHTML = `<span class="tb-label">Sort</span>` + SORTS.map(([k, l]) =>
    `<button class="chip dark ${sortKey === k ? "active" : ""}" data-s="${k}">${l}</button>`).join("");
  document.querySelectorAll("#sortbar .chip").forEach(c => c.addEventListener("click", () => { sortKey = c.dataset.s; renderSort(); render(); }));
}
function render() {
  const ql = q.toLowerCase();
  const list = PEOPLE
    .filter(p => activeFilter === "all" || p.lab === activeFilter)
    .filter(p => !ql || (p.name + " " + (p.knownFor || "") + " " + (LABS[p.lab] || {}).name).toLowerCase().includes(ql))
    .slice().sort(sorter);

  document.getElementById("dir").innerHTML = list.map((p, i) => `
    <a class="rcard" href="researcher.html?r=${p.slug}">
      <span class="rrank">${i + 1}</span>
      ${avatarHtml(p)}
      <span class="rinfo">
        <span class="rname">${esc(p.name)}</span>
        <span class="rmeta">${crestBadge(p.lab)} ${esc((LABS[p.lab] || {}).name || p.lab)}${p.role ? ` · ${esc(p.role)}` : ""}</span>
        ${p.knownFor ? `<span class="rknown">${esc(p.knownFor)}</span>` : ""}
      </span>
      <span class="rright">
        <span class="rval" title="Citation-weighted influence value">$${p.mv}m</span>
        ${p.cites != null ? `<span class="rcites"><b>${fmtCites(p.cites)}</b> cites</span>` : ""}
      </span>
    </a>`).join("") || `<div class="empty">No matches.</div>`;
  document.getElementById("count").textContent = `${list.length} researcher${list.length === 1 ? "" : "s"} · value blends role, moves & OpenAlex citations`;
  hydrate();
}

function renderFilters() {
  const used = [...new Set(PEOPLE.map(p => p.lab))].filter(Boolean);
  const chips = [`<button class="chip ${activeFilter === "all" ? "active" : ""}" data-f="all">All</button>`];
  used.forEach(id => chips.push(`<button class="chip ${activeFilter === id ? "active" : ""}" data-f="${esc(id)}">${esc((LABS[id] || {}).short || id)}</button>`));
  const el = document.getElementById("filters");
  el.innerHTML = chips.join("");
  el.querySelectorAll(".chip").forEach(c => c.addEventListener("click", () => { activeFilter = c.dataset.f; renderFilters(); render(); }));
}

(async function () {
  const [labs, seed, researchers, dynamic] = await Promise.all([
    fetch("data/labs.json").then(r => r.json()),
    fetch("data/transfers.json").then(r => r.json()),
    fetch("data/researchers.json").then(r => r.json()),
    fetch("/api/transfers").then(r => (r.ok ? r.json() : [])).catch(() => [])
  ]);
  LABS = labs;
  const all = [...(seed.transfers || seed), ...(Array.isArray(dynamic) ? dynamic : [])];
  // build people from researchers.json, enrich with latest transfer (current lab, photo hints)
  PEOPLE = Object.keys(researchers).filter(k => k !== "_comment").map(slug => {
    const info = researchers[slug];
    const moves = all.filter(t => slugify(t.name) === slug).sort((a, b) => b.date.localeCompare(a.date));
    const latest = moves[0];
    const links = info.links || {};
    const score = influence(info.role, info.knownFor, moves.length);
    return {
      slug, name: info.name, role: info.role, knownFor: info.knownFor, movesN: moves.length,
      lab: latest ? latest.to : null,
      lastDate: latest ? latest.date : "0",
      value: score, mv: marketValue(score), cites: null,
      gh: (latest && latest.gh) || links.github || null,
      photo: latest && latest.photo,
      wiki: (latest && latest.wiki) || (links.wikipedia && !/^https?:/.test(links.wikipedia) ? links.wikipedia : null),
      x: (latest && latest.x) || links.x || null
    };
  }).filter(p => p.lab);
  // pre-resolve Wikipedia thumbnail URLs so they can sit in the onerror fallback chain
  await Promise.all(PEOPLE.map(async p => { if (p.wiki) p.wikiUrl = await getPhoto(p.wiki); }));
  renderFilters(); renderSort(); render();
  // enrich with real OpenAlex citations, then recompute citation-aware value + re-render
  await Promise.all(PEOPLE.map(async p => {
    p.cites = await getScholar(p.name);
    if (p.cites != null) { p.value = influence(p.role, p.knownFor, p.movesN, p.cites); p.mv = marketValue(p.value); }
  }));
  render();
  const s = document.getElementById("search");
  if (s) s.addEventListener("input", () => { q = s.value.trim(); render(); });
})();
