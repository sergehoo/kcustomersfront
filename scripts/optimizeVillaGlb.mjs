import { NodeIO } from '@gltf-transform/core'
import { KHRMaterialsEmissiveStrength, KHRMaterialsTransmission, KHRMaterialsVolume } from '@gltf-transform/extensions'
import { dedup, prune, quantize, weld } from '@gltf-transform/functions'

const io = new NodeIO().registerExtensions([KHRMaterialsTransmission, KHRMaterialsVolume, KHRMaterialsEmissiveStrength])
const path = new URL('../public/models/kaydan-villa.glb', import.meta.url).pathname
const document = await io.read(path)
await document.transform(dedup(), prune(), weld(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeColor: 8, quantizeWeight: 8 }))
await io.write(path, document)
console.log('Optimized public/models/kaydan-villa.glb')
