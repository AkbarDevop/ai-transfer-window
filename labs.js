// ===== Frontier labs overview =====
const X_HANDLE = "mendurmen";
document.getElementById("navX").href = `https://x.com/${X_HANDLE}`;

const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const faviconUrl = d => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64`;
let LABS = {}, q = "";

function bigCrest(lab, info) {
  if (lab && lab.logo) return `<span class="lab-logo" style="background:${lab.color};-webkit-mask-image:url(${lab.logo});mask-image:url(${lab.logo})"></span>`;
  if (lab && lab.favicon) return `<img class="lab-logo-img" src="${faviconUrl(lab.favicon)}" alt="">`;
  if (info && info.domain) return `<img class="lab-logo-img" src="${faviconUrl(info.domain)}" alt="">`;
  return `<span class="lab-logo-mono" style="color:${(lab || {}).color || "#888"}">${(lab || {}).short || (info.id || "?").slice(0, 3).toUpperCase()}</span>`;
}

let INFOS = [], TX = [];
function render() {
  const ql = q.toLowerCase();
  const list = INFOS.filter(info => !ql || (info.id + " " + (LABS[info.id] || {}).name + " " + info.focus + " " + info.notable).toLowerCase().includes(ql));
  document.getElementById("labsGrid").innerHTML = list.map(info => {
    const lab = LABS[info.id] || { name: info.id, color: "#888" };
    const ins = TX.filter(t => t.to === info.id).length, outs = TX.filter(t => t.from === info.id).length;
    const net = ins - outs;
    const fact = (k, v) => v ? `<div class="lf"><span class="lk">${k}</span><span class="lv">${esc(v)}</span></div>` : "";
    return `<div class="lab-card">
      <div class="lab-card-head">
        <div class="lab-badge" style="border-color:${lab.color}33">${bigCrest(lab, info)}</div>
        <div><div class="lab-card-name">${esc(lab.name || info.id)}</div>
          <div class="lab-card-sub">${esc(info.hq || "")}${info.founded ? " · est. " + info.founded : ""}</div></div>
      </div>
      <p class="lab-blurb">${esc(info.blurb || "")}</p>
      <div class="lab-facts">
        ${fact("CEO", info.ceo)}
        ${fact("Founders", info.founders)}
        ${fact("Focus", info.focus)}
        ${fact("Funding", info.funding)}
        ${fact("Notable", info.notable)}
        ${info.tracked ? `<div class="lf"><span class="lk">Transfer balance</span><span class="lv"><b class="net pos">+${ins}</b> in / <b class="net neg">-${outs}</b> out / net <b class="net ${net > 0 ? "pos" : net < 0 ? "neg" : "zero"}">${net > 0 ? "+" : ""}${net}</b></span></div>` : ""}
      </div>
      <div class="lab-links">
        ${info.tracked ? `<a class="lk-btn primary" href="lab.html?l=${info.id}">View squad →</a>` : ""}
        ${info.site ? `<a class="lk-btn" href="${esc(info.site)}" target="_blank" rel="noopener">Website</a>` : ""}
        ${info.x ? `<a class="lk-btn" href="https://x.com/${esc(info.x)}" target="_blank" rel="noopener">X / @${esc(info.x)}</a>` : ""}
      </div>
    </div>`;
  }).join("");
}

(async function () {
  const [labs, info, seed, dynamic] = await Promise.all([
    fetch("data/labs.json").then(r => r.json()),
    fetch("data/labs-info.json").then(r => r.json()),
    fetch("data/transfers.json").then(r => r.json()),
    fetch("/api/transfers").then(r => (r.ok ? r.json() : [])).catch(() => [])
  ]);
  LABS = labs; INFOS = info.labs || info;
  TX = [...(seed.transfers || seed), ...(Array.isArray(dynamic) ? dynamic : [])];
  render();
  const s = document.getElementById("search");
  if (s) s.addEventListener("input", () => { q = s.value.trim(); render(); });
})();
