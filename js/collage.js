// Builds the results collage: one tile per category, sized by how much money it got.
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
    if (rest > level.total * 0.002) items.push({ cat: byKey.other, value: rest });
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

  function render(level, container, onPick) {
    container.innerHTML = "";
    const items = breakdown(level);
    items.forEach((it, idx) => {
      const t = tier(it.share);
      const tile = el("button", "tile t" + t);
      tile.type = "button";
      tile.style.setProperty("--bg", it.cat.color);
      tile.style.setProperty("--rot", ((jitter(it.cat.key, 1) - 0.5) * 5).toFixed(2) + "deg");
      tile.style.setProperty("--img-rot", ((jitter(it.cat.key, 2) - 0.5) * 16).toFixed(1) + "deg");
      tile.style.setProperty("--dx", ((jitter(it.cat.key, 3) - 0.5) * 30).toFixed(1) + "%");
      tile.style.setProperty("--dy", ((jitter(it.cat.key, 4) - 0.3) * 24).toFixed(1) + "%");
      tile.style.setProperty("--delay", reduced ? "0ms" : idx * 55 + "ms");
      tile.setAttribute("aria-label", `${it.cat.label}: $${it.share.toFixed(2)} of every $100, ${money(it.value, level.unit)}`);

      const dollars = Math.floor(it.share);
      const cents = Math.round((it.share - dollars) * 100).toString().padStart(2, "0");
      const num = el("span", "num");
      num.append(el("span", "num-sign", "$"), el("span", "num-d", String(dollars)), el("span", "num-c", "." + cents));

      const pic = el("span", "pic");
      const img = el("img");
      img.src = it.cat.img;
      img.alt = "";
      img.loading = "lazy";
      pic.appendChild(img);
      if (idx === 0) pic.appendChild(googlyEyes());

      tile.append(pic, num, el("span", "tag", it.cat.label), el("span", "amt", money(it.value, level.unit)));
      tile.addEventListener("click", () => onPick(it.cat));
      container.appendChild(tile);

      if (!reduced) {
        tile.classList.add("slap");
        tile.addEventListener("animationend", () => tile.classList.remove("slap"), { once: true });
      }
    });

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

  window.Collage = { render, breakdown, money, byKey };
})();
