import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, meshopt, prune, textureCompress } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'
import sharp from 'sharp'

const source = new URL('../public/models/modern_coastal_hillside_villa.glb', import.meta.url)

await MeshoptEncoder.ready
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder })

async function optimize(filename, resolution, quality) {
  const output = new URL(`../public/models/exterior/${filename}`, import.meta.url)
  const document = await io.read(source.pathname)
  await document.transform(
    dedup(),
    prune(),
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      resize: [resolution, resolution],
      quality,
      effort: 4,
    }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  )

  await mkdir(dirname(output.pathname), { recursive: true })
  await io.write(output.pathname, document)
  console.log(`Optimized exterior villa (${resolution}px) -> ${output.pathname}`)
}

await optimize('kaydan-coastal-villa-web.glb', 1024, 72)
await optimize('kaydan-coastal-villa-mobile.glb', 512, 66)
