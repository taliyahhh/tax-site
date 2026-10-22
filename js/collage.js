// Builds the results collage: one floating object per category, sized by how much money it got.
(function () {
  const CATS = window.CATEGORIES;
  const byKey = Object.fromEntries(CATS.map(c => [c.key, c]));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function money(value, unit) {
    const d = value * unit;
    if (d >= 1e12) return "$" + (d / 1e12).toFixed(2) + " trillion";
    if (d >= 1e11) return "$" + Math.round(d / 1e9) + " billion";
    if (d >= 1e9) return "$" + (d / 1e9).toFixed(1) + " billion";
    if (d >= 1e6) return "$" + (d / 1e6).toFixed(1) + " million";
    return "$" + Math.round(d / 1e3) + "K";
  }

  // Returns [{cat, value, share}] sorted biggest first, with "Everything else" filled in.
  function breakdown(level) {
    const items = Object.entries(level.values).map(([k, v]) => ({ cat: byKey[k], value: v }));
    const listed = items.reduce((t, i) => t + i.value, 0);
    const rest = level.total - listed;
    // some data already has an "other" amount: add the leftover to it instead of making a second "Everything else"
    const other = items.find(i => i.cat.key === "other");
    if (other && rest > 0) other.value += rest;
    else if (rest > level.total * 0.002) items.push({ cat: byKey.other, value: rest });
    items.forEach(i => (i.share = (i.value / level.total) * 100));
    return items.sort((a, b) => b.value - a.value);
  }

  function tier(share) {
    if (share >= 20) return 4;
    if (share >= 9) return 3;
    if (share >= 3) return 2;
    return 1;
  }

  // Small deterministic "random" so the collage looks the same every visit
  function jitter(key, n) {
    let h = 0;
    for (const ch of key + n) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return ((h % 1000) + 1000) % 1000 / 1000;
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function googlyEyes() {
    const eyes = el("span", "eyes");
    eyes.setAttribute("aria-hidden", "true");
    eyes.append(el("span", "eye"), el("span", "eye"));
    eyes.querySelectorAll(".eye").forEach(e => e.appendChild(el("span", "pupil")));
    return eyes;
  }

  // Image for a category: its GIF (the "anim" field in data/categories.js) if it has one,
  // otherwise the still cutout. People with "reduce motion" on always get the still.
  function animSrc(cat) {
    return !reduced && cat.anim ? cat.anim : cat.img;
  }

  // Seeded random numbers so each category lands in the same spot every visit
  function rng(seed) {
    let h = 2166136261;
    for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return () => {
      h += 0x6d2b79f5;
      let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Scatter the objects across the page. Size follows money (area matches share),
  // and each object is dropped at the open spot farthest from everything already placed,
  // so they spread out instead of lining up in a grid.
  function layout(container) {
    const objs = [...container.querySelectorAll(".obj")];
    if (!objs.length) return;
    const W = container.clientWidth;
    const narrow = W < 700;
    const k = narrow ? 1.25 : 0.72;
    // the biggest sticker is capped (about a third of the page) so one GIF never fills the screen
    const maxS = Math.min(W * (narrow ? 0.62 : 0.3), narrow ? 260 : 400);
    const minS = Math.max(narrow ? 88 : 116, W * (narrow ? 0.25 : 0.095));
    const gap = narrow ? 2 : -4; // a hair of overlap on desktop feels cut-and-paste

    // footprint = the picture plus the price tag hanging under it
    const tagW = narrow ? 138 : 150;
    const items = objs.map(o => {
      const s = Math.round(Math.min(maxS, Math.max(minS, W * k * Math.sqrt(+o.dataset.share / 100))));
      const w = Math.min(W, Math.max(s, tagW));
      const h = s * 0.88 + (narrow ? 64 : 62);
      return { o, s, w, h };
    });
    const area = items.reduce((t, i) => t + i.w * i.h, 0);
    let H = Math.max(items[0].h * 1.1, area / (narrow ? 0.66 : 0.6) / W);

    const placed = [];
    items.forEach(it => {
      const rand = rng(it.o.dataset.key + "|" + Math.round(W / 50));
      let best = null;
      for (let attempt = 0; attempt < 8 && !(best && best.score >= 0); attempt++) {
        for (let c = 0; c < 120; c++) {
          const x = it.w / 2 + rand() * Math.max(1, W - it.w);
          const y = it.h / 2 + rand() * Math.max(1, H - it.h);
          let score = Infinity;
          for (const p of placed) {
            // gap between the two footprints (negative means they overlap)
            const d = Math.max(Math.abs(x - p.x) - (it.w + p.w) / 2, Math.abs(y - p.y) - (it.h + p.h) / 2) - gap;
            if (d < score) score = d;
          }
          if (!best || score > best.score) best = { x, y, score };
        }
        if (best.score < 0) H *= 1.1; // no room: make the page taller and try again
      }
      placed.push({ x: best.x, y: best.y, w: it.w, h: it.h, it });
    });

    // Phones: slide each object up into any empty space above it, so the column
    // doesn't end up with big blank gaps (left/right positions stay as they were)
    if (narrow) {
      const minGap = 14;
      const byTop = [...placed].sort((a, b) => (a.y - a.h / 2) - (b.y - b.h / 2));
      const done = [];
      for (const p of byTop) {
        let floor = 0;
        for (const q of done) {
          const overlapX = Math.abs(p.x - q.x) < (p.w + q.w) / 2 + 4;
          if (overlapX) floor = Math.max(floor, q.y + q.h / 2 + minGap);
        }
        const top = Math.min(p.y - p.h / 2, Math.max(0, floor));
        p.y = top + p.h / 2;
        done.push(p);
      }
    }

    placed.forEach(p => {
      const it = p.it;
      Object.assign(it.o.style, {
        width: it.s + "px",
        left: (p.x - it.s / 2).toFixed(1) + "px",
        top: (p.y - it.h / 2).toFixed(1) + "px"
      });
      it.o.style.setProperty("--s", it.s + "px");
    });

    // The big price number hangs off one side of each picture; nudge the object
    // back in if its number would stick out past the edge of the page
    placed.forEach(p => {
      const o = p.it.o, num = o.querySelector(".num");
      if (!num) return;
      const objLeft = p.x - p.it.s / 2;
      const l = objLeft + num.offsetLeft - 6, r = l + num.offsetWidth + 12;
      let shift = 0;
      if (r > W) shift = W - r;
      if (l + shift < 0) shift = -l;
      if (shift) o.style.left = (objLeft + shift).toFixed(1) + "px";
    });
    const bottom = Math.max(...placed.map(p => p.y + p.h / 2));
    container.style.height = Math.ceil(bottom + (narrow ? 40 : 60)) + "px";
  }

  function render(level, container, onPick) {
    container.innerHTML = "";
    container.classList.add("scatter");
    const items = breakdown(level);
    items.forEach((it, idx) => {
      const key = it.cat.key;
      const obj = el("button", "obj" + (idx === 0 ? " is-top" : ""));
      obj.type = "button";
      obj.dataset.key = key;
      obj.dataset.share = it.share;
      obj.style.setProperty("--tint", it.cat.color);
      obj.style.setProperty("--rot", ((jitter(key, 1) - 0.5) * 18).toFixed(1) + "deg");
      obj.style.setProperty("--num-rot", ((jitter(key, 2) - 0.5) * 16).toFixed(1) + "deg");
      obj.style.setProperty("--tag-rot", ((jitter(key, 5) - 0.5) * 10).toFixed(1) + "deg");
      obj.style.setProperty("--bob", (3.4 + jitter(key, 3) * 2.6).toFixed(2) + "s");
      obj.style.setProperty("--bob-delay", (-jitter(key, 4) * 4).toFixed(2) + "s");
      obj.style.setProperty("--delay", reduced ? "0ms" : idx * 70 + "ms");
      if (jitter(key, 7) > 0.5) obj.classList.add("num-right");
      obj.setAttribute("aria-label", `${it.cat.label}: $${it.share.toFixed(2)} of every $100, ${money(it.value, level.unit)}`);

      // round to the cent first, so 42.999 shows as $43.00 instead of $42.100
      const allCents = Math.round(it.share * 100);
      const dollars = Math.floor(allCents / 100);
      const cents = String(allCents % 100).padStart(2, "0");
      const num = el("span", "num");
      num.append(el("span", "num-sign", "$"), el("span", "num-d", String(dollars)), el("span", "num-c", "." + cents));

      const pic = el("span", "pic");
      const img = el("img");
      img.alt = "";
      img.decoding = "async";
      img.addEventListener("error", () => { if (img.src.indexOf(it.cat.img) === -1) img.src = it.cat.img; }, { once: true });
      img.src = animSrc(it.cat);
      pic.appendChild(img);
      if (idx === 0) pic.appendChild(googlyEyes());

      const label = el("span", "label");
      label.append(el("span", "tag", it.cat.label), el("span", "amt", money(it.value, level.unit)));

      obj.append(pic, num, label);
      obj.addEventListener("click", () => onPick(it.cat));
      container.appendChild(obj);
    });

    layout(container);
    if (!container._watch) {
      let lastW = container.clientWidth, timer;
      container._watch = new ResizeObserver(() => {
        if (container.clientWidth === lastW) return;
        lastW = container.clientWidth;
        clearTimeout(timer);
        timer = setTimeout(() => layout(container), 120);
      });
      container._watch.observe(container);
    }

    const present = new Set(items.map(i => i.cat.key));
    return CATS.filter(c => !c.extra && !present.has(c.key));
  }

  // Googly eyes follow the pointer
  window.addEventListener("pointermove", e => {
    document.querySelectorAll(".eye").forEach(eye => {
      const r = eye.getBoundingClientRect();
      const a = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
      const p = eye.firstChild;
      const d = r.width * 0.22;
      p.style.transform = `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px)`;
    });
  });

  window.Collage = { render, breakdown, money, byKey, animSrc };
})();
