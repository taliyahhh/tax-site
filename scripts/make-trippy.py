#!/usr/bin/env python3
"""
Turns every cutout in assets/cutouts/ into a looping, psychedelic animation in assets/trippy/.

Each frame melts the image with a slow liquid wobble, drifts its colors, and drags
neon "echo" outlines behind it. The output is animated WebP: it plays like a GIF but
keeps soft transparent edges (GIFs make cutouts look jagged).

Run it again any time you swap in a new cutout:

    pip install pillow numpy
    python3 scripts/make-trippy.py              # all cutouts
    python3 scripts/make-trippy.py roads.png    # just one

The site uses assets/trippy/<name>.webp if it exists and falls back to the PNG.
You can also drop in a real GIF or WebP you found: save it as assets/trippy/<name>.webp
(or point the category's "anim" field in data/categories.js at any file).
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "cutouts"
OUT = ROOT / "assets" / "trippy"

FRAMES = 28          # frames per loop
MS = 75              # ms per frame (about 2 seconds per loop)
CANVAS = 360         # output size in px
SUBJECT = 270        # size of the object inside the canvas (room for echoes)
ECHOES = [           # neon outlines trailing behind the object: color, lag, opacity
    ((255, 46, 99), 0.10, 0.85),
    ((63, 184, 255), 0.22, 0.70),
    ((214, 255, 63), 0.34, 0.55),
]


def fit(img):
    img = img.convert("RGBA")
    box = img.getbbox()
    if box:
        img = img.crop(box)
    w, h = img.size
    s = SUBJECT / max(w, h)
    img = img.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS))
    canvas.paste(img, ((CANVAS - img.width) // 2, (CANVAS - img.height) // 2))
    return np.asarray(canvas).astype(np.float32) / 255.0


def sample(arr, xs, ys):
    """Bilinear sample arr (H, W, C) at float coords."""
    h, w = arr.shape[:2]
    xs = np.clip(xs, 0, w - 1.001)
    ys = np.clip(ys, 0, h - 1.001)
    x0, y0 = xs.astype(int), ys.astype(int)
    fx, fy = (xs - x0)[..., None], (ys - y0)[..., None]
    a, b = arr[y0, x0], arr[y0, x0 + 1]
    c, d = arr[y0 + 1, x0], arr[y0 + 1, x0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def melt(arr, phase, amp=7.0):
    """Liquid wobble: rows and columns sway on sine waves."""
    h, w = arr.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    dx = amp * np.sin(yy / 23.0 + phase) + amp * 0.5 * np.sin(yy / 9.0 - phase * 2)
    dy = amp * 0.8 * np.sin(xx / 29.0 + phase * 1.0)
    return sample(arr, xx + dx, yy + dy)


def hue_shift(rgb, degrees, sat=1.35):
    """Rotate hue in YIQ space (fast, no HSV round trip) and boost saturation."""
    t = np.radians(degrees)
    to_yiq = np.array([[0.299, 0.587, 0.114], [0.596, -0.274, -0.322], [0.211, -0.523, 0.312]])
    from_yiq = np.linalg.inv(to_yiq)
    rot = np.array([[1, 0, 0], [0, np.cos(t) * sat, -np.sin(t) * sat], [0, np.sin(t) * sat, np.cos(t) * sat]])
    m = from_yiq @ rot @ to_yiq
    return np.clip(rgb @ m.T, 0, 1)


def shift(arr, dx, dy):
    h, w = arr.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    out = sample(arr, xx - dx, yy - dy)
    out[(xx - dx < 0) | (xx - dx > w - 1) | (yy - dy < 0) | (yy - dy > h - 1)] = 0
    return out


def over(dst, src):
    a = src[..., 3:4]
    out_a = a + dst[..., 3:4] * (1 - a)
    out_rgb = (src[..., :3] * a + dst[..., :3] * dst[..., 3:4] * (1 - a)) / np.maximum(out_a, 1e-6)
    return np.concatenate([out_rgb, out_a], axis=-1)


def frame(base, i):
    t = i / FRAMES
    phase = 2 * np.pi * t
    out = np.zeros_like(base)

    # neon echoes orbit behind the object, each a little behind in time
    for color, lag, alpha in reversed(ECHOES):
        p = phase - lag * 2 * np.pi
        r = 10 + 30 * lag
        ghost = melt(base, p)
        ghost = shift(ghost, r * np.cos(p), r * np.sin(p) * 0.7)
        g = np.zeros_like(ghost)
        g[..., :3] = np.array(color) / 255.0
        g[..., 3] = ghost[..., 3] * alpha
        out = over(out, g)

    main = melt(base, phase)
    main[..., :3] = hue_shift(main[..., :3], 75 * np.sin(phase))
    out = over(out, main)
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8), "RGBA")


def make(path):
    base = fit(Image.open(path))
    frames = [frame(base, i) for i in range(FRAMES)]
    OUT.mkdir(parents=True, exist_ok=True)
    dest = OUT / (path.stem + ".webp")
    frames[0].save(dest, save_all=True, append_images=frames[1:], duration=MS, loop=0,
                   quality=72, method=6, lossless=False, exact=False)
    print(f"{path.name} -> {dest.relative_to(ROOT)} ({dest.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    names = sys.argv[1:]
    files = [SRC / n for n in names] if names else sorted(SRC.glob("*.png"))
    for f in files:
        make(f)
