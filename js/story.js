// The tale: one tax dollar's trip, told on the same dot map as the landing page.
// The map sits still (sticky) while the chapters scroll over it. Each .step in index.html is one stop;
// STOPS below says what the map does at that stop.
//   Fee:  the map, with your dollar glowing in the middle of the country
//   Fi:   as you scroll, every zip code's dot flies to Washington (scrubbed by the scroll)
//   Fo:   the dots fly back home, colored by who paid in more vs. who got more back
//   Fund: the map lights back up in its landing colors, spreading out from your town
(function () {
  const section = document.getElementById("story");
  const canvas = document.getElementById("story-map");
  if (!section || !canvas) return;
  const D = window.ZIP_DATA;
  const ctx = canvas.getContext("2d");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- The dots: same data and colors as js/map.js ----
  const rows = D.rows.split(",");
  const N = rows.length;
  const xs = new Float32Array(N), ys = new Float32Array(N);
  const zone = new Uint8Array(N), rank = new Float32Array(N);
  const jx = new Float32Array(N), jy = new Float32Array(N);
  const stateOf = new Array(N);
  const placeState = D.places.map(p => p.split("|")[1]);
  const at = {};
  for (let i = 0; i < N; i++) {
    const r = rows[i];
    xs[i] = parseInt(r.slice(5, 8), 36) / 10;
    ys[i] = parseInt(r.slice(8, 11), 36) / 10;
    stateOf[i] = placeState[parseInt(r.slice(11), 36)];
    zone[i] = r.charCodeAt(0) - 48;
    rank[i] = Math.random();
    // where this dot lands in the pile in Washington
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 16;
    jx[i] = Math.cos(a) * d; jy[i] = Math.sin(a) * d * 0.7;
    at[r.slice(0, 5)] = i;
  }
  const ZONE = ["#ff2e63", "#ff7a1a", "#f5b700", "#2bb673", "#16a6a0", "#2f8cff", "#3d4dff", "#9b5cff", "#e84fb0", "#7a8f1f"];
  const HOT = "#eaff3a", INK = "#111111", PAPER = "#fffdf6";

  // "Your town" for the tale is the middle of the country (Salina, Kansas); Washington is the pile.
  const HOME = { x: xs[at["67401"]], y: ys[at["67401"]] };
  const DC = { x: xs[at["20001"]], y: ys[at["20001"]] };

  // Who paid in more vs. got more back, federal fiscal year 2023 (preliminary).
  // Rockefeller Institute of Government, "Giving or Getting?" (2025): https://rockinst.org/?p=37556
  const DONORS = new Set(["NJ", "MA", "WA"]);
  const TOP_RECEIVERS = new Set(["VA", "NM", "AK", "MD", "WV"]);

  // ---- What the map does at each stop (one entry per .step, in order) ----
  //   cam: where the map looks    dots: how the dots are colored    dark: night background
  //   flow: "scrub" ties the trip to Washington to the scroll    home/dc: show those markers
  const CAMS = {
    full: { x: 487.5, y: 305, s: 1 },
    home: { x: HOME.x, y: HOME.y, s: 2.6 },
    trip: { x: (HOME.x + DC.x) / 2 + 40, y: 285, s: 1.35 },
    ca: { x: 92, y: 290, s: 2.3 }
  };
  const STOPS = [
    { cam: "full", dots: "plain", home: "Your dollar" },
    { cam: "home", dots: "plain", home: "Your dollar" },
    { cam: "full", dots: "plain", flow: "scrub", dc: true },
    { cam: "trip", dots: "plain", flow: "scrub", dc: true },
    { cam: "full", dots: "balance", dark: true, dc: true },
    { cam: "full", dots: "balance", dark: true },
    { cam: "ca", dots: "california", dark: true },
    { cam: "full", dots: "zones", ripple: true, home: "Home" },
    { cam: "full", dots: "zones", ripple: true, home: "Home" }
  ];
  const CHAPTER = [0, 0, 1, 1, 2, 2, 2, 3, 3];
  const steps = [...section.querySelectorAll(".step")];
  const tabs = [...section.querySelectorAll(".story-tabs a")];

  // ---- Out of every $100 (chapter Fi), from the same federal numbers as the results page ----
  const per100 = document.getElementById("per100");
  if (per100 && window.BUDGETS && window.CATEGORIES) {
    const F = window.BUDGETS.federal;
    const label = k => (window.CATEGORIES.find(c => c.key === k) || { label: k }).label;
    const top = Object.entries(F.values).sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([k, v]) => [label(k), Math.round(v / F.total * 100)]);
    const rest = 100 - top.reduce((t, [, n]) => t + n, 0);
    per100.innerHTML = top.concat([["Everything else", rest]])
      .map(([name, n]) => `<li><span class="p-num">$${n}</span><span>${name}</span></li>`).join("");
  }

  // ---- State that animates toward its target every frame ----
  let W = 0, H = 0, dpr = 1;
  let active = 0, scrub = 0;
  const cam = { x: CAMS.full.x, y: CAMS.full.y, s: 1 };
  let flow = 0;      // 0 = every dot at home, 1 = every dot in Washington
  let dark = 0;      // background: 0 paper, 1 night
  let ripple = 0;    // chapter Fund: how far the color has spread from home (map units)
  let running = false, raf = null;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (!W || !H) return;
    canvas.width = W * dpr; canvas.height = H * dpr;
    kick();
  }

  // Which stop is in the middle of the screen, and how far through the trip to Washington we are
  function measure() {
    const mid = window.innerHeight * 0.55;
    let a = 0;
    for (let i = 0; i < steps.length; i++) if (steps[i].getBoundingClientRect().top <= mid) a = i;
    if (a !== active) {
      active = a;
      const ch = CHAPTER[active];
      tabs.forEach((t, i) => { if (i === ch) t.setAttribute("aria-current", "step"); else t.removeAttribute("aria-current"); });
    }
    const a2 = steps[2].getBoundingClientRect(), a3 = steps[3].getBoundingClientRect();
    const span = a2.height + a3.height * 0.55;
    scrub = Math.min(Math.max((mid - a2.top) / span, 0), 1);
  }

  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const mixColor = (a, b, t) => {
    const p = n => [parseInt(n.slice(1, 3), 16), parseInt(n.slice(3, 5), 16), parseInt(n.slice(5, 7), 16)];
    const A = p(a), B = p(b);
    return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`;
  };

  function colorOf(i, mode, near) {
    if (mode === "balance") return DONORS.has(stateOf[i]) ? HOT : TOP_RECEIVERS.has(stateOf[i]) ? PAPER : "#4a4740";
    if (mode === "california") return stateOf[i] === "CA" ? HOT : "#3a3833";
    if (mode === "zones") return near ? ZONE[zone[i]] : "#b9b39a";
    return "#a8a262";
  }

  function frame() {
    raf = null;
    // the tale is hidden while results show, so measure again once it's back
    if (canvas.clientWidth !== W || canvas.clientHeight !== H) resize();
    if (!W || !H) return;
    measure();
    const stop = STOPS[active] || STOPS[0];
    const k = reduced ? 1 : 0.09;

    // camera: on wide screens the cards sit on the left, so aim the map a little to the right
    const c = CAMS[stop.cam];
    cam.x += (c.x - cam.x) * k; cam.y += (c.y - cam.y) * k; cam.s += (c.s - cam.s) * k;
    // the trip to Washington follows the scroll; after it, the dots fly home on their own
    const flowTarget = reduced ? 0 : stop.flow === "scrub" ? scrub : 0;
    flow += (flowTarget - flow) * (stop.flow === "scrub" ? 0.25 : 0.045);
    dark += ((stop.dark ? 1 : 0) - dark) * (reduced ? 1 : 0.08);
    ripple += ((stop.ripple ? 1300 : 0) - ripple) * (reduced ? 1 : stop.ripple ? 0.02 : 0.2);

    const shift = W > 900 && !steps[active].classList.contains("step-open") ? Math.min(W * 0.16, 240) : 0;
    // with a card on the left, fit the map into the space to its right
    const base = Math.min((W - shift * 2) / D.width, H / D.height) * 0.9;
    const s = base * cam.s;
    const ox = W / 2 + shift - cam.x * s, oy = H / 2 + 24 - cam.y * s;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = mixColor("#f4f1e8", "#1d1d1d", dark);
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = mixColor("#e4ddcd", "#262626", dark);
    for (let gx = 0; gx < W; gx += 26) ctx.fillRect(gx, 0, 1, H);
    for (let gy = 0; gy < H; gy += 26) ctx.fillRect(0, gy, W, 1);

    drawStates(s, ox, oy);

    const r = Math.max(W < 820 ? 1.2 : 1.6, Math.min(base * 2.1 + cam.s * 0.3, 4.5));
    const mode = stop.dots;
    let last = "";
    for (let i = 0; i < N; i++) {
      let x = xs[i], y = ys[i];
      if (flow > 0.002) {
        // each dot leaves at its own moment, so the map drains toward Washington instead of jumping
        const t = ease(Math.min(Math.max(flow * 1.7 - rank[i] * 0.7, 0), 1));
        x += (DC.x + jx[i] - x) * t; y += (DC.y + jy[i] - y) * t;
      }
      const px = x * s + ox, py = y * s + oy;
      if (px < -4 || py < -4 || px > W + 4 || py > H + 4) continue;
      const near = mode === "zones" && Math.hypot(xs[i] - HOME.x, ys[i] - HOME.y) < ripple;
      const col = colorOf(i, mode, near);
      if (col !== last) { ctx.fillStyle = col; last = col; }
      ctx.fillRect(px, py, r, r);
    }

    // your dollar: a glowing yellow coin in your town
    if (stop.home) {
      const hx = HOME.x * s + ox, hy = HOME.y * s + oy;
      const pulse = reduced ? 0 : (Math.sin(performance.now() / 350) + 1) * 3;
      ctx.beginPath(); ctx.arc(hx, hy, 9 + pulse, 0, Math.PI * 2);
      ctx.fillStyle = HOT; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      ctx.font = "700 13px 'IBM Plex Mono', monospace"; ctx.fillStyle = INK; ctx.textAlign = "center";
      ctx.fillText("$", hx, hy + 4.5); ctx.textAlign = "left";
      marker(hx, hy, 18, stop.home, dark > 0.5);
    }
    if (stop.dc) marker(DC.x * s + ox, DC.y * s + oy, 20, "Washington, D.C.", dark > 0.5);

    if (running) kick();
  }

  // State borders, drawn like the landing map (data/states-lines.js)
  function drawStates(sc, ox, oy) {
    const L = window.STATE_LINES;
    if (!L) return;
    const stroke = (lines, width, color) => {
      ctx.beginPath();
      for (const l of lines) {
        ctx.moveTo(l[0] * sc + ox, l[1] * sc + oy);
        for (let j = 2; j < l.length; j += 2) ctx.lineTo(l[j] * sc + ox, l[j + 1] * sc + oy);
      }
      ctx.lineWidth = width; ctx.strokeStyle = color; ctx.lineJoin = "round"; ctx.stroke();
    };
    const a = 1 - dark * 0.6;
    stroke(L.inner, 1.4, dark > 0.5 ? `rgba(255,253,246,${0.18})` : `rgba(17,17,17,${0.4 * a})`);
    stroke(L.outer, 2, dark > 0.5 ? `rgba(255,253,246,${0.35})` : `rgba(17,17,17,${0.65 * a})`);
  }

  // A ring with a label box, like the landing map's markers
  function marker(px, py, radius, label, night) {
    ctx.strokeStyle = night ? HOT : INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.font = "700 14px 'IBM Plex Mono', monospace";
    const tw = ctx.measureText(label).width, h = 26;
    let lx = px + radius + 8;
    if (lx + tw + 24 > W - 8) lx = px - radius - 8 - tw - 20;
    ctx.fillStyle = INK; ctx.fillRect(lx - 2, py - h / 2 - 2, tw + 24, h + 4);
    ctx.fillStyle = night ? HOT : PAPER; ctx.fillRect(lx, py - h / 2, tw + 20, h);
    ctx.fillStyle = INK; ctx.fillText(label, lx + 10, py + 5);
  }

  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  // Only animate while the tale is on screen
  new IntersectionObserver(entries => {
    running = entries[0].isIntersecting;
    if (running) kick();
  }).observe(section);
  window.addEventListener("resize", resize);
  window.addEventListener("scroll", kick, { passive: true });
  resize();

  // ---- Links ----
  const go = el => el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  tabs.forEach(t => t.addEventListener("click", e => {
    const target = document.querySelector(t.getAttribute("href"));
    if (target) { e.preventDefault(); go(target); }
  }));
  const tale = document.getElementById("tale-btn");
  if (tale) tale.addEventListener("click", e => { e.preventDefault(); go(section); });
  // The end of the tale sends you back up to the map to type your zip
  const cta = document.getElementById("story-cta");
  if (cta) cta.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    setTimeout(() => { const z = document.getElementById("zip"); if (z) z.focus({ preventScroll: true }); }, reduced ? 0 : 700);
  });

  window.TaxStory = { resize };
})();
