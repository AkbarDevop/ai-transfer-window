// ===== Lab page: squad, arrivals, departures, models =====
const X_HANDLE = "mendurmen";
document.getElementById("navX").href = `https://x.com/${X_HANDLE}`;

const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const initials = n => n.split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
const fmtDate = iso => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
const fmtMonth = ym => { const [y, m] = ym.split("-"); return new Date(+y, +m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" }); };
const faviconUrl = d => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64`;
const xAvatar = x => `https://unavatar.io/x/${x}?fallback=false`;

let LABS = {}, RES = {}, PHOTOS = {};

function bigCrest(lab) {
  if (lab.logo) return `<span class="lab-logo" style="background:${lab.color};-webkit-mask-image:url(${lab.logo});mask-image:url(${lab.logo})"></span>`;
  if (lab.favicon) return `<img class="lab-logo-img" src="${faviconUrl(lab.favicon)}" alt="">`;
  return `<span class="lab-logo-mono" style="color:${lab.color}">${lab.short}</span>`;
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
function hydrate() {
  document.querySelectorAll(".av[data-wiki]").forEach(async el => {
    if (el.dataset.done) return; el.dataset.done = "1";
    let url = await getPhoto(el.getAttribute("data-wiki"));
    if (!url) { const x = el.getAttribute("data-x"); if (x) url = xAvatar(x); }
    if (!url) return; el.style.backgroundImage = `url(${url})`; el.textContent = "";
  });
}
function avatarHtml(t) {
  const col = avColor(t.to || t.from);
  if (t.photo) return `<span class="av" style="background:${col};background-image:url(${esc(t.photo)})"></span>`;
  if (t.gh) return `<span class="av" style="background:${col};background-image:url(https://github.com/${esc(t.gh)}.png?size=240)"></span>`;
  if (t.wiki) return `<span class="av" data-wiki="${esc(t.wiki)}"${t.x ? ` data-x="${esc(t.x)}"` : ""} style="background:${col}">${initials(t.name)}</span>`;
  if (t.x) return `<span class="av" style="background:${col};background-image:url(${xAvatar(t.x)})"></span>`;
  return `<span class="av" style="background:${col}">${initials(t.name)}</span>`;
}

function personRow(t, dir) {
  const r = RES[slugify(t.name)] || {};
  return `<a class="mini" href="researcher.html?r=${slugify(t.name)}">
    ${avatarHtml(t)}
    <div class="info"><div class="mname">${esc(t.name)}</div>
      <div class="mmove">${dir === "in" ? "from " + esc((LABS[t.from] || {}).name || t.from) : dir === "out" ? "to " + esc((LABS[t.to] || {}).name || t.to) : esc(r.knownFor || t.role || "")}</div></div>
    <div class="mright"><div class="mdate">${fmtDate(t.date)}</div></div>
  </a>`;
}

(async function () {
  const id = new URLSearchParams(location.search).get("l");
  const [labs, seed, researchers, models, dynamic] = await Promise.all([
    fetch("data/labs.json").then(r => r.json()),
    fetch("data/transfers.json").then(r => r.json()),
    fetch("data/researchers.json").then(r => r.json()),
    fetch("data/models.json").then(r => r.json()).catch(() => ({ models: [] })),
    fetch("/api/transfers").then(r => (r.ok ? r.json() : [])).catch(() => [])
  ]);
  LABS = labs; RES = researchers;
  const lab = LABS[id];
  if (!lab) { document.getElementById("lab").innerHTML = `<div class="panel"><div class="panel-foot">Lab not found. <a href="/">Back →</a></div></div>`; return; }
  document.title = `${lab.name} — AI Transfer Window`;

  const all = [...(seed.transfers || seed), ...(Array.isArray(dynamic) ? dynamic : [])];
  const ins = all.filter(t => t.to === id).sort((a, b) => b.date.localeCompare(a.date));
  const outs = all.filter(t => t.from === id).sort((a, b) => b.date.localeCompare(a.date));

  // current squad: people whose most-recent move landed at this lab
  const byPerson = {};
  all.forEach(t => { const s = slugify(t.name); if (!byPerson[s] || t.date > byPerson[s].date) byPerson[s] = t; });
  const squad = Object.values(byPerson).filter(t => t.to === id).sort((a, b) => b.date.localeCompare(a.date));

  const labModels = (models.models || []).filter(m => m.labId === id).sort((a, b) => (b.released || "").localeCompare(a.released || ""));
  const net = ins.length - outs.length;

  document.getElementById("lab").innerHTML = `
    <a class="back-link" href="/#balance">← Transfer balance</a>
    <section class="lab-hero panel">
      <div class="lab-badge" style="border-color:${lab.color}33">${bigCrest(lab)}</div>
      <div class="lab-head">
        <h1>${esc(lab.name)}</h1>
        <div class="lab-stats">
          <span class="ls"><b>${squad.length}</b> in squad</span>
          <span class="ls"><b class="net pos">+${ins.length}</b> in</span>
          <span class="ls"><b class="net neg">-${outs.length}</b> out</span>
          <span class="ls">net <b class="net ${net > 0 ? "pos" : net < 0 ? "neg" : "zero"}">${net > 0 ? "+" : ""}${net}</b></span>
          <span class="ls"><b>${labModels.length}</b> models</span>
        </div>
      </div>
    </section>

    <div class="tri">
      <div class="panel"><div class="panel-head sm"><h3>Current squad</h3></div>
        ${squad.length ? squad.map(t => personRow(t, "sq")).join("") : `<div class="empty">No tracked researchers currently here.</div>`}</div>
      <div class="panel"><div class="panel-head sm"><h3>Arrivals (${ins.length})</h3></div>
        ${ins.length ? ins.map(t => personRow(t, "in")).join("") : `<div class="empty">No arrivals tracked.</div>`}</div>
      <div class="panel"><div class="panel-head sm"><h3>Departures (${outs.length})</h3></div>
        ${outs.length ? outs.map(t => personRow(t, "out")).join("") : `<div class="empty">No departures tracked.</div>`}</div>
    </div>

    ${labModels.length ? `<div class="panel"><div class="panel-head"><h2>Models</h2></div>
      <div class="tlist">${labModels.map(m => `<div class="trow mrow">
        <span class="tr-av">${crestBadge(id)}</span>
        <div class="tr-idy"><a class="tr-name" href="${esc(m.link)}" target="_blank" rel="noopener">${esc(m.name)}</a><span class="tr-title">${esc(m.note || "")}</span></div>
        <div class="m-mod">${esc(m.modality || "")}</div><div class="m-ctx">${esc(m.context || "")}</div>
        <div class="m-open">${m.open ? `<span class="tag open">Open</span>` : `<span class="tag">Closed</span>`}</div>
        <div class="tr-date">${m.released ? fmtMonth(m.released) : ""}</div></div>`).join("")}</div></div>` : ""}`;
  hydrate();

  const s = document.getElementById("search");
  if (s) s.addEventListener("keydown", e => { if (e.key === "Enter") location.href = "/researchers.html"; });
})();
