import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useState } from 'react'
import {
  BufferAttribute, BufferGeometry, Color, CylinderGeometry, DoubleSide, IcosahedronGeometry, InstancedMesh,
  Matrix4, Mesh, MeshStandardMaterial, Quaternion, Raycaster, Vector3, type Object3D,
} from 'three'
import type { Ambience } from './ambience'
import { applyVariation } from './realism/materialVariation'
import { applyWind, WIND_TIME } from './realism/wind'
import { PalmBirds } from './PalmBirds'

/**
 * A structured, mineral-and-architectural garden in the spirit of modern
 * Mediterranean villas: drifts of ornamental grasses, agave rosettes,
 * clipped boxwood spheres and a few palms framing the entrance.
 *
 * Everything is procedural (no extra download) and instanced — five draw
 * calls for the whole planting — and set by ray-casting onto the villa's own
 * planting surfaces, so nothing ever floats or sinks into paving. Grasses,
 * fronds and agaves move in a light breeze (realism/wind.ts).
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
  // A vertex that only belongs to zero-area faces comes out with a null
  // normal, which the fragment shader normalises into NaN: point it up instead.
  const normal = geometry.getAttribute('normal')
  for (let i = 0; i < normal.count; i += 1) {
    if (Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) < .5) normal.setXYZ(i, 0, 1, 0)
  }
  return geometry
}

/**
 * Fountain grass clump: ~90 fine blades of uneven length that arch outwards
 * and hang at the tip, darker at the crown, a few of them dried to straw.
 */
function grassClump() {
  const random = rng(7)
  const b: Builder = { positions: [], colors: [], indices: [] }
  const root = new Color('#4f5c37'), tip = new Color('#bdb886'), straw = new Color('#cdbd8a')
  for (let i = 0; i < 92; i += 1) {
    const angle = random() * Math.PI * 2
    // Upright in the heart of the clump, splayed and longer at its skirt.
    const ring = Math.pow(random(), .8)
    const lean = .18 + ring * .8
    const length = (.55 + random() * .5) * (.8 + ring * .35)
    const base = new Vector3(Math.cos(angle) * ring * .11, 0, Math.sin(angle) * ring * .11)
    const dry = random() < .16
    blade(b, base, new Vector3(Math.cos(angle), 0, Math.sin(angle)).multiplyScalar(lean), length, .011 + random() * .011, .32 + ring * .45 + random() * .25,
      root.clone().multiplyScalar(.82 + random() * .32), (dry ? straw : tip).clone().multiplyScalar(.84 + random() * .28), 6)
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

/** A ribbon along a polyline: `across` is the direction of its width. */
function strip(b: Builder, points: Vector3[], across: Vector3, width: (t: number) => number, root: Color, tip: Color) {
  const start = b.positions.length / 3
  points.forEach((point, index) => {
    const t = index / (points.length - 1)
    const color = root.clone().lerp(tip, t)
    for (const s of [-1, 1]) {
      const q = point.clone().addScaledVector(across, s * width(t) * .5)
      b.positions.push(q.x, q.y, q.z)
      b.colors.push(color.r, color.g, color.b)
    }
  })
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = start + i * 2
    b.indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
}

/**
 * A feather-palm crown. The first one was fourteen straight combs: every
 * frond the same arc, every leaflet the same rising V. A real crown is a
 * spiral of ages — young fronds stand up at its heart, mature ones arch out,
 * old ones hang — and along each frond the leaflets start short, lengthen,
 * taper off, and droop under their own weight from a rib that also curls.
 */
type Frond = { age: number; angle: number; length: number; lift: number; droop: number; curl: number }

/** The crown's fronds, youngest first: one set, shared by every palm. */
const FRONDS: Frond[] = (() => {
  const random = rng(23)
  const count = 22
  return Array.from({ length: count }, (_, f) => {
    const age = f / (count - 1)
    return {
      age,
      // Golden angle: no two fronds ever stack.
      angle: f * 2.39996 + (random() - .5) * .35,
      length: 2.0 + random() * .65 - Math.abs(age - .45) * .5,
      lift: 1.25 - age * 1.2 + (random() - .5) * .18,
      droop: .68 + age * .34 + random() * .2,
      curl: (random() - .5) * .55,
    }
  })
})()

const UP = new Vector3(0, 1, 0)

/** A point on a frond's rib, `t` from the crown (0) to the tip (1), in the crown's own space. */
function ribPoint(frond: Frond, t: number) {
  const direction = new Vector3(Math.cos(frond.angle), 0, Math.sin(frond.angle))
  const side = new Vector3(-direction.z, 0, direction.x)
  return direction.multiplyScalar(frond.length * t * (1 - .1 * t))
    .addScaledVector(side, frond.curl * t * t * .45)
    .addScaledVector(UP, frond.length * (frond.lift * .5 * t - frond.droop * .6 * t * t))
}

/**
 * Where a bird can sit: a third of the way out on the fronds that arch
 * closest to level, where the rib is thick enough to carry it. Crown space.
 */
const PALM_PERCHES = [5, 8, 6, 9, 7].map((index) => ribPoint(FRONDS[index], .3 + (index % 3) * .05))

function palmCrown() {
  const random = rng(29)
  const b: Builder = { positions: [], colors: [], indices: [] }
  const up = UP
  const young = new Color('#5b7a30'), mature = new Color('#4c692c'), old = new Color('#7d8045')
  for (const frond of FRONDS) {
    const { age } = frond
    const direction = new Vector3(Math.cos(frond.angle), 0, Math.sin(frond.angle))
    const side = new Vector3(-direction.z, 0, direction.x)
    const rib = (t: number) => ribPoint(frond, t)
    const green = (age < .5 ? young.clone().lerp(mature, age * 2) : mature.clone().lerp(old, (age - .5) * 1.5)).multiplyScalar(.9 + random() * .22)
    const pale = green.clone().lerp(new Color('#a5b25c'), .45)

    strip(b, Array.from({ length: 11 }, (_, i) => rib(i / 10)), side, (t) => .05 - t * .038, pale.clone().multiplyScalar(.9), pale)

    const pairs = 30
    for (let i = 0; i < pairs; i += 1) {
      const t = .1 + (i / (pairs - 1)) * .88
      const origin = rib(t)
      const tangent = rib(Math.min(1, t + .02)).sub(origin).normalize()
      // Short at the base, longest a third of the way out, fine at the tip.
      // (Never down to nothing: a leaflet of no length has no normal, and one
      // pixel lit by an undefined normal is spread across the frame by bloom.)
      const reach = .56 * Math.pow(Math.sin(Math.PI * Math.min(.94, .1 + t * .92)), .55) * (1 - t * .3) * (.9 + random() * .2)
      for (const s of [-1, 1]) {
        const out = side.clone().multiplyScalar(s).addScaledVector(tangent, .5 + random() * .15).normalize()
        const hang = .55 + age * .35 + random() * .2
        // Rises a little out of the rib, then hangs.
        const points = Array.from({ length: 4 }, (_, k) => {
          const u = k / 3
          return origin.clone().addScaledVector(out, reach * u * (1 - .12 * u)).addScaledVector(up, reach * (.3 * u - hang * u * u))
        })
        const across = new Vector3().crossVectors(out, up).normalize()
        strip(b, points, across, (u) => .046 * (1 - u * .82), green, pale.clone().multiplyScalar(.92 + random() * .16))
      }
    }
  }
  return finish(b)
}

/** A clipped boxwood sphere, with the slight unevenness of a living one. */
function topiary() {
  const geometry = new IcosahedronGeometry(.5, 3)
  const position = geometry.getAttribute('position')
  const vertex = new Vector3()
  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i)
    const lump = 1 + Math.sin(vertex.x * 9.1 + 1.3) * Math.sin(vertex.y * 8.3 + .4) * Math.sin(vertex.z * 9.7 - .8) * .035
    position.setXYZ(i, vertex.x * lump, vertex.y * lump, vertex.z * lump)
  }
  geometry.computeVertexNormals()
  return geometry
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
  // The two tiers either side of the main stair (restructure_front.py): grasses
  // as the base layer, agaves in rhythm, so the planting follows the
  // architecture instead of hiding it.
  { minX: -1.45, maxX: 2.6, minZ: 19.5, maxZ: 21.5, count: 16, mix: [['grass', .65], ['agave', .35]], seed: 11 },
  { minX: 5.85, maxX: 10.3, minZ: 19.5, maxZ: 21.5, count: 18, mix: [['grass', .65], ['agave', .35]], seed: 12 },
  { minX: -1.45, maxX: 2.6, minZ: 22.05, maxZ: 25.15, count: 18, mix: [['grass', .6], ['agave', .25], ['topiary', .15]], seed: 13 },
  { minX: 5.85, maxX: 10.3, minZ: 22.05, maxZ: 25.15, count: 20, mix: [['grass', .6], ['agave', .25], ['topiary', .15]], seed: 14 },
  // Planted strip between the driveway and the parvis.
  { minX: -2.18, maxX: -2.0, minZ: 25.9, maxZ: 32.1, count: 10, mix: [['grass', 1]], seed: 15 },
  // Along the east walk to the terrace.
  { minX: 6.35, maxX: 7.15, minZ: 7.5, maxZ: 15.4, count: 12, mix: [['grass', 1]], seed: 2 },
  // Bed over the carport, west.
  { minX: -13.2, maxX: -2.9, minZ: 18.5, maxZ: 21.7, count: 30, mix: [['grass', .55], ['agave', .2], ['topiary', .25]], seed: 4 },
  // East wall in two steps: trailing grasses on the low shelf, agaves above.
  { minX: 10.75, maxX: 11.75, minZ: 19.7, maxZ: 32.4, count: 22, mix: [['grass', .85], ['agave', .15]], seed: 16 },
  { minX: 12.1, maxX: 15, minZ: 18.6, maxZ: 31, count: 28, mix: [['grass', .55], ['agave', .45]], seed: 6 },
  // West lawn: clipped spheres only.
  { minX: -12.7, maxX: -8.0, minZ: 23, maxZ: 32.2, count: 7, mix: [['topiary', 1]], seed: 7 },
]

/** Hand-placed palms framing the stair and the door. */
/** A pair at the outer ends of the upper tier, clear of the door axis, and one on the west lawn. */
const PALMS: [number, number, number][] = [[-1.05, 20.5, 4.1], [9.6, 20.5, 4.1], [-10.6, 27.6, 3.9]]

export function Garden({ mobile, ambience, progress }: { mobile: boolean; ambience: Ambience; progress: number }) {
  const scene = useThree((state) => state.scene)
  const [instances, setInstances] = useState<Record<Kind, Matrix4[]> | null>(null)

  const geometries = useMemo(() => ({
    grass: grassClump(),
    agave: agave(),
    topiary: topiary(),
    trunk: palmTrunk(),
    crown: palmCrown(),
  }), [])

  const materials = useMemo(() => {
    // Grasses and fronds share a look but not a way of moving: a blade bends
    // from its foot, a frond from the crown outwards.
    const foliage = new MeshStandardMaterial({ name: 'KD_GRASS', vertexColors: true, side: DoubleSide, roughness: .78, metalness: 0, envMapIntensity: .7 })
    const fronds = new MeshStandardMaterial({ name: 'KD_FRONDS', vertexColors: true, side: DoubleSide, roughness: .7, metalness: 0, envMapIntensity: .7 })
    const succulent = new MeshStandardMaterial({ name: 'KD_AGAVE', vertexColors: true, side: DoubleSide, roughness: .55, metalness: 0, envMapIntensity: .9 })
    applyWind(foliage, { height: .95, strength: .075, flutter: .1 })
    applyWind(fronds, { reach: .42, height: .1, strength: .14, flutter: .16 })
    applyWind(succulent, { height: 1.3, strength: .007, flutter: 0 })
    const boxwood = new MeshStandardMaterial({ color: '#41592c', roughness: .92, metalness: 0, envMapIntensity: .6 })
    applyVariation(boxwood, { scale: .12, albedo: .35, roughness: .05, hueDrift: .1 })
    const trunk = new MeshStandardMaterial({ vertexColors: true, roughness: .9, metalness: 0 })
    return { foliage, fronds, succulent, boxwood, trunk }
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

  // Crowns sit on top of each trunk, scaled to the trunk's height.
  const crowns = useMemo(() => (instances?.palm ?? []).map((matrix) => {
    const position = new Vector3(), rotation = new Quaternion(), scale = new Vector3()
    matrix.decompose(position, rotation, scale)
    // The trunk's lean is .35 m at its top (see palmTrunk), turned with the trunk.
    const top = new Vector3(.35, scale.y, 0).applyQuaternion(rotation)
    return new Matrix4().compose(position.clone().add(top), rotation, new Vector3(1, 1, 1))
  }), [instances])

  // Three birds on the palm right of the stair, two on the one to its left.
  const perches = useMemo(() => ([[1, 0], [1, 1], [1, 2], [0, 3], [0, 4]] as const)
    .filter(([crown]) => crowns[crown])
    .map(([crown, perch]) => PALM_PERCHES[perch].clone().applyMatrix4(crowns[crown])), [crowns])

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
    return [
      make(geometries.grass, materials.foliage, instances.grass, 'KD garden grasses'),
      make(geometries.agave, materials.succulent, instances.agave, 'KD garden agaves'),
      make(geometries.topiary, materials.boxwood, instances.topiary, 'KD garden topiaries'),
      make(geometries.trunk, materials.trunk, instances.palm, 'KD garden palm trunks'),
      make(geometries.crown, materials.fronds, crowns, 'KD garden palm crowns'),
    ].filter(Boolean) as InstancedMesh[]
  }, [instances, crowns, geometries, materials, mobile])

  // Plants read a touch lighter at night, lifted by their uplights.
  useLayoutEffect(() => {
    materials.foliage.envMapIntensity = ambience.mode === 'night' ? 1.4 : .7
    materials.fronds.envMapIntensity = ambience.mode === 'night' ? 1.4 : .7
  }, [ambience, materials])

  useFrame((state) => { WIND_TIME.value = state.clock.elapsedTime })

  return <>
    {meshes?.map((mesh) => <primitive key={mesh.name} object={mesh} />)}
    {perches.length > 0 && <PalmBirds perches={perches} mobile={mobile} progress={progress} visible={ambience.daySky} />}
  </>
}
