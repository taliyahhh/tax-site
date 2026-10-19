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

  const COLORS = { idle: "#e9e08a", dim: "#5e5a3c", hit: "#fff6b8", bg: "#1d1d1d" };
  let prefix = "";
  const view = { x: D.width / 2, y: D.height / 2, s: 1 };   // current
  const target = { x: D.width / 2, y: D.height / 2, s: 1 }; // where we're animating to
  let introStart = performance.now();
  let raf = null;
  let settled = false; // after the intro, the logo moves up and the map shrinks into the middle band
  let mix = 0;          // 0 = map fills the screen, 1 = map fits the middle band (animated)
  let hover = -1;                    // dot under the pointer
  let last = { s: 1, ox: 0, oy: 0 }; // last drawn transform, for turning a click into a zip

  function baseScale(m = mix) {
    // fit the whole country into the full screen, or into the middle band once things settle
    const h = H + (band().h - H) * m;
    return Math.min(W / D.width, h / D.height) * 0.97;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
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
    const w = Math.max(x1 - x0, 4), h = Math.max(y1 - y0, 4);
    const b = baseScale(1);
    target.x = (x0 + x1) / 2; target.y = (y0 + y1) / 2;
    target.s = Math.min((W * 0.8) / (w * b), (band().h * 0.85) / (h * b), 12);
  }

  // The open space between the logo (moved up) and the zip box (moved down)
  function band() {
    const top = H * (W < 820 ? 0.15 : 0.16), bottom = H * (W < 820 ? 0.62 : 0.69);
    return { cy: (top + bottom) / 2, h: bottom - top };
  }
  const wantMix = () => (settled || prefix ? 1 : 0);

  function matches() {
    if (!prefix) return [];
    const out = [];
    for (let i = 0; i < N; i++) if (zips[i].startsWith(prefix)) out.push(i);
    return out;
  }

  let hits = [];
  // zoom = false highlights the matching zip codes without moving the map
  function setPrefix(p, zoom = true) {
    prefix = p;
    hits = matches();
    fit(zoom && prefix.length >= 1 ? hits : []);
    kick();
    return describe();
  }

  function placeOf(i) {
    const [city, st] = D.places[place[i]].split("|");
    return { city, state: st };
  }

  function describe() {
    if (!prefix) return { text: "Every dot is a zip code. Tap the map, or type yours.", zip: null };
    if (!hits.length) return { text: "No zip codes start with " + prefix + ".", zip: null };
    if (prefix.length === 5) {
      const p = placeOf(hits[0]);
      return { text: titleCase(p.city) + ", " + p.state, zip: zips[hits[0]], place: p };
    }
    if (prefix.length >= 3) {
      // Name the area after its most common town
      const count = {};
      let top = null;
      for (const i of hits) { const k = D.places[place[i]]; count[k] = (count[k] || 0) + 1; if (!top || count[k] > count[top]) top = k; }
      const [city, st] = top.split("|");
      return { text: hits.length.toLocaleString() + " zip codes around " + titleCase(city) + ", " + st, zip: null };
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

    mix += (wantMix() - mix) * k;
    const s = baseScale() * view.s;
    const cy = H / 2 + (band().cy - H / 2) * mix;
    const ox = W / 2 - view.x * s, oy = cy - view.y * s;
    last = { s, ox, oy };
    // dots scale with the map so they read at any screen size
    const r = Math.max(W < 820 ? 1 : 1.5, Math.min(baseScale() * 2.1 + view.s * 0.22, 5));
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
    // An area (3-4 digits): outline it so it stands out even when the map isn't zoomed in
    if (hitSet && prefix.length >= 3 && prefix.length < 5 && hits.length) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const i of hits) {
        const px = xs[i] * s + ox, py = ys[i] * s + oy;
        if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
      }
      const pad = 14, cx = (x0 + x1) / 2, cyy = (y0 + y1) / 2;
      const rx = Math.max((x1 - x0) / 2 + pad, 24), ry = Math.max((y1 - y0) / 2 + pad, 24);
      ctx.beginPath(); ctx.ellipse(cx, cyy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 46, 99, 0.16)"; ctx.fill();
      ctx.setLineDash([6, 5]); ctx.lineWidth = 2.5; ctx.strokeStyle = "#ff2e63"; ctx.stroke(); ctx.setLineDash([]);
    }
    if (hitSet) {
      ctx.fillStyle = COLORS.hit;
      const hr = r + (prefix.length === 5 ? 6 : prefix.length >= 3 ? 2 : 0.8);
      for (const i of hits) {
        const px = xs[i] * s + ox, py = ys[i] * s + oy;
        ctx.fillRect(px - hr / 2, py - hr / 2, hr, hr);
      }
    }
    // One exact zip: draw a ring and its name
    const picked = prefix.length === 5 && hits.length ? hits[0] : -1;
    if (picked >= 0) {
      const p = placeOf(picked);
      marker(xs[picked] * s + ox, ys[picked] * s + oy, 22, titleCase(p.city) + ", " + p.state, "#ff2e63", "#fff");
    }
    // The dot under the pointer: a smaller ring with its zip and town
    if (hover >= 0 && hover !== picked) {
      const p = placeOf(hover);
      marker(xs[hover] * s + ox, ys[hover] * s + oy, 12, zips[hover] + " " + titleCase(p.city) + ", " + p.state, "#fff2a0", "#1d1d1d");
    }
    if (moving || intro < 1 || Math.abs(wantMix() - mix) > 0.001) kick();
  }

  function marker(px, py, radius, label, bg, fg) {
    ctx.strokeStyle = bg; ctx.lineWidth = radius > 15 ? 4 : 3;
    ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.font = (radius > 15 ? "800 18px" : "700 15px") + " Archivo, sans-serif";
    const tw = ctx.measureText(label).width, h = radius > 15 ? 30 : 24;
    let lx = px + radius + 8;
    if (lx + tw + 20 > W - 8) lx = px - radius - 8 - tw - 20; // flip to the left near the right edge
    ctx.fillStyle = bg; ctx.fillRect(lx, py - h / 2, tw + 20, h);
    ctx.fillStyle = fg; ctx.fillText(label, lx + 10, py + (radius > 15 ? 6 : 5));
  }

  // Nearest visible dot to a point on the screen, within `reach` pixels
  function nearest(clientX, clientY, reach) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left, y = clientY - rect.top;
    let best = -1, bestD = reach * reach;
    for (let i = 0; i < N; i++) {
      const dx = xs[i] * last.s + last.ox - x, dy = ys[i] * last.s + last.oy - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }
  function setHover(i) { if (i !== hover) { hover = i; kick(); } }

  window.addEventListener("resize", resize);
  resize();

  window.TaxMap = {
    setPrefix, lookup, setHover,
    settle() { settled = true; kick(); },
    zipAt(clientX, clientY, reach) { const i = nearest(clientX, clientY, reach); return i >= 0 ? zips[i] : null; },
    hoverAt(clientX, clientY) { setHover(nearest(clientX, clientY, 24)); return hover >= 0; }, zoomIn() { target.s *= 3; kick(); }, replayIntro() { introStart = performance.now(); kick(); } };
})();
