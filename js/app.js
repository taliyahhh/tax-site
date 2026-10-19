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

  // ---- Logo: split into words so they stomp in one by one, like giant footsteps ----
  const logo = $("logo");
  logo.innerHTML = logo.textContent.trim().split(/\s+/)
    .map((w, i) => `<span class="word" style="--i:${i}" aria-hidden="true">${w}</span>` + (i === 1 ? "<br>" : " "))
    .join("");

  // ---- Intro: the logo plays its animation over the map, holds a beat, then moves up out of the way ----
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function settle() { landing.classList.add("settled"); TaxMap.settle(); }

  // ---- Where the logo and zip box go once the intro is over ----
  // Measures the real sizes on this screen: the logo (with its sticker) tucks into the top,
  // the zip box sits at the bottom above the map buttons, and the map gets the space between.
  // Wide but short screens (a phone turned sideways) put the zip box on the right instead.
  const logoWrap = document.querySelector(".logo-wrap"), sticker = document.querySelector(".sticker");
  const zipForm = $("zip-form");
  function placeLanding() {
    if (landing.hidden) return;
    const W = landing.clientWidth, H = landing.clientHeight;
    if (!W || !H) return;
    const narrow = W < 820;
    const side = W > H * 1.3 && H < 600;
    const pad = 12;

    // Logo box including the sticker poking out of its corner (offset sizes ignore transforms)
    const lw = logoWrap.offsetWidth, lh = logoWrap.offsetHeight;
    const lcx = logoWrap.offsetLeft + lw / 2, lcy = logoWrap.offsetTop + lh / 2;
    const top = Math.min(0, sticker.offsetTop), left = Math.min(0, sticker.offsetLeft);
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
      const bottomPad = narrow ? 62 : 16;
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
      foot.innerHTML = "";
      return;
    }

    const d = lv.data;
    $("level-line").innerHTML = `Every <b>$100</b> ${escape(d.name)} spent went like this. <span>${d.lead ? escape(d.lead) + " " : ""}${escape(d.period)}. Total: ${Collage.money(d.total, d.unit)}.</span>`;
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
