import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, prune } from '@gltf-transform/functions'

const assets = [
  { id: 'modern_arm_chair_01', output: 'furniture/modern-arm-chair.glb' },
  { id: 'modern_ceiling_lamp_01', output: 'lighting/modern-ceiling-lamp.glb' },
  { id: 'calathea_orbifolia_01', output: 'vegetation/calathea-orbifolia.glb' },
  {
    id: 'potted_plant_01',
    output: 'vegetation/potted-plant.glb',
    sidecars: [{
      metadataPath: ['leaves_alpha', '1k', 'jpg'],
      output: 'vegetation/potted-plant-alpha.jpg',
    }],
  },
]

const projectRoot = new URL('../', import.meta.url)
const modelsRoot = new URL('../public/models/external/', import.meta.url)
const stagingRoot = await mkdtemp(join(tmpdir(), 'kaydan-polyhaven-'))
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)

async function download(url, destination) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`)
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, new Uint8Array(await response.arrayBuffer()))
}

try {
  for (const asset of assets) {
    const metadataResponse = await fetch(`https://api.polyhaven.com/files/${asset.id}`)
    if (!metadataResponse.ok) throw new Error(`Poly Haven API failed for ${asset.id}`)
    const metadata = await metadataResponse.json()
    const source = metadata?.gltf?.['1k']?.gltf
    if (!source?.url || !source.include) throw new Error(`No 1K glTF package for ${asset.id}`)

    const assetStage = join(stagingRoot, asset.id)
    const gltfPath = join(assetStage, `${asset.id}_1k.gltf`)
    await download(source.url, gltfPath)
    for (const [relativePath, file] of Object.entries(source.include)) {
      await download(file.url, join(assetStage, relativePath))
    }

    const document = await io.read(gltfPath)
    await document.transform(dedup(), prune())
    const outputUrl = new URL(asset.output, modelsRoot)
    await mkdir(dirname(outputUrl.pathname), { recursive: true })
    await writeFile(outputUrl, await io.writeBinary(document))
    console.log(`Imported ${asset.id} -> ${outputUrl.pathname}`)

    for (const sidecar of asset.sidecars ?? []) {
      const file = sidecar.metadataPath.reduce((value, key) => value?.[key], metadata)
      if (!file?.url) throw new Error(`Missing sidecar ${sidecar.metadataPath.join('.')} for ${asset.id}`)
      const sidecarUrl = new URL(sidecar.output, modelsRoot)
      await download(file.url, sidecarUrl.pathname)
      console.log(`Imported ${asset.id} sidecar -> ${sidecarUrl.pathname}`)
    }
  }
} finally {
  await rm(stagingRoot, { recursive: true, force: true })
}

console.log(`Poly Haven assets imported from ${projectRoot.pathname}`)
