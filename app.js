// ===== AI Transfer Window =====
const X_HANDLE = "mendurmen"; // single knob: all CTAs + share intents point here

(function wireX() {
  const p = `https://x.com/${X_HANDLE}`;
  ["navX", "sideX", "footX"].forEach(id => { const el = document.getElementById(id); if (el) el.href = p; });
})();

let LABS = {};
let TRANSFERS = [];
let activeFilter = "all";

const initials = n => n.split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
const fmtDate = iso => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });

function crestBadge(labId) {
  const lab = LABS[labId] || { short: "?", color: "#888", logo: null, name: labId };
  const inner = lab.logo
    ? `<span class="crest-logo" style="background:${lab.color};-webkit-mask-image:url(${lab.logo});mask-image:url(${lab.logo})"></span>`
    : `<span class="crest-mono" style="color:${lab.color}">${lab.short}</span>`;
  return `<span class="crest-badge" title="${lab.name}">${inner}</span>`;
}
function crest(labId) {
  const lab = LABS[labId] || { name: labId };
  return `<span class="crest">${crestBadge(labId)}<span class="crest-name">${lab.name}</span></span>`;
}

function shareLink(t) {
  const from = (LABS[t.from] || {}).name || t.from;
  const to = (LABS[t.to] || {}).name || t.to;
  const tag = t.rumored ? "🔮 RUMOR" : "🔁";
  const text = `${tag} ${t.name}: ${from} → ${to}\n\nTracked on the AI Transfer Window`;
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(location.origin + "/")}`;
}

function renderTransfers() {
  const list = TRANSFERS
    .filter(t => activeFilter === "all" || t.from === activeFilter || t.to === activeFilter)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  const rows = list.map((t, i) => {
    const toColor = (LABS[t.to] || {}).color || "#16233c";
    const avColor = /^#0a0a0a$/i.test(toColor) ? "#16233c" : toColor;
    const roleTag = t.role
      ? `<span class="tag ${t.rumored ? "rumor" : ""}">${t.rumored ? "Rumored" : t.role}</span>`
      : (t.rumored ? `<span class="tag rumor">Rumored</span>` : "");
    const feeCls = t.fee ? (t.rumored ? "rumor" : "has") : "none";
    const fee = t.fee ? t.fee : "—";
    return `<tr title="${(t.note || "").replace(/"/g, "&quot;")}">
      <td class="rank">${i + 1}</td>
      <td>
        <div class="player">
          <span class="avatar" style="background:${avColor}">${initials(t.name)}</span>
          <span>
            <span class="pname">${t.name}</span>
            ${t.title ? `<span class="ptitle">${t.title}</span>` : ""}
          </span>
        </div>
      </td>
      <td>${crest(t.from)}</td>
      <td>${crest(t.to)}</td>
      <td>${roleTag}</td>
      <td class="date">${fmtDate(t.date)}</td>
      <td class="right"><span class="fee ${feeCls}">${fee}</span></td>
      <td class="right"><a class="share" href="${shareLink(t)}" target="_blank" rel="noopener" title="Share on X">↗</a></td>
    </tr>`;
  }).join("");

  document.getElementById("transferTable").innerHTML =
    `<thead><tr>
       <th class="rank">#</th><th>Researcher</th><th>From</th><th>To</th>
       <th>Role</th><th>Date</th><th class="right">Fee</th><th></th>
     </tr></thead><tbody>${rows}</tbody>`;

  document.getElementById("count").textContent =
    `${list.length} transfer${list.length === 1 ? "" : "s"}${activeFilter === "all" ? "" : " · filtered by " + (LABS[activeFilter] || {}).name}`;
}

function renderStandings() {
  const rows = {};
  Object.keys(LABS).forEach(id => (rows[id] = { in: 0, out: 0 }));
  TRANSFERS.forEach(t => { if (rows[t.to]) rows[t.to].in++; if (rows[t.from]) rows[t.from].out++; });
  const sorted = Object.entries(rows).map(([id, r]) => ({ id, ...r, net: r.in - r.out }))
    .filter(r => r.in || r.out).sort((a, b) => b.net - a.net || b.in - a.in);

  const body = sorted.map(r => {
    const cls = r.net > 0 ? "pos" : r.net < 0 ? "neg" : "zero";
    const sign = r.net > 0 ? "+" : "";
    return `<tr>
      <td>${crest(r.id)}</td>
      <td class="num">${r.in}</td>
      <td class="num">${r.out}</td>
      <td class="num net ${cls}">${sign}${r.net}</td>
    </tr>`;
  }).join("");

  document.getElementById("standings").innerHTML =
    `<thead><tr><th>Lab</th><th class="num">In</th><th class="num">Out</th><th class="num">Net</th></tr></thead><tbody>${body}</tbody>`;
}

function renderFilters() {
  const used = new Set();
  TRANSFERS.forEach(t => { used.add(t.from); used.add(t.to); });
  const chips = [`<button class="chip ${activeFilter === "all" ? "active" : ""}" data-f="all">All</button>`];
  Object.keys(LABS).filter(id => used.has(id)).forEach(id => {
    chips.push(`<button class="chip ${activeFilter === id ? "active" : ""}" data-f="${id}">${(LABS[id] || {}).short || id}</button>`);
  });
  const el = document.getElementById("filters");
  el.innerHTML = chips.join("");
  el.querySelectorAll(".chip").forEach(c =>
    c.addEventListener("click", () => { activeFilter = c.dataset.f; renderFilters(); renderTransfers(); }));
}

async function boot() {
  try {
    const [labs, seed, dynamic] = await Promise.all([
      fetch("data/labs.json").then(r => r.json()),
      fetch("data/transfers.json").then(r => r.json()),
      fetch("/api/transfers").then(r => (r.ok ? r.json() : [])).catch(() => [])
    ]);
    LABS = labs;
    const seedList = seed.transfers || seed;
    const byId = new Map();
    [...seedList, ...(Array.isArray(dynamic) ? dynamic : [])].forEach(t => byId.set(t.id, t));
    TRANSFERS = [...byId.values()];
    renderFilters();
    renderTransfers();
    renderStandings();
  } catch (e) {
    document.getElementById("transferTable").innerHTML =
      `<tbody><tr><td style="padding:20px;color:#6b7686">Could not load transfer data. Serve over HTTP (e.g. <code>python3 -m http.server</code>).</td></tr></tbody>`;
    console.error(e);
  }
}
boot();
