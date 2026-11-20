import { mkdir, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { createTransform, dedup, instance, meshopt, prune, simplifyPrimitive, textureCompress, weld } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'

/**
 * The Blender export is kept outside `public/` so Vite never copies it into the
 * bundle. Only the two variants written by this script are served.
 */
const source = new URL('../assets-source/models/kaydan-villa-production.glb', import.meta.url)

/**
 * Geometry — not textures — is what made the shipped villa heavy: 882k triangles
 * for 5.5 MB of WebP. A colander at 45k triangles and a potted plant at 107k are
 * invisible at the distances the camera actually uses, so the pass welds, then
 * simplifies with an error budget expressed as a fraction of the model extent.
 */
const VARIANTS = [
  { filename: 'kaydan-villa-production-web.glb', resolution: 1024, quality: 78, ratio: .22, error: .004, draperyRatio: 1 },
  { filename: 'kaydan-villa-production-mobile.glb', resolution: 512, quality: 70, ratio: .10, error: .009, draperyRatio: .5 },
]

/**
 * Hung fabric (blender/scripts/refine_textiles.py) is authored at the density
 * its folds need. Simplified with everything else, a curtain kept a fifth of
 * its triangles and its pleats collapsed back into a flat panel — so the web
 * model keeps it whole and the mobile one halves it at most.
 */
const DRAPERY = /^KAYDAN_(SHEER|DRAPE_LINEN)$/

/** `simplify()` with a per-material exception; the library's own has no filter. */
function simplifyExceptDrapery({ draperyRatio, ...options }) {
  return createTransform('simplifyExceptDrapery', async (document) => {
    await document.transform(weld({ overwrite: false }))
    for (const mesh of document.getRoot().listMeshes()) {
      for (const primitive of mesh.listPrimitives()) {
        if (primitive.getMode() !== 4) continue
        const drapery = DRAPERY.test(primitive.getMaterial()?.getName() ?? '')
        if (drapery && draperyRatio >= 1) continue
        simplifyPrimitive(primitive, drapery ? { ...options, ratio: draperyRatio, error: .0006 } : options)
        if (!primitive.getIndices()?.getCount()) primitive.dispose()
      }
      if (mesh.listPrimitives().length === 0) mesh.dispose()
    }
  })
}

/** Modelling leftover: a 20 m sofa parked 45 m behind the villa, 41 m in the air. */
const ORPHANS = ['Modern Living Room_Sofa_0']

await MeshoptEncoder.ready
await MeshoptSimplifier.ready

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptEncoder })

function countTriangles(document) {
  let total = 0
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const indices = primitive.getIndices()
      const position = primitive.getAttribute('POSITION')
      if (position) total += (indices ? indices.getCount() : position.getCount()) / 3
    }
  }
  return Math.round(total)
}

function dropOrphans(document) {
  for (const node of document.getRoot().listNodes()) {
    if (!ORPHANS.includes(node.getName())) continue
    node.dispose()
    console.log(`  removed orphan node: ${node.getName()}`)
  }
}

async function optimize({ filename, resolution, quality, ratio, error, draperyRatio }) {
  const output = new URL(`../public/models/production/${filename}`, import.meta.url)
  const document = await io.read(source.pathname)
  const before = countTriangles(document)

  dropOrphans(document)
  await document.transform(
    dedup(),
    instance({ min: 2 }),
    prune({ keepAttributes: false, keepLeaves: false }),
    weld(),
    simplifyExceptDrapery({ simplifier: MeshoptSimplifier, ratio, error, lockBorder: true, draperyRatio }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [resolution, resolution], quality, effort: 6 }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  )

  await mkdir(dirname(output.pathname), { recursive: true })
  await io.write(output.pathname, document)
  const after = countTriangles(document)
  const { size } = await stat(output.pathname)
  console.log(`${filename}: ${before.toLocaleString()} → ${after.toLocaleString()} tris · ${(size / 1048576).toFixed(1)} MB`)
}

for (const variant of VARIANTS) await optimize(variant)
