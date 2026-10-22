// "Read it to me": the tale read aloud, with a quiet music box underneath.
//
// Voices come from the browser's own speech (speechSynthesis), so there are no audio files and
// nothing to license. They sound different on every device. A woman narrates the story, like someone
// reading a bedtime book; Uncle Sam is a man's voice, slower and deeper, for his own lines (the
// chapter words and his chant).
//
// The music box is an original melody played with the Web Audio API, very quietly, only while the
// tale is being read. Its button (the music note) turns it off and remembers that choice.
(function () {
  const synth = window.speechSynthesis;
  const section = document.getElementById("story");
  const wrap = document.getElementById("tale-audio");
  const readBtn = document.getElementById("read-btn");
  const musicBtn = document.getElementById("music-btn");
  if (!section || !wrap || !synth || !window.SpeechSynthesisUtterance) return; // no speech: no button
  wrap.hidden = false;
  const label = readBtn.querySelector(".read-label");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- What gets read, in order: [element to highlight, words to say, who says them] ----
  const WORDS = ["Fee", "Fi", "Fo", "Fund"];
  const clean = el => el.textContent.replace(/\s+/g, " ").trim();
  function buildQueue() {
    const q = [];
    let chapter = 0;
    section.querySelectorAll(".story-steps > .step").forEach(step => {
      const opener = step.querySelector(".opener");
      if (opener) {
        // Uncle Sam booms the chapter word, then the narrator reads what it means
        const logo = opener.querySelector(".logo-step") || opener;
        q.push([logo, WORDS[chapter++] + "!", "sam"]);
        const def = opener.querySelector(".def-text");
        if (def) q.push([def, clean(def), "narrator"]);
        return;
      }
      step.querySelectorAll(".once, .storybook > p:not(.opener-kicker):not(.the-end), .end-list li, .scard h3, .scard p:not(.scard-kicker):not(.scard-src):not(.ledger-head), .per100, .ledger-rows, .snote")
        .forEach(el => {
          if (el.closest(".stub-rows")) return;
          let text = clean(el);
          if (el.matches(".per100, .ledger-rows")) text = [...el.children].map(c => clean(c)).join(". ");
          if (!text) return;
          q.push([el, text, el.matches(".chant") ? "sam" : "narrator"]);
        });
      if (step.querySelector(".the-end")) q.push([step.querySelector(".the-end"), "The end.", "narrator"]);
    });
    return q;
  }

  // ---- Picking the two voices from whatever this device has ----
  // Every voice gets a score and the best woman's and man's voice win. Natural-sounding voices score
  // highest: Apple's Premium and Enhanced voices (if they're downloaded on the Mac), Microsoft's
  // "Natural" voices (Edge), and Google's voices (Chrome). Apple's older built-in voices, like
  // Samantha, sound robotic, so they're only used if nothing better is there. Novelty voices are never used.
  let narrator = null, sam = null;
  const WOMEN = ["ava", "zoe", "evelyn", "allison", "susan", "joelle", "noelle", "nicky", "google us english", "google uk english female", "aria", "jenny", "emma", "michelle", "sonia", "libby", "natasha", "samantha", "karen", "moira", "tessa", "serena", "victoria", "zira"];
  const MEN = ["evan", "nathan", "tom", "aaron", "jamie", "oliver", "daniel", "arthur", "google uk english male", "andrew", "brian", "guy", "christopher", "eric", "ryan", "thomas", "william", "alex", "rishi", "david", "mark"];
  const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|fred|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|junior|ralph|kathy|grandma|grandpa|rocko|shelley|flo|eddy|reed|sandy/i;
  function score(v, names) {
    const n = v.name.toLowerCase();
    const i = names.findIndex(x => new RegExp("\\b" + x + "\\b").test(n));
    if (i < 0 || NOVELTY.test(n)) return -1;
    let s = 50 - i;                                   // earlier in the list = a little better
    if (/premium|natural|neural/.test(n)) s += 300;   // the most human-sounding
    else if (/enhanced/.test(n)) s += 200;
    else if (/^google/.test(n)) s += 150;
    else if (/^microsoft .*online/.test(n)) s += 150;
    if (/^(samantha|alex|daniel|karen|moira|tessa|victoria)$/.test(n)) s -= 30; // Apple's older voices
    if (!v.localService) s += 5;                      // online voices are usually smoother
    return s;
  }
  function best(all, names) {
    let top = null, topScore = -1;
    all.forEach(v => { const sc = score(v, names); if (sc > topScore) { top = v; topScore = sc; } });
    return top;
  }
  function pickVoices() {
    const all = synth.getVoices().filter(v => /^en(-|_|$)/i.test(v.lang));
    narrator = best(all, WOMEN) || all.find(v => !NOVELTY.test(v.name)) || null;
    sam = best(all, MEN) || narrator;
    // hover the button to see which voices this device picked
    readBtn.title = narrator ? `Narrator: ${narrator.name}${sam && sam !== narrator ? " · Uncle Sam: " + sam.name : ""}` : "";
  }
  pickVoices();
  if (synth.onvoiceschanged !== undefined) synth.addEventListener("voiceschanged", pickVoices);

  // ---- Reading ----
  let queue = [], at = 0, reading = false, lit = null;
  function light(el) {
    if (lit) lit.classList.remove("reading");
    lit = el;
    if (!el) return;
    el.classList.add("reading");
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  }
  function speakNext() {
    if (!reading) return;
    if (at >= queue.length) { stop(true); return; }
    const [el, text, who] = queue[at];
    light(el);
    // one sentence at a time: some voices (Google's, in Chrome) cut off partway through long lines
    // (a sentence ends at . ! ? followed by a space, so "$18.9 billion" stays in one piece)
    const parts = text.split(/(?<=[.!?…]["')\]]*)\s+/).filter(Boolean);
    let k = 0;
    const sayPart = () => {
      if (!reading) return;
      if (k >= parts.length) { at++; setTimeout(speakNext, who === "sam" ? 450 : 250); return; }
      const u = makeUtterance(parts[k++].trim(), who);
      u.onend = sayPart;
      u.onerror = e => { if (reading && e.error !== "interrupted" && e.error !== "canceled") sayPart(); };
      synth.speak(u);
    };
    sayPart();
  }
  function makeUtterance(text, who) {
    const u = new SpeechSynthesisUtterance(text);
    const v = who === "sam" ? sam : narrator;
    if (v) u.voice = v;
    u.lang = (v && v.lang) || "en-US";
    // storytelling pace: the narrator a little slower than normal speech, Uncle Sam slower and deeper
    // (much deeper if he has to borrow the narrator's voice)
    if (who === "sam") { u.pitch = sam === narrator ? 0.4 : 0.8; u.rate = 0.8; u.volume = 1; }
    else { u.pitch = 1.0; u.rate = 0.9; u.volume = 1; }
    return u;
  }
  // Start from whatever part of the tale is on screen now (or the beginning)
  function startIndex() {
    const mid = window.innerHeight * 0.35;
    const i = queue.findIndex(([el]) => el.getBoundingClientRect().bottom > mid);
    return i < 0 ? 0 : i;
  }
  function start() {
    queue = buildQueue();
    if (at <= 0 || at >= queue.length) at = startIndex();
    reading = true;
    synth.cancel();
    setUI();
    if (musicOn) Music.start();
    speakNext();
  }
  function stop(finished) {
    reading = false;
    synth.cancel();
    Music.stop();
    light(null);
    if (finished) at = 0; // next time starts from wherever you are
    setUI();
  }
  function setUI() {
    readBtn.setAttribute("aria-pressed", String(reading));
    label.textContent = reading ? "Pause" : at > 0 ? "Keep reading" : "Read it to me";
    readBtn.classList.toggle("is-reading", reading);
    musicBtn.hidden = !reading;
  }
  readBtn.addEventListener("click", () => (reading ? stop(false) : start()));
  // Leaving the tale (Open my file, the logo, a new page) stops the reading
  ["tale-file", "story-cta", "tale-home"].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.addEventListener("click", () => { if (reading) stop(true); });
  });
  window.addEventListener("pagehide", () => synth.cancel());

  // ---- The music box ----
  let musicOn = true;
  try { musicOn = localStorage.getItem("ffff-music") !== "off"; } catch (e) {}
  musicBtn.setAttribute("aria-pressed", String(musicOn));
  musicBtn.addEventListener("click", () => {
    musicOn = !musicOn;
    musicBtn.setAttribute("aria-pressed", String(musicOn));
    try { localStorage.setItem("ffff-music", musicOn ? "on" : "off"); } catch (e) {}
    if (musicOn && reading) Music.start(); else Music.stop();
  });

  // An original little tune in C major pentatonic, two bars of melody over a slow bass.
  // 0 = rest. Numbers are semitones above middle C.
  const Music = (function () {
    const MELODY = [12, 0, 16, 19, 16, 0, 14, 12, 9, 0, 12, 14, 12, 0, 0, 0,
                    12, 0, 16, 19, 21, 0, 19, 16, 14, 0, 16, 14, 12, 0, 0, 0,
                    9, 0, 12, 14, 16, 0, 14, 12, 7, 0, 9, 12, 14, 0, 0, 0,
                    16, 0, 14, 12, 9, 0, 12, 14, 12, 0, 0, 0, 0, 0, 0, 0];
    const BASS = [-12, -5, -3, -8]; // one note per 16 steps
    const STEP = 0.32;               // seconds per step: slow and sleepy
    let ctx = null, out = null, timer = 0, next = 0, step = 0, running = false;
    const hz = n => 261.63 * Math.pow(2, n / 12);

    function setup() {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return false;
      ctx = ctx || new C();
      if (!out) {
        out = ctx.createGain();
        out.gain.value = 0;
        // a soft echo so it sounds like a little music box in a room
        const delay = ctx.createDelay(); delay.delayTime.value = STEP * 1.5;
        const fb = ctx.createGain(); fb.gain.value = 0.28;
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600;
        out.connect(ctx.destination);
        out.connect(delay); delay.connect(fb); fb.connect(lp); lp.connect(delay); lp.connect(ctx.destination);
      }
      return true;
    }
    // A plucked, bell-like note: a sine plus a quieter overtone, fading out fast
    function pluck(freq, t, vol, len) {
      [[1, vol], [3, vol * 0.18], [4.2, vol * 0.06]].forEach(([mult, v]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine"; o.frequency.value = freq * mult;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(v, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len / mult);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + len + 0.05);
      });
    }
    function tick() {
      while (next < ctx.currentTime + 0.25) {
        const n = MELODY[step % MELODY.length];
        if (n) pluck(hz(n), next, 0.5, 1.4);
        if (step % 16 === 0) pluck(hz(BASS[(step / 16) % BASS.length]), next, 0.35, 2.6);
        next += STEP; step++;
      }
    }
    return {
      start() {
        if (running || !setup()) return;
        if (ctx.state === "suspended") ctx.resume();
        running = true; step = 0; next = ctx.currentTime + 0.1;
        // very low: it sits well under the voice
        out.gain.cancelScheduledValues(ctx.currentTime);
        out.gain.setTargetAtTime(0.05, ctx.currentTime, 0.8);
        timer = setInterval(tick, 80); tick();
      },
      stop() {
        if (!running) return;
        running = false; clearInterval(timer);
        out.gain.cancelScheduledValues(ctx.currentTime);
        out.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
      }
    };
  })();
})();
