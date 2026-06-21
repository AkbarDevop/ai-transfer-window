// ===== Researcher profile page =====
const X_HANDLE = "mendurmen";
document.getElementById("navX").href = `https://x.com/${X_HANDLE}`;

const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const initials = n => n.split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
const fmtDate = iso => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });

let LABS = {};

// map career-path org names to known lab ids for crests
const ORG2LAB = {
  "openai": "openai", "anthropic": "anthropic", "google deepmind": "deepmind", "deepmind": "deepmind",
  "meta": "meta", "meta (facebook)": "meta", "facebook": "meta", "xai": "xai",
  "thinking machines lab": "tml", "thinking machines": "tml", "safe superintelligence": "ssi"
};
const orgLab = name => ORG2LAB[String(name || "").toLowerCase().trim()] || null;

// universities / companies that aren't tracked labs -> favicon logos
const ORG_DOMAIN = {
  "stanford university": "stanford.edu", "university of chicago": "uchicago.edu",
  "tesla": "tesla.com", "google brain": "research.google", "google": "google.com",
  "eureka labs": "eurekalabs.ai", "carnegie mellon university": "cmu.edu", "iit bombay": "iitb.ac.in",
  "facebook ai research": "ai.meta.com", "fair": "ai.meta.com", "mistral ai": "mistral.ai", "mistral": "mistral.ai",
  "university of pennsylvania": "upenn.edu", "michigan technological university": "mtu.edu",
  "university of cambridge": "cam.ac.uk", "university of sydney": "sydney.edu.au",
  "university of toronto": "utoronto.ca", "australian national university": "anu.edu.au",
  "usc information sciences institute": "isi.edu", "university of freiburg": "uni-freiburg.de",
  "character.ai": "character.ai", "character ai": "character.ai", "perplexity": "perplexity.ai",
  "uc berkeley": "berkeley.edu", "rwth aachen university": "rwth-aachen.de", "ist austria": "ista.ac.at",
  "peking university": "pku.edu.cn", "scale ai": "scale.com", "github": "github.com",
  "apple": "apple.com", "y combinator": "ycombinator.com", "google": "google.com", "vanderbilt university": "vanderbilt.edu"
};
const faviconUrl = d => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64`;

function crestBadge(labId) {
  const lab = LABS[labId] || { short: "?", color: "#888", logo: null, name: labId };
  let inner;
  if (lab.logo) inner = `<span class="crest-logo" style="background:${lab.color};-webkit-mask-image:url(${lab.logo});mask-image:url(${lab.logo})"></span>`;
  else if (lab.favicon) inner = `<img class="crest-img" src="${faviconUrl(lab.favicon)}" alt="" loading="lazy">`;
  else inner = `<span class="crest-mono" style="color:${lab.color}">${lab.short}</span>`;
  return `<span class="crest-badge" title="${esc(lab.name)}">${inner}</span>`;
}

// badge for any career-path org: tracked lab crest -> favicon logo -> initials
function orgBadge(org) {
  const lid = orgLab(org);
  if (lid) return crestBadge(lid);
  const dom = ORG_DOMAIN[String(org || "").toLowerCase().trim()];
  if (dom) return `<span class="crest-badge" title="${esc(org)}"><img class="crest-img" src="${faviconUrl(dom)}" alt="" loading="lazy"></span>`;
  return `<span class="crest-badge" title="${esc(org)}"><span class="crest-mono" style="color:#8b97a8">${esc((org || "?").slice(0, 3).toUpperCase())}</span></span>`;
}
function crest(labId) {
  const lab = LABS[labId] || { name: labId };
  return `<span class="crest">${crestBadge(labId)}<span class="crest-name">${esc(lab.name)}</span></span>`;
}

const hiRes = u => u ? u.replace(/\/\d+px-/, "/500px-") : u;
async function getPhotoUrl(tr, info) {
  if (tr && tr.photo) return tr.photo;
  if (tr && tr.gh) return `https://github.com/${tr.gh}.png?size=400`;
  if (info && info.links && info.links.github) return `https://github.com/${info.links.github}.png?size=400`;
  // X/Twitter avatar (clean square headshot) preferred over editorial Wikipedia photos
  const x = (tr && tr.x) || (info && info.links && info.links.x);
  if (x) return `https://unavatar.io/x/${x}?fallback=false`;
  // Wikipedia photo (last resort — can be a group/event shot)
  const wiki = (tr && tr.wiki) || (info && info.links && info.links.wikipedia);
  if (wiki && !/^https?:/.test(wiki)) {
    try {
      const r = await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(wiki));
      if (r.ok) { const j = await r.json(); if (j.thumbnail) return hiRes(j.thumbnail.source); }
    } catch {}
  }
  return null;
}

async function getWikiExtract(wiki) {
  if (!wiki || /^https?:/.test(wiki)) return null;
  try {
    const r = await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(wiki));
    if (!r.ok) return null;
    const j = await r.json();
    return { extract: j.extract, page: j.content_urls && j.content_urls.desktop.page };
  } catch { return null; }
}

async function getNews(name) {
  try {
    const r = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent('"' + name + '"')}&tags=story&hitsPerPage=10`);
    if (!r.ok) return [];
    const j = await r.json();
    const surname = name.split(/\s+/).pop().toLowerCase();
    return (j.hits || [])
      .filter(h => h.title && h.title.toLowerCase().includes(surname))
      .map(h => ({ title: h.title, url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`, points: h.points || 0, date: h.created_at }))
      .slice(0, 6);
  } catch { return []; }
}

function linkBtns(info, tr) {
  const L = (info && info.links) || {};
  const btns = [];
  const wiki = L.wikipedia || (tr && tr.wiki);
  if (wiki) btns.push(`<a class="lk" target="_blank" rel="noopener" href="${/^https?:/.test(wiki) ? esc(wiki) : "https://en.wikipedia.org/wiki/" + encodeURIComponent(wiki)}">Wikipedia</a>`);
  const gh = L.github || (tr && tr.gh);
  if (gh) btns.push(`<a class="lk" target="_blank" rel="noopener" href="https://github.com/${esc(gh)}">GitHub</a>`);
  if (L.x) btns.push(`<a class="lk" target="_blank" rel="noopener" href="https://x.com/${esc(L.x)}">X / @${esc(L.x)}</a>`);
  if (L.site) btns.push(`<a class="lk" target="_blank" rel="noopener" href="${esc(L.site)}">Website</a>`);
  if (L.scholar) btns.push(`<a class="lk" target="_blank" rel="noopener" href="${esc(L.scholar)}">Scholar</a>`);
  return btns.join("");
}

function shareProfile(name, slug) {
  const text = `📋 ${name} — career & transfer history on the AI Transfer Window`;
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(location.origin + "/researcher.html?r=" + slug)}`;
}

async function boot() {
  const slug = new URLSearchParams(location.search).get("r");
  const [labs, seed, researchers, dynamic] = await Promise.all([
    fetch("data/labs.json").then(r => r.json()),
    fetch("data/transfers.json").then(r => r.json()),
    fetch("data/researchers.json").then(r => r.json()),
    fetch("/api/transfers").then(r => (r.ok ? r.json() : [])).catch(() => [])
  ]);
  LABS = labs;
  const all = [...(seed.transfers || seed), ...(Array.isArray(dynamic) ? dynamic : [])];
  const mine = all.filter(t => slugify(t.name) === slug).sort((a, b) => b.date.localeCompare(a.date));
  const info = researchers[slug] || null;

  if (!mine.length && !info) {
    document.getElementById("profile").innerHTML =
      `<div class="panel"><div class="panel-foot">Researcher not found. <a href="/">Back to the window →</a></div></div>`;
    return;
  }

  const name = (info && info.name) || (mine[0] && mine[0].name) || "Researcher";
  document.title = `${name} — AI Transfer Window`;
  const latest = mine[0];
  const currentLab = latest ? latest.to : (orgLab(info && info.careerPath && info.careerPath.slice(-1)[0].org));
  const avColor = (LABS[currentLab] || {}).color || "#16233c";
  const avC = /^#0a0a0a$/i.test(avColor) ? "#16233c" : avColor;
  const age = info && info.bornYear ? (2026 - info.bornYear) : null;

  // transfer history rows
  const histRows = mine.map(t => {
    const feeCls = t.fee ? (t.rumored ? "rumor" : "has") : "none";
    return `<tr>
      <td class="date">${fmtDate(t.date)}</td>
      <td>${crest(t.from)}</td><td>${crest(t.to)}</td>
      <td>${t.rumored ? `<span class="tag rumor">Rumored</span>` : (t.role ? `<span class="tag">${esc(t.role)}</span>` : "")}</td>
      <td class="right"><span class="fee ${feeCls}">${t.fee ? esc(t.fee) : "—"}</span></td>
    </tr>`;
  }).join("");

  // career path
  const path = (info && info.careerPath) || [];
  const pathHtml = path.length ? path.map((p, i) =>
    `<div class="cp-item ${i === path.length - 1 ? "now" : ""}">
      ${orgBadge(p.org)}<div class="cp-body"><div class="cp-org">${esc(p.org)}</div><div class="cp-years">${esc(p.years || "")}</div></div>
    </div>`
  ).join("") : `<div class="empty">Career path not yet recorded.</div>`;

  const fact = (k, v) => v ? `<tr><th>${k}</th><td>${esc(v)}</td></tr>` : "";
  const factsHtml = `
    ${fact("Full name", name)}
    ${fact("Nationality", info && info.nationality)}
    ${info && info.bornYear ? `<tr><th>Born</th><td>${info.bornYear}${age ? ` (age ${age})` : ""}</td></tr>` : ""}
    ${fact("Education", info && info.education)}
    ${fact("Known for", info && info.knownFor)}
    ${fact("Role", (info && info.role) || (latest && latest.role))}
    ${currentLab ? `<tr><th>Current lab</th><td>${crest(currentLab)}</td></tr>` : ""}
    ${fact("Recorded moves", String(mine.length || ""))}`;

  document.getElementById("profile").innerHTML = `
    <a class="back-link" href="/">← All transfers</a>
    <section class="prof-hero panel">
      <div class="prof-photo mono" id="profPhoto" style="background:${avC}">${initials(name)}</div>
      <div class="prof-headline">
        <div class="prof-role">${esc((info && info.role) || (latest && latest.role) || "Researcher")}</div>
        <h1>${esc(name)}</h1>
        ${currentLab ? `<div class="prof-current">${crest(currentLab)} <span class="status-badge">● Active</span></div>` : ""}
        ${info && info.knownFor ? `<div class="prof-known">Known for <strong>${esc(info.knownFor)}</strong></div>` : ""}
        <div class="prof-links">${linkBtns(info, latest)}<a class="lk lk-x" target="_blank" rel="noopener" href="${shareProfile(name, slug)}">Share ↗</a></div>
      </div>
    </section>

    <div class="layout">
      <div class="col-main">
        <div class="panel">
          <div class="panel-head"><h2>Transfer history</h2></div>
          <div class="table-scroll"><table class="tm-table">
            <thead><tr><th>Date</th><th>From</th><th>To</th><th>Role</th><th class="right">Fee</th></tr></thead>
            <tbody>${histRows || `<tr><td colspan="5" class="empty">No transfers recorded.</td></tr>`}</tbody>
          </table></div>
        </div>

        <div class="panel">
          <div class="panel-head"><h2>Career path</h2></div>
          <div class="cp">${pathHtml}</div>
        </div>

        <div class="panel">
          <div class="panel-head"><h2>Biography</h2></div>
          <div class="bio" id="bio">${info && info.bio ? `<p>${esc(info.bio)}</p>` : `<p class="empty">No biography yet.</p>`}</div>
        </div>

        <div class="panel">
          <div class="panel-head"><h2>In the news</h2></div>
          <div id="profNews"><div class="empty">Searching Hacker News…</div></div>
        </div>
      </div>

      <aside class="col-side">
        <div class="panel">
          <div class="panel-head"><h2>Profile</h2></div>
          <table class="tm-table facts"><tbody>${factsHtml}</tbody></table>
        </div>
        <div class="panel promo">
          <div class="promo-body">
            <div class="promo-k">Follow the window.</div>
            <p>Every signing the moment it breaks.</p>
            <a class="btn-x" target="_blank" rel="noopener" href="https://x.com/${X_HANDLE}">Follow on X →</a>
          </div>
        </div>
      </aside>
    </div>`;

  // hydrate photo
  getPhotoUrl(latest, info).then(url => {
    if (!url) return;
    const el = document.getElementById("profPhoto");
    el.classList.remove("mono");
    el.innerHTML = `<img class="av-img" src="${url}" alt="" onerror="this.parentElement.classList.add('mono');this.parentElement.textContent='${initials(name)}'">`;
  });

  // wiki extract -> append to bio
  const wiki = (latest && latest.wiki) || (info && info.links && info.links.wikipedia);
  getWikiExtract(wiki).then(w => {
    if (!w || !w.extract) return;
    const bio = document.getElementById("bio");
    bio.innerHTML += `<p class="wiki-extract">${esc(w.extract)}</p>` +
      (w.page ? `<a class="lk" target="_blank" rel="noopener" href="${esc(w.page)}">Read full Wikipedia article →</a>` : "");
  });

  // news
  getNews(name).then(items => {
    const box = document.getElementById("profNews");
    if (!items.length) { box.innerHTML = `<div class="empty">No recent Hacker News mentions.</div>`; return; }
    box.innerHTML = items.map(n => {
      let host = ""; try { host = new URL(n.url).hostname.replace(/^www\./, ""); } catch {}
      return `<div class="tick"><span class="body">
        <a class="t" href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a>
        <span class="src">${esc(host)} · <span class="pts">▲ ${n.points}</span> · ${fmtDate(n.date.slice(0, 10))}</span>
      </span></div>`;
    }).join("");
  });

  // search box -> home
  const s = document.getElementById("search");
  if (s) s.addEventListener("keydown", e => { if (e.key === "Enter") location.href = "/?q=" + encodeURIComponent(s.value); });
}
boot();
