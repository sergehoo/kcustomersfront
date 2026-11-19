/**
 * Builds the two sky files the villa is lit and framed with, from a Poly Haven
 * "pure sky" (CC0) kept in `assets-source/hdr/`:
 *
 * - `<name>-sunless-1k.hdr` — the HDRI with the solar disc clamped out. The sun
 *   is rendered by a shadow-casting directional light aligned on it; leaving it
 *   in the probe as well lit every interior from the sun's direction straight
 *   through the walls, which is a large part of why rooms read flat.
 * - `<name>-sky-4k.webp` / `-2k.webp` — the photographic background, so the sky
 *   is sharp instead of a blurred 1K probe.
 *
 * It also prints the sun direction in Three.js texture space, which
 * `Sky.tsx` uses to keep the key light and the visible sun together.
 *
 *   node scripts/prepareSky.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { FloatType } from 'three'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'

const NAME = 'kloofendal_38d_partly_cloudy_puresky'
const SOURCE = `assets-source/hdr/kloofendal_38d/${NAME}`
const OUT = 'public/assets/hdr/kloofendal-38d'
/** Radiance above this is the sun (sky peaks around 3); 6 keeps the bright halo. */
const CLAMP = 6

const buffer = fs.readFileSync(`${SOURCE}_1k.hdr`)
const loader = new HDRLoader()
loader.setDataType(FloatType)
const { width, height, data } = loader.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))

let sun = { value: 0, x: 0, y: 0 }
for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
  const i = (y * width + x) * 4
  const value = data[i] * .2126 + data[i + 1] * .7152 + data[i + 2] * .0722
  if (value > sun.value) sun = { value, x, y }
}

// Clamp per pixel, preserving hue, so the disc becomes a soft bright patch.
let clamped = 0
for (let i = 0; i < width * height; i += 1) {
  const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]
  const peak = Math.max(r, g, b)
  if (peak > CLAMP) {
    const k = CLAMP / peak
    data[i * 4] = r * k; data[i * 4 + 1] = g * k; data[i * 4 + 2] = b * k
    clamped += 1
  }
}

/** Flat (non-RLE) Radiance writer: every reader, Three's included, accepts it. */
function encodeRGBE(pixels, w, h) {
  const header = Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${h} +X ${w}\n`, 'ascii')
  const body = Buffer.alloc(w * h * 4)
  for (let i = 0; i < w * h; i += 1) {
    const r = pixels[i * 4], g = pixels[i * 4 + 1], b = pixels[i * 4 + 2]
    const peak = Math.max(r, g, b)
    if (peak < 1e-32) continue
    const exponent = Math.ceil(Math.log2(peak))
    const scale = 256 / Math.pow(2, exponent)
    body[i * 4] = Math.min(255, Math.floor(r * scale))
    body[i * 4 + 1] = Math.min(255, Math.floor(g * scale))
    body[i * 4 + 2] = Math.min(255, Math.floor(b * scale))
    body[i * 4 + 3] = exponent + 128
  }
  return Buffer.concat([header, body])
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(`${OUT}-sunless-1k.hdr`, encodeRGBE(data, width, height))

for (const [size, suffix] of [[4096, '4k'], [2048, '2k']]) {
  await sharp(`${SOURCE}_tonemapped.jpg`, { limitInputPixels: false })
    .resize(size, size / 2, { kernel: 'lanczos3' })
    .webp({ quality: 90, effort: 6, smartSubsample: true })
    .toFile(`${OUT}-sky-${suffix}.webp`)
}

const u = (sun.x + .5) / width
const v = 1 - (sun.y + .5) / height
console.log(JSON.stringify({
  clampedPixels: clamped,
  sun: {
    // equirectUv(): u = atan(z, x) / 2π + .5, v = asin(y) / π + .5
    azimuth: +((u - .5) * Math.PI * 2).toFixed(4),
    elevation: +((v - .5) * Math.PI).toFixed(4),
    peak: Math.round(sun.value),
  },
}, null, 2))
