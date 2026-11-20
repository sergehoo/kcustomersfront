"""Generates the tiling detail maps of the villa's look-dev pass.

Everything here is synthesised (numpy + Pillow, no download) and tiles
seamlessly: the runtime projects these maps in world space (triplanar), so a
wall, a sofa built from boxes or a pleated curtain all get a material at its
true scale without a dedicated UV layout.

    python3 scripts/generate_detail_textures.py

Writes to public/assets/materials/detail/:
  marble-albedo      2.4 m   honed white marble, grey veining
  limestone-albedo   2.0 m   honed limestone: bedding, pores, fine grain
  linen-normal       7 cm    plain weave with slubs
  boucle-normal      16 cm   looped wool
  rug-normal         22 cm   loop pile in rows
  wrinkle-normal     1.3 m   soft creases of a made bed
  water-normal       3 m     wind ripples
  caustics           2.5 m   light network on a pool floor
"""

import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'assets', 'materials', 'detail')
TAU = 2 * np.pi


class Periodic:
    """Gradient noise that repeats every `period` lattice cells."""

    def __init__(self, period_x, period_y, seed):
        rng = np.random.default_rng(seed)
        angle = rng.uniform(0, TAU, (period_y, period_x))
        self.gx, self.gy = np.cos(angle), np.sin(angle)
        self.px, self.py = period_x, period_y

    def __call__(self, x, y):
        xi, yi = np.floor(x).astype(int), np.floor(y).astype(int)
        xf, yf = x - xi, y - yi
        u = xf * xf * xf * (xf * (xf * 6 - 15) + 10)
        v = yf * yf * yf * (yf * (yf * 6 - 15) + 10)

        def corner(ox, oy):
            ix, iy = (xi + ox) % self.px, (yi + oy) % self.py
            return self.gx[iy, ix] * (xf - ox) + self.gy[iy, ix] * (yf - oy)

        top = corner(0, 0) + (corner(1, 0) - corner(0, 0)) * u
        bottom = corner(0, 1) + (corner(1, 1) - corner(0, 1)) * u
        return (top + (bottom - top) * v) * 1.6


def grid(size):
    axis = (np.arange(size) + .5) / size
    return np.meshgrid(axis, axis)


def fbm(x, y, cells_x, cells_y, seed, octaves=5, gain=.5):
    """Tiles over the unit square; x and y may be warped."""
    value, amplitude, total = 0, 1.0, 0
    for octave in range(octaves):
        cx, cy = cells_x * 2 ** octave, cells_y * 2 ** octave
        value = value + amplitude * Periodic(cx, cy, seed + octave)(x * cx, y * cy)
        total += amplitude
        amplitude *= gain
    return value / total


def worley(size, cells, seed, jitter=1.0, warp=None):
    """Distances to the nearest and second-nearest feature point; tiles."""
    rng = np.random.default_rng(seed)
    points = (rng.uniform(0, 1, (cells, cells, 2)) - .5) * jitter + .5
    x, y = grid(size)
    if warp is not None:
        x, y = x + warp[0], y + warp[1]
    px, py = x * cells, y * cells
    cx, cy = np.floor(px).astype(int), np.floor(py).astype(int)
    first = np.full(x.shape, 9.0)
    second = np.full(x.shape, 9.0)
    for oy in (-1, 0, 1):
        for ox in (-1, 0, 1):
            ix, iy = cx + ox, cy + oy
            feature = points[iy % cells, ix % cells]
            distance = np.hypot(ix + feature[..., 0] - px, iy + feature[..., 1] - py)
            closer = distance < first
            second = np.where(closer, first, np.minimum(second, distance))
            first = np.where(closer, distance, first)
    return first, second


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def blur(image, passes=1):
    for _ in range(passes):
        image = (image + np.roll(image, 1, 0) + np.roll(image, -1, 0) + np.roll(image, 1, 1) + np.roll(image, -1, 1)) / 5
    return image


def normal_map(height, strength):
    """Tangent-space normal (OpenGL convention, +Y up) from a tiling height."""
    size = height.shape[0]
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * size / 2
    dy = (np.roll(height, 1, 0) - np.roll(height, -1, 0)) * size / 2
    nx, ny, nz = -dx * strength, -dy * strength, np.ones_like(height)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.stack([nx / length, ny / length, nz / length], -1) * .5 + .5


def save(name, array, quality=88):
    data = (np.clip(array, 0, 1) * 255 + .5).astype(np.uint8)
    path = os.path.join(OUT, f'{name}.webp')
    Image.fromarray(data).save(path, 'WEBP', quality=quality, method=6)
    print(f'{name}.webp  {data.shape[1]}×{data.shape[0]}  {os.path.getsize(path) / 1024:.0f} KB')


def vein(field, width):
    """Lines along the zero crossings of a field; `width` is in pixels at 1024
    and may vary across the image."""
    size = field.shape[0]
    gx = (np.roll(field, -1, 1) - np.roll(field, 1, 1)) / 2
    gy = (np.roll(field, -1, 0) - np.roll(field, 1, 0)) / 2
    distance = np.abs(field) / (np.hypot(gx, gy) + 1e-6) * (1024 / size)
    return 1 - smoothstep(width * .3, width, distance)


def marble(size=1024):
    x, y = grid(size)
    wx = fbm(x, y, 2, 2, 10, 5, .55)
    wy = fbm(x, y, 2, 2, 20, 5, .55)
    # Veining runs with the bed of the stone: sets of roughly parallel lines
    # along a diagonal, bent by a strong low-frequency warp so they converge,
    # fork and fade the way a quarried slab does. Integer frequencies keep the
    # tile seamless.
    def strata(fx, fy, bend, seed, octaves=4):
        return np.sin(TAU * (fx * x + fy * y) + bend * (wx + .6 * fbm(x + wy * .2, y - wx * .2, 3, 3, seed, octaves)))

    thickness = .35 + 1.5 * smoothstep(-.35, .45, fbm(x, y, 5, 5, 25, 3))
    major = vein(strata(1, 2, 4.4, 30), 4.2 * thickness)
    cross = vein(strata(2, -1, 3.6, 35), 2.6 * thickness)
    minor = vein(strata(3, 5, 5.2, 40), 1.6 * thickness)
    hair = vein(strata(7, -4, 6.5, 50, 3), 1.0)
    # A vein is never the same strength along its length, and whole stretches die out.
    presence = smoothstep(-.12, .28, fbm(x + wx * .1, y, 3, 3, 60, 3))
    crossing = smoothstep(.02, .38, fbm(x, y + wy * .1, 3, 3, 62, 3))
    faint = smoothstep(-.2, .4, fbm(x, y, 4, 4, 65, 3))
    cloud = fbm(x + wx * .1, y + wy * .1, 3, 3, 70, 4)
    base = np.array([.955, .948, .93])
    rgb = base[None, None, :] * (1 + cloud[..., None] * .04)
    grey = np.array([.44, .435, .43])
    warm = np.array([.70, .62, .50])
    body = major * presence
    halo = blur(body, 14)
    rgb = rgb * (1 - halo[..., None] * .22)
    rgb = rgb + (warm - rgb) * (blur(body, 4) * .2)[..., None]
    rgb = rgb + (grey - rgb) * (blur(body) * .72)[..., None]
    rgb = rgb + (grey - rgb) * (blur(cross) * .5 * crossing)[..., None]
    rgb = rgb + (grey - rgb) * (blur(minor) * .3 * faint)[..., None]
    rgb = rgb + (grey - rgb) * (hair * .1 * (1 - faint))[..., None]
    save('marble-albedo', rgb, 90)


def limestone(size=1024):
    x, y = grid(size)
    warp = fbm(x, y, 3, 3, 110, 3) * .03
    bedding = fbm(x, y + warp, 2, 13, 120, 4, .55)
    cloud = fbm(x, y, 3, 3, 130, 4)
    grain = fbm(x, y, 96, 96, 140, 3, .6)
    first, _ = worley(size, 70, 150, jitter=1.0)
    pores = (1 - smoothstep(.05, .13, first)) * smoothstep(.1, .5, fbm(x, y, 9, 9, 160, 3) + bedding * .6)
    first, _ = worley(size, 22, 170, jitter=1.0)
    fossils = (1 - smoothstep(.03, .09, first)) * .5
    tone = .93 * (1 + bedding * .055 + cloud * .04 + grain * .02)
    tone = tone * (1 - pores * .16) * (1 - fossils * .05)
    warmth = bedding * .012
    rgb = np.stack([tone * (1 + warmth), tone, tone * (1 - warmth * 1.6)], -1)
    save('limestone-albedo', rgb, 88)


def linen(size=512, threads=44):
    rng = np.random.default_rng(210)
    period = size / threads
    coords = np.arange(size)
    index = (coords // period).astype(int) % threads
    u = (coords % period) / period
    profile = np.sin(np.pi * u) ** .7
    thick_x = np.clip(1 + .32 * rng.standard_normal(threads), .45, 1.7)[index]
    thick_y = np.clip(1 + .32 * rng.standard_normal(threads), .45, 1.7)[index]
    warp = profile[None, :] * thick_x[None, :]
    weft = profile[:, None] * thick_y[:, None]
    over = (index[None, :] + index[:, None]) % 2 == 0
    x, y = grid(size)
    # Over-under: the thread on top stands proud, the other dips under it.
    crown_x = .5 + .5 * np.cos(TAU * (y * threads / 2 + (index[None, :] % 2) * .5))
    crown_y = .5 + .5 * np.cos(TAU * (x * threads / 2 + (index[:, None] % 2) * .5))
    height = np.where(over, warp * (.55 + .45 * crown_x), weft * (.55 + .45 * crown_y))
    height = height + fbm(x, y, 6, 6, 220, 3) * .25 + fbm(x, y, 60, 60, 230, 2) * .12
    save('linen-normal', normal_map(blur(height), .055), 90)


def boucle(size=512):
    x, y = grid(size)
    wx = fbm(x, y, 8, 8, 310, 3) * .035
    wy = fbm(x, y, 8, 8, 320, 3) * .035
    first, second = worley(size, 26, 330, warp=(wx, wy))
    loops = (1 - smoothstep(0, .62, first)) ** .8
    first, _ = worley(size, 58, 340, warp=(wy, wx))
    curls = (1 - smoothstep(0, .6, first)) ** .9
    height = loops * .7 + curls * .34 + (second - first) * .08 + fbm(x, y, 90, 90, 350, 2) * .06
    save('boucle-normal', normal_map(blur(height), .05), 90)


def rug(size=512, rows=34):
    x, y = grid(size)
    wobble = fbm(x, y, 5, 5, 410, 3) * .012
    row = (y + wobble) * rows
    across = x * rows * 1.5 + np.floor(row) * .5
    tuft = (np.sin(np.pi * (row % 1)) ** .6) * (np.sin(np.pi * (across % 1)) ** .5)
    rng = np.random.default_rng(420)
    lift = rng.uniform(.7, 1.1, (rows, int(rows * 1.5) + 1))
    tuft = tuft * lift[np.floor(row).astype(int) % rows, np.floor(across).astype(int) % lift.shape[1]]
    height = tuft + fbm(x, y, 4, 4, 430, 3) * .35 + fbm(x, y, 80, 80, 440, 2) * .1
    save('rug-normal', normal_map(blur(height), .05), 90)


def wrinkle(size=512):
    x, y = grid(size)
    wx = fbm(x, y, 2, 2, 510, 3) * .12
    wy = fbm(x, y, 2, 2, 520, 3) * .12
    # Creases: narrow ridges where two soft fields cross zero, in two directions.
    one = 1 - smoothstep(0, .16, np.abs(fbm(x + wx, y + wy, 2, 5, 530, 4, .55)))
    two = 1 - smoothstep(0, .12, np.abs(fbm(x - wy, y + wx, 6, 3, 540, 4, .55)))
    soft = fbm(x + wx, y + wy, 3, 3, 550, 4)
    height = blur(one ** 1.8 * .6 + two ** 2.2 * .35, 3) + soft * .7
    save('wrinkle-normal', normal_map(blur(height, 2), .018), 90)


def water(size=512):
    x, y = grid(size)
    wx = fbm(x, y, 3, 3, 610, 3) * .05
    wy = fbm(x, y, 3, 3, 620, 3) * .05
    swell = fbm(x + wx, y + wy, 4, 6, 630, 4, .55)
    chop = 1 - np.abs(fbm(x + wx * 2, y + wy * 2, 9, 13, 640, 4, .55)) * 2
    fine = fbm(x, y, 34, 40, 650, 3, .6)
    height = swell * .6 + chop * .32 + fine * .1
    save('water-normal', normal_map(blur(height), .03), 90)


def caustics(size=512):
    x, y = grid(size)
    wx = fbm(x, y, 3, 3, 710, 3) * .06
    wy = fbm(x, y, 3, 3, 720, 3) * .06
    first, second = worley(size, 7, 730, warp=(wx, wy))
    web = (1 - smoothstep(0, .16, second - first)) ** 2.2
    first, second = worley(size, 13, 740, warp=(wy * .7, wx * .7))
    fine = (1 - smoothstep(0, .2, second - first)) ** 2.6
    value = blur(web * .85 + fine * .4, 1)
    save('caustics', np.repeat(value[..., None], 3, -1), 86)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    import sys
    if len(sys.argv) > 1:
        for name in sys.argv[1:]:
            globals()[name]()
        sys.exit()
    marble()
    limestone()
    linen()
    boucle()
    rug()
    wrinkle()
    water()
    caustics()
