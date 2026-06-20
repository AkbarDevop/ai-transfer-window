// ===== AI Transfer Window =====
// Single config knob: your X handle. Everything funnels here.
const X_HANDLE = "mendurmen"; // <-- change to whatever account you want traction on

(function wireX() {
  const profile = `https://x.com/${X_HANDLE}`;
  document.getElementById("xFollow").href = profile;
  document.getElementById("xFollow2").href = profile;
  document.getElementById("xReply").href = profile;
})();

let LABS = {};
let TRANSFERS = [];
let activeFilter = "all";

function initials(name) {
  return name.split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function crest(labId) {
  const lab = LABS[labId] || { short: "?", color: "#555", name: labId };
  return `<span class="crest" style="background:${lab.color}" title="${lab.name}">${lab.short}</span>`;
}

function labPill(labId) {
  const lab = LABS[labId] || { name: labId, color: "#555" };
  return `<span class="pill"><span class="dot" style="background:${lab.color}"></span>${lab.name}</span>`;
}

function shareLink(t) {
  const from = (LABS[t.from] || {}).name || t.from;
  const to = (LABS[t.to] || {}).name || t.to;
  const text = `🔁 ${t.name}: ${from} → ${to}\n\nTracked on the AI Transfer Window`;
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(location.href)}`;
}

function renderStandings() {
  const rows = {};
  Object.keys(LABS).forEach(id => (rows[id] = { in: 0, out: 0 }));
  TRANSFERS.forEach(t => {
    if (rows[t.to]) rows[t.to].in++;
    if (rows[t.from]) rows[t.from].out++;
  });
  const sorted = Object.entries(rows)
    .map(([id, r]) => ({ id, ...r, net: r.in - r.out }))
    .filter(r => r.in || r.out)
    .sort((a, b) => b.net - a.net || b.in - a.in);

  const body = sorted.map(r => {
    const lab = LABS[r.id];
    const cls = r.net > 0 ? "pos" : r.net < 0 ? "neg" : "zero";
    const sign = r.net > 0 ? "+" : "";
    return `<tr>
      <td><div class="lab-cell">${crest(r.id)}<span class="nm">${lab.name}</span></div></td>
      <td class="num">${r.in}</td>
      <td class="num">${r.out}</td>
      <td class="num net ${cls}">${sign}${r.net}</td>
    </tr>`;
  }).join("");

  document.getElementById("standings").innerHTML =
    `<thead><tr><th>Lab</th><th class="num">In</th><th class="num">Out</th><th class="num">Net</th></tr></thead>
     <tbody>${body}</tbody>`;
}

function renderFilters() {
  const used = new Set();
  TRANSFERS.forEach(t => { used.add(t.from); used.add(t.to); });
  const chips = [`<button class="chip ${activeFilter === "all" ? "active" : ""}" data-f="all" style="${activeFilter === "all" ? "background:var(--accent-2)" : ""}">All</button>`];
  Object.keys(LABS).filter(id => used.has(id)).forEach(id => {
    const lab = LABS[id];
    const on = activeFilter === id;
    chips.push(`<button class="chip ${on ? "active" : ""}" data-f="${id}" style="${on ? `background:${lab.color}` : ""}">${lab.name}</button>`);
  });
  const el = document.getElementById("filters");
  el.innerHTML = chips.join("");
  el.querySelectorAll(".chip").forEach(c =>
    c.addEventListener("click", () => { activeFilter = c.dataset.f; renderFilters(); renderFeed(); })
  );
}

function renderFeed() {
  const list = TRANSFERS
    .filter(t => activeFilter === "all" || t.from === activeFilter || t.to === activeFilter)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  document.getElementById("feed").innerHTML = list.map(t => {
    const tag = t.rumored
      ? `<span class="tag rumor">Rumored</span>`
      : (t.role ? `<span class="tag">${t.role}</span>` : "");
    const fee = t.fee ? `<span class="fee">${t.fee}</span>` : "";
    return `<article class="card">
      <div class="avatar">${initials(t.name)}</div>
      <div class="who">
        <div class="name">${t.name}</div>
        ${t.title ? `<div class="title">${t.title}</div>` : ""}
        <div class="move">
          ${labPill(t.from)}<span class="arrow">→</span>${labPill(t.to)} ${tag}
        </div>
        ${t.note ? `<div class="note">${t.note}</div>` : ""}
      </div>
      <div class="right">
        <span class="date">${fmtDate(t.date)}</span>
        ${fee}
        <a class="share" href="${shareLink(t)}" target="_blank" rel="noopener">Share ↗</a>
      </div>
    </article>`;
  }).join("");
}

async function boot() {
  try {
    const [labs, seed, dynamic] = await Promise.all([
      fetch("data/labs.json").then(r => r.json()),
      fetch("data/transfers.json").then(r => r.json()),
      // Live additions from the Netlify Blobs store. Falls back to [] if offline / not deployed.
      fetch("/api/transfers").then(r => (r.ok ? r.json() : [])).catch(() => [])
    ]);
    LABS = labs;
    const seedList = seed.transfers || seed;
    // Merge seed + dynamic; dynamic entries upsert by id so you can correct a move.
    const byId = new Map();
    [...seedList, ...(Array.isArray(dynamic) ? dynamic : [])].forEach(t => byId.set(t.id, t));
    TRANSFERS = [...byId.values()];
    renderStandings();
    renderFilters();
    renderFeed();
  } catch (e) {
    document.getElementById("feed").innerHTML =
      `<p style="color:var(--muted)">Could not load transfer data. Serve this folder over HTTP (e.g. <code>python3 -m http.server</code>).</p>`;
    console.error(e);
  }
}

boot();
