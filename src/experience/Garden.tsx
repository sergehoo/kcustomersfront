import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useState } from 'react'
import {
  BufferAttribute, BufferGeometry, Color, CylinderGeometry, DoubleSide, IcosahedronGeometry, InstancedMesh,
  Matrix4, Mesh, MeshStandardMaterial, Quaternion, Raycaster, Vector3, type Object3D,
} from 'three'
import type { Ambience } from './ambience'
import { applyVariation } from './realism/materialVariation'

/**
 * A structured, mineral-and-architectural garden in the spirit of modern
 * Mediterranean villas: drifts of ornamental grasses, agave rosettes,
 * clipped boxwood spheres and a few palms framing the entrance.
 *
 * Everything is procedural (no extra download) and instanced — four draw
 * calls for the whole planting — and set by ray-casting onto the villa's own
 * planting surfaces, so nothing ever floats or sinks into paving.
 */

// ── deterministic random ─────────────────────────────────────────────────────
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── geometries ───────────────────────────────────────────────────────────────
type Builder = { positions: number[]; colors: number[]; indices: number[] }

function blade(b: Builder, base: Vector3, direction: Vector3, length: number, width: number, bend: number, root: Color, tip: Color, segments = 4) {
  const side = new Vector3(-direction.z, 0, direction.x).normalize()
  const start = b.positions.length / 3
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments
    const w = width * (1 - t * .92)
    const p = base.clone()
      .addScaledVector(direction, length * t)
      .add(new Vector3(0, length * t - bend * t * t * length, 0))
    const color = root.clone().lerp(tip, t)
    for (const s of [-1, 1]) {
      const q = p.clone().addScaledVector(side, s * w * .5)
      b.positions.push(q.x, q.y, q.z)
      b.colors.push(color.r, color.g, color.b)
    }
  }
  for (let i = 0; i < segments; i += 1) {
    const a = start + i * 2
    b.indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
}

function finish(b: Builder) {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(b.positions), 3))
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(b.colors), 3))
  geometry.setIndex(b.indices)
  geometry.computeVertexNormals()
  return geometry
}

/** Fountain grass clump: ~70 arching blades, darker at the crown, straw tips. */
function grassClump() {
  const random = rng(7)
  const b: Builder = { positions: [], colors: [], indices: [] }
  const root = new Color('#55603a'), tip = new Color('#c9c08f')
  for (let i = 0; i < 70; i += 1) {
    const angle = random() * Math.PI * 2
    const lean = .25 + random() * .75
    const direction = new Vector3(Math.cos(angle) * lean, 1, Math.sin(angle) * lean).normalize()
    const base = new Vector3(Math.cos(angle) * random() * .12, 0, Math.sin(angle) * random() * .12)
    blade(b, base, new Vector3(direction.x, 0, direction.z).normalize().multiplyScalar(lean), .7 + random() * .45, .022, .35 + random() * .5,
      root.clone().multiplyScalar(.85 + random() * .3), tip.clone().multiplyScalar(.85 + random() * .25), 5)
  }
  return finish(b)
}

/** Agave: stiff, thick, glaucous leaves in a tight rosette. */
function agave() {
  const random = rng(11)
  const b: Builder = { positions: [], colors: [], indices: [] }
  const root = new Color('#5f7d78'), tip = new Color('#9fb7ad')
  const rings = [{ n: 7, lean: .95, length: .62 }, { n: 8, lean: .7, length: .7 }, { n: 6, lean: .35, length: .6 }]
  rings.forEach((ring, r) => {
    for (let i = 0; i < ring.n; i += 1) {
      const angle = (i / ring.n) * Math.PI * 2 + r * .4 + random() * .2
      const direction = new Vector3(Math.cos(angle) * ring.lean, 0, Math.sin(angle) * ring.lean)
      blade(b, new Vector3(0, .02 * r, 0), direction, ring.length, .16, .05, root, tip, 4)
    }
  })
  return finish(b)
}

/** Palm: curved, ringed trunk and a crown of arching pinnate fronds. */
function palmTrunk() {
  const geometry = new CylinderGeometry(.13, .2, 1, 10, 12, true)
  geometry.translate(0, .5, 0)
  const position = geometry.getAttribute('position')
  const colors: number[] = []
  const dark = new Color('#4d4235'), light = new Color('#8a7a63')
  for (let i = 0; i < position.count; i += 1) {
    const y = position.getY(i)
    // A gentle lean and the ringed leaf-scar banding.
    position.setX(i, position.getX(i) + y * y * .35)
    const band = .5 + .5 * Math.sin(y * 90)
    const c = dark.clone().lerp(light, band * .7)
    colors.push(c.r, c.g, c.b)
  }
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
  geometry.computeVertexNormals()
  return geometry
}

function palmCrown() {
  const random = rng(23)
  const b: Builder = { positions: [], colors: [], indices: [] }
  const rib = new Color('#5e7232'), leaf = new Color('#7f9a40')
  for (let f = 0; f < 14; f += 1) {
    const angle = (f / 14) * Math.PI * 2 + random() * .2
    const rise = .2 + random() * .55
    const length = 1.7 + random() * .6
    const direction = new Vector3(Math.cos(angle), 0, Math.sin(angle))
    const side = new Vector3(-direction.z, 0, direction.x)
    // Leaflets along an arching rachis.
    for (let i = 2; i < 22; i += 1) {
      const t = i / 22
      const point = direction.clone().multiplyScalar(length * t).add(new Vector3(0, rise * t * 2 - t * t * 1.6, 0))
      for (const s of [-1, 1]) {
        const leafDirection = direction.clone().multiplyScalar(.55).addScaledVector(side, s).normalize()
        // Bend > 1: each leaflet rises, then droops like a real pinna.
        blade(b, point, leafDirection, .42 * (1 - t * .55), .05, 1.35, rib, leaf.clone().multiplyScalar(.85 + random() * .3), 2)
      }
    }
  }
  return finish(b)
}

// ── placement ────────────────────────────────────────────────────────────────
type Kind = 'grass' | 'agave' | 'topiary' | 'palm'
type Zone = {
  minX: number; maxX: number; minZ: number; maxZ: number; count: number; mix: [Kind, number][]; seed: number
  /** Also plant on the stone caps of stepped terraces (turns them into planters). */
  caps?: boolean
}

/** Planting surfaces of the production GLB (soil beds, lawn, banks). */
const PLANTABLE = /^(KAYDAN_SOIL|KAYDAN_LAWN|Ground003|KD_SURROUNDING_LAND)$/

const ZONES: Zone[] = [
  // Along the east walk to the terrace.
  { minX: 6.35, maxX: 7.15, minZ: 7.5, maxZ: 17.3, count: 16, mix: [['grass', 1]], seed: 2 },
  // Raised beds either side of the forecourt.
  { minX: 10.3, maxX: 14.3, minZ: 18.5, maxZ: 21.7, count: 22, mix: [['grass', .55], ['agave', .3], ['topiary', .15]], seed: 3 },
  { minX: -13.2, maxX: -2.9, minZ: 18.5, maxZ: 21.7, count: 34, mix: [['grass', .55], ['agave', .2], ['topiary', .25]], seed: 4 },
  // The bank between the driveway and the main stair.
  { minX: -1.8, maxX: 5.2, minZ: 18.8, maxZ: 25.2, count: 46, mix: [['grass', .75], ['agave', .25]], seed: 5 },
  // East slope beside the stair — kept clear of the hero camera (12.4, 3.5, 30.5).
  { minX: 9.4, maxX: 15, minZ: 22.5, maxZ: 26.5, count: 18, mix: [['grass', .6], ['agave', .4]], seed: 6 },
  // The stepped stone terraces on both flanks read as a second, competing
  // stair from the road: planted, they become cascading beds.
  { minX: 10.3, maxX: 14.3, minZ: 18.2, maxZ: 24.4, count: 26, mix: [['grass', .7], ['agave', .3]], seed: 8, caps: true },
  { minX: -13.6, maxX: -9.2, minZ: 18.2, maxZ: 24.4, count: 24, mix: [['grass', .7], ['agave', .3]], seed: 9, caps: true },
  // Lawns: a few clipped spheres only.
  { minX: -11.6, maxX: -3.6, minZ: 24.4, maxZ: 29.6, count: 7, mix: [['topiary', 1]], seed: 7 },
]

/** Hand-placed palms framing the stair and the door. */
const PALMS: [number, number, number][] = [[-3.6, 20.2, 3.3], [-9.6, 19.6, 3.6]]

export function Garden({ mobile, ambience }: { mobile: boolean; ambience: Ambience }) {
  const scene = useThree((state) => state.scene)
  const [instances, setInstances] = useState<Record<Kind, Matrix4[]> | null>(null)

  const geometries = useMemo(() => ({
    grass: grassClump(),
    agave: agave(),
    topiary: new IcosahedronGeometry(.5, 3),
    trunk: palmTrunk(),
    crown: palmCrown(),
  }), [])

  const materials = useMemo(() => {
    const foliage = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .78, metalness: 0, envMapIntensity: .7 })
    const succulent = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .55, metalness: 0, envMapIntensity: .9 })
    const boxwood = new MeshStandardMaterial({ color: '#41592c', roughness: .92, metalness: 0, envMapIntensity: .6 })
    applyVariation(boxwood, { scale: .12, albedo: .35, roughness: .05, hueDrift: .1 })
    const trunk = new MeshStandardMaterial({ vertexColors: true, roughness: .9, metalness: 0 })
    return { foliage, succulent, boxwood, trunk }
  }, [])

  useLayoutEffect(() => {
    const villa = scene.getObjectByName('KAYDAN villa')
    if (!villa) return
    villa.updateMatrixWorld(true)
    const targets: Object3D[] = []
    villa.traverse((child) => {
      if (!(child instanceof Mesh) || child.visible === false) return
      const material = (Array.isArray(child.material) ? child.material[0] : child.material) as MeshStandardMaterial
      if (PLANTABLE.test(material.name)) targets.push(child)
    })
    const land = scene.getObjectByName('KD surroundings land')
    if (land) targets.push(land)
    // Anything else that could sit over a bed (decks, steps, walls) must block.
    const blockers: Object3D[] = []
    villa.traverse((child) => { if (child instanceof Mesh && !targets.includes(child)) blockers.push(child) })

    const raycaster = new Raycaster()
    const down = new Vector3(0, -1, 0)
    const result: Record<Kind, Matrix4[]> = { grass: [], agave: [], topiary: [], palm: [] }
    const place = (x: number, z: number, caps = false) => {
      raycaster.set(new Vector3(x, 30, z), down)
      const hit = raycaster.intersectObjects([...targets, ...blockers], false)[0]
      if (!hit || !hit.face) return null
      const material = ((hit.object as Mesh).material as MeshStandardMaterial)?.name
      if (!targets.includes(hit.object) && !(caps && /^TERRACE_[EW]_CAP/.test(hit.object.name) && material === 'KAYDAN_TREAD')) return null
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
      return normal.y > .55 ? hit.point : null
    }

    const density = mobile ? .5 : 1
    for (const zone of ZONES) {
      const random = rng(zone.seed * 977)
      const wanted = Math.round(zone.count * density)
      for (let attempt = 0, placed = 0; attempt < wanted * 4 && placed < wanted; attempt += 1) {
        const x = zone.minX + random() * (zone.maxX - zone.minX)
        const z = zone.minZ + random() * (zone.maxZ - zone.minZ)
        const point = place(x, z, zone.caps)
        if (!point) continue
        let pick = random()
        const kind = zone.mix.find(([, weight]) => (pick -= weight) <= 0)?.[0] ?? zone.mix[0][0]
        const size = kind === 'grass' ? .8 + random() * .5 : kind === 'agave' ? .8 + random() * .5 : .7 + random() * .5
        const sink = kind === 'topiary' ? size * .32 : .02
        result[kind].push(new Matrix4().compose(
          new Vector3(point.x, point.y + (kind === 'topiary' ? size * .5 - sink : -sink), point.z),
          new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), random() * Math.PI * 2),
          new Vector3(size, kind === 'topiary' ? size * .92 : size, size),
        ))
        placed += 1
      }
    }
    for (const [x, z, height] of PALMS) {
      const point = place(x, z)
      if (!point) continue
      result.palm.push(new Matrix4().compose(new Vector3(point.x, point.y - .05, point.z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), x * 1.7), new Vector3(1, height, 1)))
    }
    setInstances(result)
  }, [scene, mobile])

  const meshes = useMemo(() => {
    if (!instances) return null
    const make = (geometry: BufferGeometry, material: MeshStandardMaterial, matrices: Matrix4[], name: string, cast = true) => {
      if (!matrices.length) return null
      const mesh = new InstancedMesh(geometry, material, matrices.length)
      matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix))
      mesh.name = name
      mesh.castShadow = cast && !mobile
      mesh.receiveShadow = true
      mesh.computeBoundingSphere()
      return mesh
    }
    // Crowns sit on top of each trunk, scaled to the trunk's height.
    const crowns = instances.palm.map((matrix) => {
      const position = new Vector3(), rotation = new Quaternion(), scale = new Vector3()
      matrix.decompose(position, rotation, scale)
      // The trunk's lean is .35 m at its top (see palmTrunk), turned with the trunk.
      const top = new Vector3(.35, scale.y, 0).applyQuaternion(rotation)
      return new Matrix4().compose(position.clone().add(top), rotation, new Vector3(1, 1, 1))
    })
    return [
      make(geometries.grass, materials.foliage, instances.grass, 'KD garden grasses'),
      make(geometries.agave, materials.succulent, instances.agave, 'KD garden agaves'),
      make(geometries.topiary, materials.boxwood, instances.topiary, 'KD garden topiaries'),
      make(geometries.trunk, materials.trunk, instances.palm, 'KD garden palm trunks'),
      make(geometries.crown, materials.foliage, crowns, 'KD garden palm crowns'),
    ].filter(Boolean) as InstancedMesh[]
  }, [instances, geometries, materials, mobile])

  // Plants read a touch lighter at night, lifted by their uplights.
  useLayoutEffect(() => {
    materials.foliage.envMapIntensity = ambience.mode === 'night' ? 1.4 : .7
  }, [ambience, materials])

  return <>{meshes?.map((mesh) => <primitive key={mesh.name} object={mesh} />)}</>
}
