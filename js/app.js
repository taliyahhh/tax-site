// Page flow: map + zip entry, then the results collage.
(function () {
  const B = window.BUDGETS;
  const $ = id => document.getElementById(id);
  const landing = $("landing"), results = $("results");
  const input = $("zip"), readout = $("zip-readout"), go = $("go");

  const STATE_NAMES = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "Washington, DC", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming" };

  // ---- City data: data/cities/<STATE>.js, loaded the first time a zip in that state is used ----
  const loading = {};
  function loadState(st) {
    if (window.CITY_DATA && window.CITY_DATA[st]) return Promise.resolve(window.CITY_DATA[st]);
    if (!loading[st]) {
      loading[st] = new Promise(resolve => {
        const tag = document.createElement("script");
        tag.src = "data/cities/" + st + ".js";
        tag.onload = () => resolve((window.CITY_DATA || {})[st] || null);
        tag.onerror = () => resolve(null);
        document.head.appendChild(tag);
      });
    }
    return loading[st];
  }

  // Must match nameKey() in scripts/build-city-data.mjs
  function nameKey(s) {
    return s.toUpperCase()
      .replace(/\b(CITY AND BOROUGH|CITY|TOWN|VILLAGE|BOROUGH|TOWNSHIP|CHARTER TOWNSHIP|PLANTATION|CONSOLIDATED GOVERNMENT|METRO GOVERNMENT|UNIFIED GOVERNMENT)\b\s*(OF)?\s*$/, "")
      .replace(/\bST\.?\s/g, "SAINT ").replace(/\bMT\.?\s/g, "MOUNT ").replace(/\bFT\.?\s/g, "FORT ")
      .replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  }

  // Post office names in the five boroughs ("Brooklyn", "Flushing") all belong to New York City
  const NYC_PREFIXES = ["100", "101", "102", "103", "104", "111", "112", "113", "114", "116"];
  function cityKeyFor(info) {
    if (info.state === "NY" && (NYC_PREFIXES.includes(info.zip.slice(0, 3)) || info.zip === "11004" || info.zip === "11005")) return "NEW YORK";
    return nameKey(info.rawCity);
  }

  async function findCity(info) {
    const curated = B.cities[info.rawCity + "|" + info.state];
    if (curated) return curated;
    const file = await loadState(info.state);
    if (!file) return null;
    const key = cityKeyFor(info);
    const c = file.cities[key];
    if (!c) return null;
    const name = key === "NEW YORK" && info.state === "NY" ? "New York City" : c.name;
    return {
      name, short: name, period: file.meta.period, unit: 1e6, total: c.total, values: c.values,
      paidBy: "Mostly local property tax and sales tax, plus state and federal grants and fees.",
      notes: file.meta.notes, source: file.meta.source
    };
  }

  // ---- Logo: split letters so they can drop in one by one ----
  const logo = $("logo");
  logo.innerHTML = [...logo.textContent].map((ch, i) => `<span style="--i:${i}" aria-hidden="true">${ch}</span>`).join("");

  // ---- Zip entry ----
  let current = null; // lookup result for a complete zip

  function update() {
    const v = input.value.replace(/\D/g, "").slice(0, 5);
    if (v !== input.value) input.value = v;
    const info = TaxMap.setPrefix(v);
    readout.textContent = info.text;
    current = info.zip ? TaxMap.lookup(info.zip) : null;
    landing.classList.toggle("typing", v.length > 0);
    go.disabled = !current;
  }
  input.addEventListener("input", update);

  // Typing anywhere on the landing page goes into the zip box
  document.addEventListener("keydown", e => {
    if (landing.hidden || e.target === input || e.metaKey || e.ctrlKey) return;
    if (/^\d$/.test(e.key) || e.key === "Backspace") input.focus();
  });

  $("zip-form").addEventListener("submit", e => {
    e.preventDefault();
    if (!current) return;
    const zip = current.zip;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { show(zip, true); return; }
    TaxMap.zoomIn();
    landing.classList.add("leaving");
    setTimeout(() => { landing.classList.remove("leaving"); show(zip, true); }, 450);
  });

  $("back").addEventListener("click", () => {
    history.pushState(null, "", location.pathname);
    showLanding();
  });

  window.addEventListener("popstate", route);

  function showLanding() {
    results.hidden = true;
    landing.hidden = false;
    document.body.classList.remove("on-results");
    input.focus({ preventScroll: true });
  }

  // ---- Results ----
  let levels = [], active = 0;

  async function show(zip, push) {
    const info = TaxMap.lookup(zip);
    if (!info) { showLanding(); return; }
    if (push) history.pushState(null, "", "?zip=" + zip);

    levels = [{ key: "federal", data: B.federal }];
    const state = B.states[info.state];
    levels.push(state ? { key: "state", data: state } : { key: "state", missing: STATE_NAMES[info.state] || info.state });
    const city = await findCity(info);
    levels.push(city ? { key: "city", data: city } : { key: "city", missing: info.city });

    $("place-zip").textContent = zip;
    $("place-name").textContent = info.city + ", " + (STATE_NAMES[info.state] || info.state);

    const nav = $("levels");
    nav.innerHTML = "";
    levels.forEach((lv, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "level-btn" + (lv.missing ? " is-missing" : "");
      b.textContent = lv.data ? lv.data.short : lv.missing;
      b.addEventListener("click", () => pick(i));
      nav.appendChild(b);
    });

    landing.hidden = true;
    results.hidden = false;
    document.body.classList.add("on-results");
    window.scrollTo(0, 0);
    pick(0);
  }

  function pick(i) {
    active = i;
    [...$("levels").children].forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
    const lv = levels[i];
    const collage = $("collage"), barely = $("barely"), foot = $("level-foot");

    if (lv.missing) {
      if (lv.key === "state") {
        $("level-line").textContent = `We don't have ${lv.missing}'s state budget yet.`;
        collage.innerHTML = `<p class="empty">State budgets so far: California and New York. Each state takes one entry in <code>data/budgets.js</code>.</p>`;
      } else {
        $("level-line").textContent = `We couldn't find a city government for ${lv.missing}.`;
        collage.innerHTML = `<p class="empty">The post office name for this zip code may not match a city. Many zip codes cover unincorporated areas, where the county provides city services like police and parks.</p>`;
      }
      barely.hidden = true;
      foot.innerHTML = "";
      return;
    }

    const d = lv.data;
    $("level-line").innerHTML = `Every <b>$100</b> ${escape(d.name)} spent went like this. <span>${escape(d.period)}. Total: ${Collage.money(d.total, d.unit)}.</span>`;
    const missing = Collage.render(d, collage, openDetail);

    barely.hidden = !missing.length;
    $("barely-title").textContent = `Barely any money from ${d.short} here`;
    $("barely-list").innerHTML = missing.map(c => `<li><img src="${c.img}" alt="">${escape(c.label)}</li>`).join("");

    foot.innerHTML = `<p><b>Paid for by:</b> ${escape(d.paidBy)}</p><p>${escape(d.notes)}</p>
      <p>Source: <a href="${d.source.url}" target="_blank" rel="noopener">${escape(d.source.name)}</a>. <a href="sources.html">All sources and methods</a></p>`;
  }

  // ---- Detail popup: one category across all three levels ----
  const dialog = $("detail");
  function openDetail(cat) {
    $("detail-img").src = cat.img;
    $("detail-title").textContent = cat.label;
    $("detail-about").textContent = cat.about;
    $("detail-levels").innerHTML = levels.map(lv => {
      if (lv.missing) return `<li><span>${escape(lv.missing)}</span><span>No data yet</span></li>`;
      const row = Collage.breakdown(lv.data).find(r => r.cat.key === cat.key);
      return row
        ? `<li><span>${escape(lv.data.short)}</span><span><b>$${row.share.toFixed(2)}</b> of every $100<br>${Collage.money(row.value, lv.data.unit)}</span></li>`
        : `<li><span>${escape(lv.data.short)}</span><span>Barely any</span></li>`;
    }).join("");
    dialog.showModal();
  }
  dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });

  function escape(s) {
    return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  // ---- Routing: ?zip=95050 opens results directly ----
  function route() {
    const zip = new URLSearchParams(location.search).get("zip");
    if (zip && /^\d{5}$/.test(zip) && TaxMap.lookup(zip)) {
      input.value = zip;
      update();
      show(zip, false);
    } else {
      showLanding();
    }
  }
  route();
})();
