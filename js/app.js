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

  // "95050:69084,085;94546:,001" -> Map(zip -> [place code, county code])
  const zipMaps = {};
  function zipMap(st, file) {
    if (!zipMaps[st]) {
      zipMaps[st] = new Map();
      if (file.zips) for (const part of file.zips.split(";")) {
        const [z, v] = part.split(":");
        zipMaps[st].set(z, v.split(","));
      }
    }
    return zipMaps[st];
  }

  // The local government for a zip: its city if it has one, otherwise its county
  async function findCity(info) {
    const curated = B.cities[info.rawCity + "|" + info.state];
    if (curated) return curated;
    const file = await loadState(info.state);
    if (!file) return null;

    const geo = zipMap(info.state, file).get(info.zip); // [place, county] from Census geography
    let key = geo && geo[0] ? file.places[geo[0]] : null;
    if (!key || !file.cities[key]) key = cityKeyFor(info); // no city by geography (or a town/township): try the post office name
    const c = file.cities[key];
    if (c) {
      const name = key === "NEW YORK" && info.state === "NY" ? "New York City" : c.name;
      return {
        name, short: name, period: file.meta.period, unit: 1e6, total: c.total, values: c.values,
        paidBy: "Mostly local property tax and sales tax, plus state and federal grants and fees.",
        notes: file.meta.notes, source: file.meta.source
      };
    }
    const county = geo && geo[1] && file.counties[geo[1]];
    if (!county) return null;
    return {
      name: county.name, short: county.name, period: file.countyMeta.period, unit: 1e6, total: county.total, values: county.values,
      lead: `No city government covers most of ${info.city}, so ${county.name} provides local services like police and parks.`,
      paidBy: "Mostly local property tax and sales tax, plus state and federal grants and fees.",
      notes: file.countyMeta.notes, source: file.countyMeta.source
    };
  }

  // A state's own budget if typed into data/budgets.js, otherwise the Census numbers in data/states.js
  function findState(st) {
    if (B.states[st]) return B.states[st];
    const S = window.STATE_DATA;
    const g = S && S.states[st];
    if (!g) return null;
    const name = STATE_NAMES[st] || g.name;
    return {
      name, short: name, period: S.meta.period, unit: 1e6, total: g.total, values: g.values,
      paidBy: "State taxes (like sales, income, and business taxes) plus federal grants. Includes money the state sends to cities, counties, and school districts.",
      notes: S.meta.notes.replace("city-run", "government-run"), source: S.meta.source
    };
  }

  // ---- Logo: an inline SVG in index.html; each word is its own group so it stomps in on its own ----

  // ---- Intro: the logo plays its animation over the map, holds a beat, then moves up out of the way ----
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function settle() { landing.classList.add("settled"); TaxMap.settle(); }

  // ---- Where the logo and zip box go once the intro is over ----
  // Measures the real sizes on this screen: the logo (with its sticker) tucks into the top,
  // the zip box sits at the bottom above the map buttons, and the map gets the space between.
  // Wide but short screens (a phone turned sideways) put the zip box on the right instead.
  const logoWrap = document.querySelector(".logo-wrap");
  const zipForm = $("zip-form");
  function placeLanding() {
    if (landing.hidden) return;
    const W = landing.clientWidth, H = landing.clientHeight;
    if (!W || !H) return;
    const narrow = W < 820;
    const side = W > H * 1.3 && H < 600;
    const pad = 12;

    // Logo box (offset sizes ignore transforms)
    const lw = logoWrap.offsetWidth, lh = logoWrap.offsetHeight;
    const lcx = logoWrap.offsetLeft + lw / 2, lcy = logoWrap.offsetTop + lh / 2;
    const top = 0, left = 0;
    const fullH = lh - top, fullW = lw - left;
    let scale = Math.min(narrow ? 0.8 : 0.42, (H * (side ? 0.3 : 0.17)) / fullH, (W - pad * 2) / fullW);
    if (side) scale = Math.min(scale, (W * 0.36) / fullW);
    // the logo shrinks around its center, so work out where its top (and left) edges land
    const ty = pad - (lcy + (top - lh / 2) * scale);
    const tx = side ? pad - (lcx + (left - lw / 2) * scale) : 0;
    const logoBottom = lcy + (lh / 2) * scale + ty;

    const fw = zipForm.offsetWidth, fh = zipForm.offsetHeight;
    const fx0 = zipForm.offsetLeft, fy0 = zipForm.offsetTop;
    let fx = 0, fy, band;
    if (side) {
      // zip box on the right, centered top to bottom; map fills the left
      const formLeft = W - pad - 8 - fw;
      fx = formLeft - fx0;
      fy = (H - fh) / 2 - fy0;
      const bTop = logoBottom + 6, bBottom = H - 56;
      band = { cx: (pad + formLeft) / 2, w: formLeft - pad * 2, cy: (bTop + bBottom) / 2, h: Math.max(60, bBottom - bTop) };
    } else {
      // zip box at the bottom, clear of the +/- and Sources buttons
      const bottomPad = W < 520 ? 104 : narrow ? 62 : 16; // phones: the map buttons take two rows
      const formTop = Math.max(logoBottom + 40, H - bottomPad - fh);
      fy = formTop - fy0;
      band = { cx: W / 2, w: W, cy: (logoBottom + formTop) / 2, h: Math.max(60, formTop - logoBottom - 12) };
    }
    landing.style.setProperty("--logo-t", `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${scale.toFixed(3)})`);
    landing.style.setProperty("--form-t", `translate(${fx.toFixed(1)}px, ${fy.toFixed(1)}px)`);
    TaxMap.setBand(band);
  }
  placeLanding();
  if (document.fonts) document.fonts.ready.then(placeLanding);
  let placeTimer;
  window.addEventListener("resize", () => { clearTimeout(placeTimer); placeTimer = setTimeout(placeLanding, 60); });
  setTimeout(settle, reducedMotion ? 0 : 3200);

  // ---- Zip entry ----
  let current = null; // lookup result for a complete zip

  function update(zoom = true) {
    const v = input.value.replace(/\D/g, "").slice(0, 5);
    if (v !== input.value) input.value = v;
    const info = TaxMap.setPrefix(v, zoom);
    readout.textContent = info.text;
    current = info.zip ? TaxMap.lookup(info.zip) : null;
    landing.classList.toggle("typing", v.length > 0);
    $("map-reset").hidden = v.length === 0;
    go.disabled = !current;
    placeLanding();
  }
  input.addEventListener("input", () => update());

  // Or click (tap) a dot on the map to pick that zip code
  const mapCanvas = document.getElementById("map");
  let hoverFrame = 0;
  mapCanvas.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse" || TaxMap.isPanning()) return;
    cancelAnimationFrame(hoverFrame);
    hoverFrame = requestAnimationFrame(() => {
      mapCanvas.style.cursor = TaxMap.hoverAt(e.clientX, e.clientY) ? "pointer" : "grab";
    });
  });
  mapCanvas.addEventListener("pointerleave", () => TaxMap.setHover(-1));
  // Clicking the map takes two steps:
  //   1st click: the logo moves up and the area around the click lights up (zip codes sharing
  //              its first 3 digits), without zooming.
  //   2nd click in that area: zoom in to the town you clicked and pick its zip code.
  //   A click outside the lit area lights up the new area instead.
  let lastPointer = "mouse";
  mapCanvas.addEventListener("pointerdown", e => { lastPointer = e.pointerType; });
  mapCanvas.addEventListener("click", e => {
    if (TaxMap.didDrag()) return; // that was a drag to move the map, not a click
    const zip = TaxMap.zipAt(e.clientX, e.clientY, lastPointer === "mouse" ? 24 : 40);
    if (!zip) return;
    TaxMap.setHover(-1);
    settle();
    const area = zip.slice(0, 3);
    const inArea = input.value.length >= 3 && input.value.slice(0, 3) === area;
    const zoomedIn = TaxMap.zoomLevel() >= 3; // already zoomed in by hand: one click picks the town
    if (inArea || zoomedIn) {
      input.value = zip;
      update();
      go.focus({ preventScroll: true });
    } else {
      input.value = area;
      update(false);
      readout.textContent += lastPointer === "mouse" ? ". Click again to zoom in." : ". Tap again to zoom in.";
    }
  });

  // "Whole map" button resets the zoom
  $("map-reset").addEventListener("click", () => { input.value = ""; update(); });
  $("zoom-in").addEventListener("click", () => TaxMap.zoomBy(1.8));
  $("zoom-out").addEventListener("click", () => TaxMap.zoomBy(1 / 1.8));
  // Moving or zooming the map by hand moves the logo out of the way and offers "Whole map"
  TaxMap.onNavigate(level => {
    settle();
    $("map-reset").hidden = input.value.length === 0 && level < 1.2;
  });

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

  // From your file back to the map, then down into the tale
  $("read-tale").addEventListener("click", () => {
    history.pushState(null, "", location.pathname);
    showLanding();
    requestAnimationFrame(() => { const t = $("story"); if (t) t.scrollIntoView(); });
  });

  window.addEventListener("popstate", route);

  function showLanding() {
    results.hidden = true;
    landing.hidden = false;
    document.body.classList.remove("on-results");
    TaxMap.resize(); // the window may have changed size while the map was hidden
    // Start fresh: clear the old zip and zoom back out to the whole map
    input.value = "";
    update();
    input.focus({ preventScroll: true });
  }

  // ---- Results ----
  let levels = [], active = 0;

  async function show(zip, push) {
    const info = TaxMap.lookup(zip);
    if (!info) { showLanding(); return; }
    if (push) history.pushState(null, "", "?zip=" + zip);

    levels = [{ key: "federal", data: B.federal }];
    const state = findState(info.state);
    levels.push(state ? { key: "state", data: state } : { key: "state", missing: STATE_NAMES[info.state] || info.state });
    const city = await findCity(info);
    levels.push(city ? { key: "city", data: city } : { key: "city", missing: info.city });

    $("place-city").textContent = info.city;
    $("place-name").innerHTML = `<span id="place-zip">${zip}</span> &middot; ${escape(STATE_NAMES[info.state] || info.state)}`;

    const nav = $("levels");
    nav.innerHTML = "";
    // One "sheet" per folder: its tab plus the strip of folder that peeks out of the stack
    levels.forEach((lv, i) => {
      const sheet = document.createElement("div");
      sheet.className = "sheet";
      sheet.dataset.level = lv.key;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "level-btn" + (lv.missing ? " is-missing" : "");
      b.dataset.level = lv.key;
      const kind = { federal: "Nation", state: "State", city: "City" }[lv.key];
      const name = lv.data ? lv.data.short : lv.missing;
      // numbered 1, 2, 3 and side by side: the nation, then your state, then your city
      b.style.setProperty("--i", i);
      b.innerHTML = `<span class="tab-n" aria-hidden="true">${i + 1}</span><span class="tab-kind">${kind}</span>` + (kind === name ? "" : ` <span class="tab-name">${escape(name)}</span>`);
      b.addEventListener("click", () => switchTo(i));
      sheet.appendChild(b);
      nav.appendChild(sheet);
    });
    stackFolders(0);

    landing.hidden = true;
    results.hidden = false;
    document.body.classList.add("on-results");
    placeTabs(); // after the results are showing, so the tabs can be measured
    window.scrollTo(0, 0);
    pick(0);
  }

  // ---- Folders: switching levels pulls that folder to the front, with a soft paper-sifting sound ----
  let audioCtx = null;
  function paperSound() {
    try {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      audioCtx = audioCtx || new C();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const ctx = audioCtx, t = ctx.currentTime;
      // a few quick, soft rustles in a row: the sound of flipping through papers in a folder
      [0, 0.07, 0.15, 0.26].forEach((off, k) => {
        const len = 0.16 + Math.random() * 0.08;
        const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let n = 0; n < d.length; n++) d[n] = (Math.random() * 2 - 1) * (Math.random() < 0.3 ? 1 : 0.4);
        const src = ctx.createBufferSource(); src.buffer = buf;
        const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 0.7;
        const f0 = 1800 + Math.random() * 1600;
        bp.frequency.setValueAtTime(f0, t + off); bp.frequency.exponentialRampToValueAtTime(f0 * 1.6, t + off + len);
        const g = ctx.createGain(); const peak = [0.16, 0.11, 0.09, 0.06][k];
        g.gain.setValueAtTime(0.0001, t + off);
        g.gain.exponentialRampToValueAtTime(peak, t + off + 0.025);
        g.gain.exponentialRampToValueAtTime(0.0001, t + off + len);
        src.connect(bp).connect(g).connect(ctx.destination); src.start(t + off); src.stop(t + off + len);
      });
    } catch (e) {}
  }
  // Tabs sit edge to edge (a little overlap, like real folders), measured so long town names still fit
  function placeTabs() {
    let x = 14;
    [...$("levels").querySelectorAll(".level-btn")].forEach(b => { b.style.left = x + "px"; x += b.offsetWidth - 6; });
  }
  // Line them up again whenever a tab changes size (the handwriting font loading in, a phone rotating)
  const tabWatch = new ResizeObserver(() => { if (!results.hidden) placeTabs(); });
  new MutationObserver(() => $("levels").querySelectorAll(".level-btn").forEach(b => tabWatch.observe(b)))
    .observe($("levels"), { childList: true });

  // Put folder `front` at the front of the stack; the rest line up behind it
  function stackFolders(front) {
    const order = [front, ...levels.map((_, i) => i).filter(i => i !== front)];
    const sheets = [...$("levels").children];
    order.forEach((idx, row) => sheets[idx] && sheets[idx].style.setProperty("--row", row));
    $("levels").style.setProperty("--rows", sheets.length - 1);
  }

  // Switching folders: the tabs slide to their new places in the stack, the papers
  // fade out, the new papers are laid in, then they settle. The folder keeps its
  // height during the swap so the page doesn't jump.
  let swapTimer = 0, settleTimer = 0;
  function switchTo(i) {
    if (i === active) return;
    paperSound();
    stackFolders(i);
    const f = $("folder");
    $("file").dataset.level = levels[i].key;
    clearTimeout(swapTimer); clearTimeout(settleTimer);
    f.style.minHeight = f.offsetHeight + "px";
    f.classList.remove("settling");
    f.classList.add("swapping");
    active = i;
    swapTimer = setTimeout(() => {
      pick(i);
      f.classList.remove("swapping");
      f.classList.add("settling");
      settleTimer = setTimeout(() => { f.style.minHeight = ""; f.classList.remove("settling"); }, 500);
    }, 170);
  }

  function pick(i) {
    active = i;
    [...$("levels").querySelectorAll(".level-btn")].forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
    $("file").dataset.level = levels[i].key;
    const lv = levels[i];
    const collage = $("collage"), barely = $("barely"), foot = $("level-foot");

    if (lv.missing) {
      collage.classList.remove("scatter");
      collage.style.height = "";
      if (lv.key === "state") {
        $("level-line").textContent = `We don't have ${lv.missing}'s state budget yet.`;
        collage.innerHTML = `<p class="empty">This state's data didn't load. Try refreshing the page.</p>`;
      } else {
        $("level-line").textContent = `We couldn't find local government data for ${lv.missing}.`;
        collage.innerHTML = `<p class="empty">This zip code may be a post office box or a special-use zip code that doesn't map to a city or county.</p>`;
      }
      barely.hidden = true;
      $("hundred-wrap").hidden = true;
      foot.innerHTML = "";
      return;
    }

    const d = lv.data;
    // Lead with the punchline: where the most money went, then the next two
    const rows = Collage.breakdown(d).filter(r => r.cat.key !== "other");
    const said = r => (r.cat.key === "retirement" ? r.cat.label : r.cat.label.charAt(0).toLowerCase() + r.cat.label.slice(1));
    const next = rows.slice(1, 3).map(r => `${said(r)} ($${Math.round(r.share)})`).join(" and ");
    $("level-line").innerHTML = rows.length
      ? `Out of every $100 ${escape(d.name)} spent, <b>$${Math.round(rows[0].share)}</b> went to ${escape(said(rows[0]))}.`
        + `<span>${next ? "Next: " + escape(next) + ". " : ""}${d.lead ? escape(d.lead) + " " : ""}${escape(d.period)}. Total: ${Collage.money(d.total, d.unit)}.</span>`
      : `Every <b>$100</b> ${escape(d.name)} spent went like this. <span>${escape(d.period)}. Total: ${Collage.money(d.total, d.unit)}.</span>`;
    const missing = Collage.render(d, collage, openDetail);
    hundred(Collage.breakdown(d));

    barely.hidden = !missing.length;
    $("barely-title").textContent = `Barely any money from ${d.short} here`;
    $("barely-list").innerHTML = missing.map(c => `<li><img src="${c.img}" alt="">${escape(c.label)}</li>`).join("");

    foot.innerHTML = `<p><b>Paid for by:</b> ${escape(d.paidBy)}</p><p>${escape(d.notes)}</p>
      <p>Source: <a href="${d.source.url}" target="_blank" rel="noopener">${escape(d.source.name)}</a>. <a href="sources.html">All sources and methods</a></p>`;
  }

  // ---- Your $100 as 100 bills ----
  // Each category gets one bill per dollar (rounded so they add up to exactly 100).
  // Pointing at a bill lights up its sticker in the collage, and the other way around.
  function hundred(rows) {
    $("hundred-wrap").hidden = false;
    const exact = rows.map(r => r.share);
    const count = exact.map(Math.floor);
    let left = 100 - count.reduce((t, n) => t + n, 0);
    exact.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0])
      .forEach(([, i]) => { if (left > 0) { count[i]++; left--; } });
    const strip = $("hundred");
    strip.setAttribute("aria-label", "Your $100: " + rows.map((r, i) => count[i] ? `$${count[i]} ${r.cat.label}` : "").filter(Boolean).join(", "));
    strip.innerHTML = rows.map((r, i) => Array.from({ length: count[i] }, (_, n) =>
      `<span class="bill${n === 0 ? " first" : ""}" data-key="${r.cat.key}" style="--c:${r.cat.color}" title="${escape(r.cat.label)}: $${count[i]}"></span>`).join("")).join("");
  }
  function light(key) {
    const strip = $("hundred"), collage = $("collage");
    strip.classList.toggle("has-lit", !!key);
    collage.classList.toggle("has-lit", !!key);
    strip.querySelectorAll(".bill").forEach(b => b.classList.toggle("lit", b.dataset.key === key));
    collage.querySelectorAll(".obj").forEach(o => o.classList.toggle("lit", o.dataset.key === key));
  }
  $("hundred").addEventListener("pointerover", e => { const b = e.target.closest(".bill"); if (b) light(b.dataset.key); });
  $("hundred").addEventListener("pointerleave", () => light(null));
  $("collage").addEventListener("pointerover", e => { const o = e.target.closest(".obj"); light(o ? o.dataset.key : null); });
  $("collage").addEventListener("pointerleave", () => light(null));
  $("hundred").addEventListener("click", e => { const b = e.target.closest(".bill"); if (b) openDetail(Collage.byKey[b.dataset.key]); });

  // ---- Detail popup: one category across all three levels ----
  const dialog = $("detail");
  function openDetail(cat) {
    $("detail-img").src = Collage.animSrc(cat);
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
