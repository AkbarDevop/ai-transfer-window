// ===== Researchers directory (Metis-style) =====
const X_HANDLE = "mendurmen";
document.getElementById("navX").href = `https://x.com/${X_HANDLE}`;

const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const initials = n => n.split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
const faviconUrl = d => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64`;
const xAvatar = x => `https://unavatar.io/x/${x}?fallback=false`;

let LABS = {}, PEOPLE = [], activeFilter = "all", q = "";
const PHOTOS = {};

function crestBadge(labId) {
  const lab = LABS[labId] || { short: "?", color: "#888", name: labId };
  let inner;
  if (lab.logo) inner = `<span class="crest-logo" style="background:${lab.color};-webkit-mask-image:url(${lab.logo});mask-image:url(${lab.logo})"></span>`;
  else if (lab.favicon) inner = `<img class="crest-img" src="${faviconUrl(lab.favicon)}" alt="" loading="lazy">`;
  else inner = `<span class="crest-mono" style="color:${lab.color}">${lab.short}</span>`;
  return `<span class="crest-badge" title="${esc(lab.name)}">${inner}</span>`;
}
function avColor(labId) { const c = (LABS[labId] || {}).color || "#16233c"; return /^#0a0a0a$/i.test(c) ? "#16233c" : c; }

async function getPhoto(wiki) {
  if (!wiki || wiki in PHOTOS) return PHOTOS[wiki];
  try { const r = await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(wiki)); if (r.ok) { const j = await r.json(); return PHOTOS[wiki] = (j.thumbnail && j.thumbnail.source) || null; } } catch {}
  return PHOTOS[wiki] = null;
}
function hydrate() {
  document.querySelectorAll(".ravatar[data-wiki]").forEach(async el => {
    if (el.dataset.done) return; el.dataset.done = "1";
    let url = await getPhoto(el.getAttribute("data-wiki"));
    if (!url) { const x = el.getAttribute("data-x"); if (x) url = xAvatar(x); }
    if (!url) return;
    el.style.backgroundImage = `url(${url})`; el.textContent = "";
  });
}

// photo: direct (gh) sync, else wiki/x async via data-*
function avatarHtml(p) {
  const col = avColor(p.lab);
  if (p.photo) return `<span class="ravatar" style="background:${col};background-image:url(${esc(p.photo)})"></span>`;
  if (p.gh) return `<span class="ravatar" style="background:${col};background-image:url(https://github.com/${esc(p.gh)}.png?size=200)"></span>`;
  if (p.wiki) return `<span class="ravatar" data-wiki="${esc(p.wiki)}"${p.x ? ` data-x="${esc(p.x)}"` : ""} style="background:${col}">${initials(p.name)}</span>`;
  if (p.x) return `<span class="ravatar" style="background:${col};background-image:url(${xAvatar(p.x)})"></span>`;
  return `<span class="ravatar" style="background:${col}">${initials(p.name)}</span>`;
}

function render() {
  const ql = q.toLowerCase();
  const list = PEOPLE
    .filter(p => activeFilter === "all" || p.lab === activeFilter)
    .filter(p => !ql || (p.name + " " + (p.knownFor || "") + " " + (LABS[p.lab] || {}).name).toLowerCase().includes(ql))
    .slice().sort((a, b) => (b.lastDate || "").localeCompare(a.lastDate || ""));

  document.getElementById("dir").innerHTML = list.map((p, i) => `
    <a class="rcard" href="researcher.html?r=${p.slug}">
      <span class="rrank">${i + 1}</span>
      ${avatarHtml(p)}
      <span class="rinfo">
        <span class="rname">${esc(p.name)}</span>
        <span class="rmeta">${crestBadge(p.lab)} ${esc((LABS[p.lab] || {}).name || p.lab)}${p.role ? ` · ${esc(p.role)}` : ""}</span>
        ${p.knownFor ? `<span class="rknown">${esc(p.knownFor)}</span>` : ""}
      </span>
    </a>`).join("") || `<div class="empty">No matches.</div>`;
  document.getElementById("count").textContent = `${list.length} researcher${list.length === 1 ? "" : "s"} tracked`;
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
    return {
      slug, name: info.name, role: info.role, knownFor: info.knownFor,
      lab: latest ? latest.to : null,
      lastDate: latest ? latest.date : "0",
      gh: (latest && latest.gh) || links.github || null,
      photo: latest && latest.photo,
      wiki: (latest && latest.wiki) || (links.wikipedia && !/^https?:/.test(links.wikipedia) ? links.wikipedia : null),
      x: (latest && latest.x) || links.x || null
    };
  }).filter(p => p.lab);
  renderFilters(); render();
  const s = document.getElementById("search");
  if (s) s.addEventListener("input", () => { q = s.value.trim(); render(); });
})();
