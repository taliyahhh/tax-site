#!/usr/bin/env python3
"""
Records the tale for "Read it to me" with the Kokoro voice model (free, open source, Apache 2.0).

It reads every line marked data-read in index.html (the same lines js/readaloud.js reads, in the
same order), records each one as an MP3 in assets/audio/, and writes assets/audio/manifest.json so
the site knows which file goes with which line. Run it again whenever the tale's words change:
only new or changed lines are recorded, and old files that nothing uses are deleted.

One-time setup on a Mac (Kokoro needs Python 3.10 to 3.12):
    conda create -n kokoro python=3.11 -y
    conda activate kokoro
    pip install kokoro soundfile

Then, from the tax-site folder:
    conda activate kokoro
    python scripts/make-audio.py              record the tale
    python scripts/make-audio.py --samples    hear a few voices first (saved to voice-samples/)

The first run downloads the model (about 330 MB), so it takes a few minutes. After that it's quick.
"""
import argparse
import html.parser
import json
import math
import re
import sys
from pathlib import Path

# ---- The two voices. Run with --samples to hear the options, then change these if you like. ----
NARRATOR = "af_heart"   # a warm American woman's voice: the storyteller
UNCLE_SAM = "am_fenrir" # a deeper American man's voice: Uncle Sam
NARRATOR_SPEED = 0.92   # a little slower than normal speech, like reading aloud
SAM_SPEED = 0.82        # slower still, so he booms

SAMPLE_VOICES = ["af_heart", "af_bella", "af_nicole", "bf_emma", "am_fenrir", "am_michael", "am_puck", "bm_george", "bm_fable"]
SAMPLE_TEXT = "Once upon a time, a giant at the top of a very tall beanstalk took his share. His name is Uncle Sam. Fee. Fi. Fo. Fund."

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / "assets" / "audio"
RATE = 24000  # Kokoro's sample rate


# ---- Which lines get read: the same rules as words() in js/readaloud.js ----
def tidy(text):
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s+([.,!?;:])", r"\1", text)
    return text.strip()


class Lines(html.parser.HTMLParser):
    """Collects each data-read element's words, in page order."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.lines, self.tag, self.depth, self.buf, self.cur = [], None, 0, [], None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if self.tag is None:
            if "data-read" in a:
                self.tag, self.depth, self.buf = tag, 1, []
                self.cur = {"who": "sam" if a.get("data-voice") == "sam" else "narrator", "say": a.get("data-say"), "id": a.get("id")}
            return
        if tag == self.tag:
            self.depth += 1
        self.buf.append(" ")

    def handle_startendtag(self, tag, attrs):
        if self.tag is not None:
            self.buf.append(" ")
        elif "data-read" in dict(attrs):
            a = dict(attrs)
            self.lines.append({"who": "sam" if a.get("data-voice") == "sam" else "narrator", "say": a.get("data-say"), "id": a.get("id"), "text": ""})

    def handle_endtag(self, tag):
        if self.tag is None:
            return
        if tag == self.tag:
            self.depth -= 1
            if self.depth == 0:
                self.cur["text"] = "".join(self.buf)
                self.lines.append(self.cur)
                self.tag = None
                return
        self.buf.append(" ")

    def handle_data(self, data):
        if self.tag is not None:
            self.buf.append(data)


def per100_sentence():
    """The 'out of every $100' list is filled in by js/story.js from the federal budget; build the same sentence here."""
    budgets = (ROOT / "data" / "budgets.js").read_text(encoding="utf-8")
    cats = (ROOT / "data" / "categories.js").read_text(encoding="utf-8")
    fed = budgets[budgets.index("federal:"):budgets.index("states:")]
    total = float(re.search(r"total:\s*([\d.]+)", fed).group(1))
    block = fed[fed.index("values:"):]
    block = block[:block.index("}")]
    values = [(k, float(v)) for k, v in re.findall(r"^\s*(\w+):\s*([\d.]+)", block, re.M)]
    labels = dict(re.findall(r'key:\s*"(\w+)",\s*label:\s*"([^"]+)"', cats))
    top = sorted(values, key=lambda kv: -kv[1])[:4]
    top = [(labels.get(k, k), math.floor(v / total * 100 + 0.5)) for k, v in top]
    rest = 100 - sum(n for _, n in top)
    said = lambda name: (name if name == "Social Security" else name[:1].lower() + name[1:]).replace("&", "and")
    return ", ".join(f"${n} for {said(name)}" for name, n in top) + f", and ${rest} for everything else."


def tale_lines():
    p = Lines()
    p.feed((ROOT / "index.html").read_text(encoding="utf-8"))
    out = []
    for ln in p.lines:
        if ln["say"] is not None:
            words = re.sub(r"\s+", " ", ln["say"]).strip()
        elif ln["id"] == "per100":
            words = per100_sentence()
        else:
            words = tidy(ln["text"])
        if words:
            out.append((ln["who"], words))
    return out


def fingerprint(who, words):
    """FNV-1a of 'who|words' as 8 hex digits: the same as key() in js/readaloud.js."""
    h = 0x811C9DC5
    for b in f"{who}|{words}".encode("utf-8"):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"


# ---- Recording ----
def load_kokoro():
    try:
        from kokoro import KPipeline
        import numpy as np
        import soundfile as sf
    except ImportError:
        sys.exit("Kokoro isn't installed in this Python. Run:\n  conda activate kokoro\n  pip install kokoro soundfile")
    return KPipeline, np, sf


def record(pipe, np, text, voice, speed):
    chunks = []
    for result in pipe(text, voice=voice, speed=speed):
        audio = result[2] if isinstance(result, tuple) else getattr(result, "audio", None)
        if audio is None:
            continue
        audio = audio.cpu().numpy() if hasattr(audio, "cpu") else np.asarray(audio)
        chunks.append(audio)
        chunks.append(np.zeros(int(RATE * 0.15), dtype=audio.dtype))  # a short breath between phrases
    return np.concatenate(chunks) if chunks else None


def save(sf, path_no_ext, audio):
    """MP3 plays everywhere; if this soundfile can't write MP3, fall back to WAV (bigger, still plays everywhere)."""
    try:
        sf.write(str(path_no_ext) + ".mp3", audio, RATE, format="MP3")
        return path_no_ext.name + ".mp3"
    except Exception:
        sf.write(str(path_no_ext) + ".wav", audio, RATE)
        return path_no_ext.name + ".wav"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--samples", action="store_true", help="record one short sample per voice to voice-samples/")
    ap.add_argument("--list", action="store_true", help="just print the lines that would be recorded")
    ap.add_argument("--redo", action="store_true", help="record every line again, even ones already recorded")
    args = ap.parse_args()

    lines = tale_lines()
    if args.list:
        for who, words in lines:
            print(f"{fingerprint(who, words)}  {who:9}  {words}")
        return

    KPipeline, np, sf = load_kokoro()
    pipe = KPipeline(lang_code="a")  # American English (works for the British voices too)

    if args.samples:
        out = ROOT / "voice-samples"
        out.mkdir(exist_ok=True)
        for v in SAMPLE_VOICES:
            audio = record(pipe, np, SAMPLE_TEXT, v, 0.92)
            if audio is not None:
                print("saved", out / save(sf, out / v, audio))
        print("\nListen, then set NARRATOR and UNCLE_SAM at the top of this script and run it without --samples.")
        return

    AUDIO.mkdir(parents=True, exist_ok=True)
    files, made, kept = {}, 0, 0
    for i, (who, words) in enumerate(lines, 1):
        k = fingerprint(who, words)
        existing = next((f for f in (AUDIO / (k + ".mp3"), AUDIO / (k + ".wav")) if f.exists()), None)
        if existing and not args.redo:
            files[k] = existing.name
            kept += 1
            continue
        voice, speed = (UNCLE_SAM, SAM_SPEED) if who == "sam" else (NARRATOR, NARRATOR_SPEED)
        print(f"[{i}/{len(lines)}] {who}: {words[:70]}{'...' if len(words) > 70 else ''}")
        audio = record(pipe, np, words, voice, speed)
        if audio is None:
            print("   (no audio came back for this line; the site will use the device's voice for it)")
            continue
        files[k] = save(sf, AUDIO / k, audio)
        made += 1

    # remove recordings nothing uses anymore
    for f in AUDIO.glob("*"):
        if f.suffix in (".mp3", ".wav") and f.name not in files.values():
            f.unlink()
    (AUDIO / "manifest.json").write_text(json.dumps({
        "voices": {"narrator": NARRATOR, "sam": UNCLE_SAM},
        "files": files,
    }, indent=1) + "\n", encoding="utf-8")
    print(f"\nDone: {made} recorded, {kept} already done, {len(files)} total. Commit assets/audio/ and push.")


if __name__ == "__main__":
    main()
