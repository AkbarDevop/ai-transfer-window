// ===== Frontier models page =====
const X_HANDLE = "mendurmen";
document.getElementById("navX").href = `https://x.com/${X_HANDLE}`;

const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const faviconUrl = d => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64`;
const fmtMonth = ym => { const [y, m] = ym.split("-"); return new Date(+y, +m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" }); };

let LABS = {}, MODELS = [], activeFilter = "all", q = "";

function labBadge(m) {
  const lab = m.labId && LABS[m.labId];
  if (lab) {
    let inner;
    if (lab.logo) inner = `<span class="crest-logo" style="background:${lab.color};-webkit-mask-image:url(${lab.logo});mask-image:url(${lab.logo})"></span>`;
    else if (lab.favicon) inner = `<img class="crest-img" src="${faviconUrl(lab.favicon)}" alt="" loading="lazy">`;
    else inner = `<span class="crest-mono" style="color:${lab.color}">${lab.short}</span>`;
    return `<span class="crest-badge" title="${esc(lab.name)}">${inner}</span>`;
  }
  if (m.domain) return `<span class="crest-badge" title="${esc(m.lab)}"><img class="crest-img" src="${faviconUrl(m.domain)}" alt="" loading="lazy"></span>`;
  return `<span class="crest-badge" title="${esc(m.lab)}"><span class="crest-mono" style="color:#8b97a8">${esc((m.lab || "?").slice(0, 3).toUpperCase())}</span></span>`;
}

function render() {
  const ql = q.toLowerCase();
  const list = MODELS
    .filter(m => activeFilter === "all" || m.labId === activeFilter || m.lab === activeFilter)
    .filter(m => !ql || (m.name + " " + m.lab + " " + (m.knownFor || "")).toLowerCase().includes(ql))
    .slice().sort((a, b) => (b.released || "").localeCompare(a.released || ""));

  document.getElementById("modelList").innerHTML = list.map(m => `
    <div class="trow mrow">
      <span class="tr-av">${labBadge(m)}</span>
      <div class="tr-idy">
        <a class="tr-name" href="${esc(m.link)}" target="_blank" rel="noopener">${esc(m.name)}</a>
        <span class="tr-title">${esc(m.lab)} · ${esc(m.note || "")}</span>
      </div>
      <div class="m-mod">${esc(m.modality || "")}</div>
      <div class="m-ctx">${esc(m.context || "")}</div>
      <div class="m-open">${m.open ? `<span class="tag open">Open</span>` : `<span class="tag">Closed</span>`}</div>
      <div class="m-tag"><span class="tag">${esc(m.knownFor || "")}</span></div>
      <div class="tr-date">${m.released ? fmtMonth(m.released) : ""}</div>
    </div>`).join("") || `<div class="empty" style="padding:16px 14px">No matches.</div>`;

  document.getElementById("count").textContent = `${list.length} model${list.length === 1 ? "" : "s"}${activeFilter === "all" ? "" : " · " + ((LABS[activeFilter] || {}).name || activeFilter)}`;
}

function renderFilters() {
  const used = [...new Set(MODELS.map(m => m.labId || m.lab))];
  const chips = [`<button class="chip ${activeFilter === "all" ? "active" : ""}" data-f="all">All</button>`];
  used.forEach(id => {
    const label = (LABS[id] && LABS[id].short) || id;
    chips.push(`<button class="chip ${activeFilter === id ? "active" : ""}" data-f="${esc(id)}">${esc(label)}</button>`);
  });
  const el = document.getElementById("filters");
  el.innerHTML = chips.join("");
  el.querySelectorAll(".chip").forEach(c => c.addEventListener("click", () => { activeFilter = c.dataset.f; renderFilters(); render(); }));
}

(async function () {
  const [labs, models] = await Promise.all([
    fetch("data/labs.json").then(r => r.json()),
    fetch("data/models.json").then(r => r.json())
  ]);
  LABS = labs; MODELS = models.models || models;
  renderFilters(); render();
  const s = document.getElementById("search");
  if (s) s.addEventListener("input", () => { q = s.value.trim(); render(); });
})();
