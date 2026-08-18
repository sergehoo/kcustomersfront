import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import { dequantize } from '@gltf-transform/functions'

const path = process.argv[2]
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
const doc = await io.read(path)
await doc.transform(dequantize())
const root = doc.getRoot()

// compute world matrix per node
function mul(a, b) {
  const o = new Array(16).fill(0)
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    let s = 0
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]
    o[c * 4 + r] = s
  }
  return o
}
function trs(n) {
  const [tx, ty, tz] = n.getTranslation()
  const [qx, qy, qz, qw] = n.getRotation()
  const [sx, sy, sz] = n.getScale()
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz
  const xx = qx * x2, xy = qx * y2, xz = qx * z2
  const yy = qy * y2, yz = qy * z2, zz = qz * z2
  const wx = qw * x2, wy = qw * y2, wz = qw * z2
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ]
}
function apply(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ]
}

const rows = []
let totalTris = 0
function walk(node, parentMatrix) {
  const m = mul(parentMatrix, trs(node))
  const mesh = node.getMesh()
  if (mesh) {
    let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
    let tris = 0
    const mats = new Set()
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')
      if (!pos) continue
      const idx = prim.getIndices()
      tris += (idx ? idx.getCount() : pos.getCount()) / 3
      const mat = prim.getMaterial()
      if (mat) mats.add(mat.getName())
      const pmin = pos.getMin([]), pmax = pos.getMax([])
      // transform the 8 corners
      for (const cx of [pmin[0], pmax[0]]) for (const cy of [pmin[1], pmax[1]]) for (const cz of [pmin[2], pmax[2]]) {
        const w = apply(m, [cx, cy, cz])
        for (let i = 0; i < 3; i++) { if (w[i] < min[i]) min[i] = w[i]; if (w[i] > max[i]) max[i] = w[i] }
      }
    }
    totalTris += tris
    rows.push({
      name: node.getName() || '(unnamed)',
      tris: Math.round(tris),
      min: min.map(v => +v.toFixed(2)),
      max: max.map(v => +v.toFixed(2)),
      center: min.map((v, i) => +(((v + max[i]) / 2)).toFixed(2)),
      size: min.map((v, i) => +((max[i] - v)).toFixed(2)),
      materials: [...mats],
    })
  }
  for (const child of node.listChildren()) walk(child, m)
}
const I = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
for (const scene of root.listScenes()) for (const n of scene.listChildren()) walk(n, I)

const mode = process.argv[3] || 'list'
if (mode === 'json') {
  console.log(JSON.stringify(rows, null, 0))
} else {
  console.log('FILE:', path)
  console.log('meshes:', rows.length, 'triangles:', totalTris.toLocaleString())
  console.log('materials:', root.listMaterials().length, 'textures:', root.listTextures().length)
  let gmin=[Infinity,Infinity,Infinity], gmax=[-Infinity,-Infinity,-Infinity]
  for (const r of rows) for (let i=0;i<3;i++){ if(r.min[i]<gmin[i])gmin[i]=r.min[i]; if(r.max[i]>gmax[i])gmax[i]=r.max[i] }
  console.log('scene bounds min:', gmin.map(v=>+v.toFixed(2)), 'max:', gmax.map(v=>+v.toFixed(2)))
  console.log('')
  console.log('name'.padEnd(42), 'tris'.padStart(8), ' center(x,y,z)'.padEnd(26), 'size(x,y,z)')
  for (const r of rows.sort((a,b)=>b.tris-a.tris)) {
    console.log(r.name.slice(0,41).padEnd(42), String(r.tris).padStart(8), ` ${String(r.center).padEnd(24)}`, String(r.size))
  }
}
