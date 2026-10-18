// The landing-page map: every US zip code as a dot.
// Typing digits lights up the zip codes that start with them and zooms in (inspired by Ben Fry's zipdecode).
(function () {
  const D = window.ZIP_DATA;
  const rows = D.rows.split(",");
  const N = rows.length;
  const zips = new Array(N);
  const xs = new Float32Array(N), ys = new Float32Array(N);
  const place = new Int32Array(N);
  const index = new Map();
  for (let i = 0; i < N; i++) {
    const r = rows[i];
    zips[i] = r.slice(0, 5);
    xs[i] = parseInt(r.slice(5, 8), 36) / 10;
    ys[i] = parseInt(r.slice(8, 11), 36) / 10;
    place[i] = parseInt(r.slice(11), 36);
    index.set(zips[i], i);
  }
  // Random order for the intro reveal
  const rank = new Float32Array(N);
  for (let i = 0; i < N; i++) rank[i] = Math.random();

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.getElementById("map");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1;

  const COLORS = { idle: "#a8a262", dim: "#4a4730", hit: "#fff2a0", bg: "#1d1d1d" };
  let prefix = "";
  const view = { x: D.width / 2, y: D.height / 2, s: 1 };   // current
  const target = { x: D.width / 2, y: D.height / 2, s: 1 }; // where we're animating to
  let introStart = performance.now();
  let raf = null;
  let focusY = 0;

  function baseScale() {
    // fit the whole country, leaving room for the logo on small screens
    return Math.min(W / D.width, H / D.height) * 0.94;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (!focusY) focusY = H / 2;
    if (prefix) fit(hits);
    canvas.width = W * dpr; canvas.height = H * dpr;
    kick();
  }

  function fit(indices) {
    if (!indices.length) { target.x = D.width / 2; target.y = D.height / 2; target.s = 1; return; }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const i of indices) {
      if (xs[i] < x0) x0 = xs[i]; if (xs[i] > x1) x1 = xs[i];
      if (ys[i] < y0) y0 = ys[i]; if (ys[i] > y1) y1 = ys[i];
    }
    // Fit the matches into the band of screen left open between the logo and the zip box
    const band = focusBand();
    const w = Math.max(x1 - x0, 4), h = Math.max(y1 - y0, 4);
    const b = baseScale();
    target.x = (x0 + x1) / 2; target.y = (y0 + y1) / 2;
    target.s = Math.min((W * 0.8) / (w * b), (band.h * 0.85) / (h * b), 12);
  }

  // While typing, the logo moves up and the zip box moves down; the map focuses in between.
  function focusBand() {
    if (!prefix) return { cy: H / 2, h: H };
    const top = H * (W < 700 ? 0.2 : 0.22), bottom = H * (W < 700 ? 0.62 : 0.66);
    return { cy: (top + bottom) / 2, h: bottom - top };
  }

  function matches() {
    if (!prefix) return [];
    const out = [];
    for (let i = 0; i < N; i++) if (zips[i].startsWith(prefix)) out.push(i);
    return out;
  }

  let hits = [];
  function setPrefix(p) {
    prefix = p;
    hits = matches();
    fit(prefix.length >= 1 ? hits : []);
    kick();
    return describe();
  }

  function placeOf(i) {
    const [city, st] = D.places[place[i]].split("|");
    return { city, state: st };
  }

  function describe() {
    if (!prefix) return { text: "Every dot is a zip code.", zip: null };
    if (!hits.length) return { text: "No zip codes start with " + prefix + ".", zip: null };
    if (prefix.length === 5) {
      const p = placeOf(hits[0]);
      return { text: titleCase(p.city) + ", " + p.state, zip: zips[hits[0]], place: p };
    }
    const states = [...new Set(hits.map(i => placeOf(i).state))];
    const where = states.length <= 3 ? states.join(", ") : states.length + " states";
    return { text: hits.length.toLocaleString() + " zip codes in " + where, zip: null };
  }

  function titleCase(s) {
    return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  function lookup(zip) {
    const i = index.get(zip);
    if (i == null) return null;
    const p = placeOf(i);
    return { zip, city: titleCase(p.city), rawCity: p.city, state: p.state };
  }

  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  function frame(now) {
    raf = null;
    const k = reduced ? 1 : 0.14;
    view.x += (target.x - view.x) * k;
    view.y += (target.y - view.y) * k;
    view.s += (target.s - view.s) * k;
    const moving = Math.abs(target.s - view.s) > 0.002 || Math.abs(target.x - view.x) > 0.05 || Math.abs(target.y - view.y) > 0.05;
    const intro = reduced ? 1 : Math.min((now - introStart) / 1600, 1);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    const s = baseScale() * view.s;
    focusY += (focusBand().cy - focusY) * k;
    const ox = W / 2 - view.x * s, oy = focusY - view.y * s;
    const r = Math.max(1, Math.min(1.1 + view.s * 0.18, 4));
    const hitSet = prefix ? new Set(hits) : null;

    // dim / idle dots first, then the highlighted ones on top
    ctx.fillStyle = prefix ? COLORS.dim : COLORS.idle;
    for (let i = 0; i < N; i++) {
      if (rank[i] > intro) continue;
      if (hitSet && hitSet.has(i)) continue;
      const px = xs[i] * s + ox, py = ys[i] * s + oy;
      if (px < -4 || py < -4 || px > W + 4 || py > H + 4) continue;
      ctx.fillRect(px, py, r, r);
    }
    if (hitSet) {
      ctx.fillStyle = COLORS.hit;
      const hr = r + (prefix.length === 5 ? 6 : 0.8);
      for (const i of hits) {
        const px = xs[i] * s + ox, py = ys[i] * s + oy;
        ctx.fillRect(px - hr / 2, py - hr / 2, hr, hr);
      }
    }
    // One exact zip: draw a ring and its name
    if (prefix.length === 5 && hits.length) {
      const i = hits[0];
      const px = xs[i] * s + ox, py = ys[i] * s + oy;
      ctx.strokeStyle = "#ff2e63"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(px, py, 22, 0, Math.PI * 2); ctx.stroke();
      const p = placeOf(i);
      const label = titleCase(p.city) + ", " + p.state;
      ctx.font = "800 18px Archivo, sans-serif";
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = "#ff2e63"; ctx.fillRect(px + 30, py - 15, tw + 20, 30);
      ctx.fillStyle = "#fff"; ctx.fillText(label, px + 40, py + 6);
    }
    if (moving || intro < 1 || Math.abs(focusBand().cy - focusY) > 0.5) kick();
  }

  window.addEventListener("resize", resize);
  resize();

  window.TaxMap = { setPrefix, lookup, zoomIn() { target.s *= 3; kick(); }, replayIntro() { introStart = performance.now(); kick(); } };
})();
