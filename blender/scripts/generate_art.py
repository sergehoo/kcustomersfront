"""Generates the villa's abstract canvases (our own work, no licence needed).

Five large-format pieces in the house palette — sand, ochre, terracotta,
charcoal, ivory, a little gold — painted procedurally: soft-edged masses,
gestural bands and a fine canvas grain, so they read as paint on linen and not
as flat vector shapes.

    python3 blender/scripts/generate_art.py

Writes assets-source/art/*.png, which furnish_interiors.py maps onto canvases.
"""

import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'assets-source', 'art')

SAND = (214, 199, 176)
IVORY = (236, 230, 218)
OCHRE = (190, 136, 72)
TERRACOTTA = (164, 92, 64)
CHARCOAL = (44, 42, 40)
GOLD = (196, 160, 92)
SAGE = (142, 146, 124)
STONE = (168, 160, 148)


def grain(h, w, rng, strength=10.0):
    """Linen weave plus paint tooth."""
    y, x = np.mgrid[0:h, 0:w]
    weave = (np.sin(x * 1.9) + np.sin(y * 2.1)) * .5
    noise = rng.normal(0, 1, (h, w))
    return (weave * .35 + noise * .65) * strength


def blob(h, w, cx, cy, rx, ry, rng, wobble=.18, softness=.06):
    """A soft-edged organic mass (0–1 mask)."""
    y, x = np.mgrid[0:h, 0:w]
    angle = np.arctan2((y - cy) / ry, (x - cx) / rx)
    radius = np.hypot((x - cx) / rx, (y - cy) / ry)
    edge = 1 + wobble * (np.sin(angle * 3 + rng.uniform(0, 6)) * .6 + np.sin(angle * 7 + rng.uniform(0, 6)) * .4)
    return np.clip((edge - radius) / softness, 0, 1)


def band(h, w, x0, x1, rng, softness=10, drift=24):
    """A vertical brushed band with a wavering edge."""
    y, x = np.mgrid[0:h, 0:w]
    wave = np.sin(y / h * np.pi * rng.uniform(1.5, 3)) * drift + rng.normal(0, 2, (h, 1))
    left = np.clip((x - (x0 + wave)) / softness, 0, 1)
    right = np.clip(((x1 + wave) - x) / softness, 0, 1)
    return left * right


def paint(base, layers, h, w, rng, grain_strength=9.0):
    img = np.ones((h, w, 3)) * np.array(base, float)
    for mask, colour, opacity in layers:
        mask = mask[..., None] * opacity
        img = img * (1 - mask) + np.array(colour, float) * mask
    img += grain(h, w, rng, grain_strength)[..., None]
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.6))


def strokes(h, w, rng, count, colour_mask_scale=1.0):
    """Long dry-brush strokes as a mask."""
    canvas = Image.new('L', (w, h), 0)
    arr = np.zeros((h, w))
    for _ in range(count):
        y0 = rng.uniform(.15, .85) * h
        thickness = rng.uniform(.015, .05) * h
        x0, x1 = rng.uniform(.05, .3) * w, rng.uniform(.6, .95) * w
        yy, xx = np.mgrid[0:h, 0:w]
        curve = y0 + np.sin((xx - x0) / w * np.pi * rng.uniform(.6, 1.4)) * rng.uniform(-.06, .06) * h
        inside = (np.abs(yy - curve) < thickness) & (xx > x0) & (xx < x1)
        dry = rng.uniform(0, 1, (h, w)) > .25
        arr = np.maximum(arr, (inside & dry) * colour_mask_scale)
    return Image.fromarray((arr * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2))


def main():
    os.makedirs(OUT, exist_ok=True)
    rng = np.random.default_rng(7)

    # 1. Living — large landscape: ochre and charcoal masses on sand.
    h, w = 720, 1080
    art = paint(SAND, [
        (blob(h, w, w * .36, h * .55, w * .26, h * .34, rng), OCHRE, .92),
        (blob(h, w, w * .66, h * .42, w * .2, h * .3, rng), CHARCOAL, .88),
        (blob(h, w, w * .55, h * .72, w * .12, h * .1, rng, softness=.12), TERRACOTTA, .7),
        (band(h, w, w * .79, w * .8, rng, softness=2, drift=6), GOLD, .9),
    ], h, w, rng)
    art.save(os.path.join(OUT, 'art_living.png'))

    # 2. Hall — portrait: terracotta and ivory bands, one gold line.
    h, w = 1080, 760
    art = paint(IVORY, [
        (band(h, w, w * .12, w * .44, rng, softness=14), TERRACOTTA, .9),
        (band(h, w, w * .5, w * .78, rng, softness=14), STONE, .75),
        (band(h, w, w * .83, w * .85, rng, softness=2, drift=4), GOLD, .95),
    ], h, w, rng)
    art.save(os.path.join(OUT, 'art_hall.png'))

    # 3. Suite — calm horizon: sage and sand fields, soft charcoal line.
    h, w = 600, 1200
    yy = np.mgrid[0:h, 0:w][0]
    lower = np.clip((yy - h * .58) / 30, 0, 1)
    art = paint(IVORY, [
        (lower, SAND, .95),
        (blob(h, w, w * .3, h * .38, w * .2, h * .18, rng, wobble=.08, softness=.2), SAGE, .55),
        (np.array(strokes(h, w, rng, 3)) / 255.0, CHARCOAL, .65),
    ], h, w, rng, grain_strength=7)
    art.save(os.path.join(OUT, 'art_suite.png'))

    # 4. Dining / landing — a single ochre sun on charcoal.
    h, w = 900, 900
    art = paint(CHARCOAL, [
        (blob(h, w, w * .5, h * .46, w * .27, h * .27, rng, wobble=.03, softness=.03), OCHRE, .95),
        (np.clip((np.mgrid[0:h, 0:w][0] - h * .74) / 6, 0, 1), STONE, .35),
    ], h, w, rng, grain_strength=8)
    art.save(os.path.join(OUT, 'art_sun.png'))

    # 5. Bedroom 2 / upper lounge — gestural strokes on stone.
    h, w = 800, 1000
    art = paint(STONE, [
        (np.array(strokes(h, w, rng, 5)) / 255.0, IVORY, .85),
        (np.array(strokes(h, w, rng, 2)) / 255.0, TERRACOTTA, .7),
    ], h, w, rng)
    art.save(os.path.join(OUT, 'art_strokes.png'))

    # 6. Landing — dune: layered sand and ochre horizons.
    h, w = 900, 900
    yy, xx = np.mgrid[0:h, 0:w]
    layers = []
    for i, (colour, level) in enumerate(((SAND, .38), (OCHRE, .55), (TERRACOTTA, .7), (CHARCOAL, .86))):
        crest = h * level + np.sin(xx / w * np.pi * (1.2 + i * .4) + i) * h * .04
        layers.append((np.clip((yy - crest) / 4, 0, 1), colour, .92))
    art = paint(IVORY, layers, h, w, rng, grain_strength=8)
    art.save(os.path.join(OUT, 'art_dune.png'))

    # 7. Bedroom 2 — tide: sage field, ivory veil, one charcoal point.
    h, w = 1000, 800
    yy = np.mgrid[0:h, 0:w][0]
    art = paint(SAGE, [
        (np.clip(1 - yy / (h * .7), 0, 1) ** 1.4, IVORY, .85),
        (blob(h, w, w * .64, h * .3, w * .05, w * .05, rng, wobble=.02, softness=.05), CHARCOAL, .9),
    ], h, w, rng, grain_strength=7)
    art.save(os.path.join(OUT, 'art_tide.png'))
    print('ART', sorted(os.listdir(OUT)))


main()
