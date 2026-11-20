import { useGLTF, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { BufferAttribute, BufferGeometry, Color, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, RepeatWrapping, SphereGeometry, Vector3, type Texture } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { applyVariation } from './realism/materialVariation'

/**
 * The plot used to stop dead at its own edge: past the retaining walls the
 * camera saw the bottom half of the sky probe — a blurred beach and a city
 * skyline — where a coastal hillside villa should have land falling away to
 * the sea. This adds the land, its scrub and the sea: three draw calls.
 *
 * The hills used to read as one dark olive mass, because vertex colour, base
 * colour and the grass photograph were multiplied together (about 1.5 %
 * albedo). The vertex colours are now light tints that only steer the hue
 * between dry and lush, and the slopes carry clumps of maquis — rounded
 * evergreen shrubs, one instanced mesh — which is what gives a Mediterranean
 * hillside its grain at a distance.
 *
 * Orientation follows the villa: the road and the hill behind it to the north
 * (+z), the terrace, pool and the view to the south (−z).
 */
/** Inset by 1.2 m below, so the seam always sits under the plot's own ground, verge and road. */
const PLOT = { minX: -19.5, maxX: 16.2, minZ: -12.5, maxZ: 43.3 }
const SEA_LEVEL = -26
const RINGS = 46
const SEGMENTS = 128
const OUTER_RADIUS = 1500

function hash(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function noise(x: number, z: number) {
  const ix = Math.floor(x), iz = Math.floor(z)
  const fx = x - ix, fz = z - iz
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz)
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1)
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz
}
function fbm(x: number, z: number) {
  let value = 0, amplitude = .5, frequency = 1
  for (let octave = 0; octave < 5; octave += 1) {
    value += amplitude * noise(x * frequency, z * frequency)
    frequency *= 2.07
    amplitude *= .5
  }
  return value
}

/** Signed height of the land around the plot. */
function heightAt(x: number, z: number) {
  const dx = Math.max(PLOT.minX - x, 0, x - PLOT.maxX)
  const dzNorth = Math.max(0, z - PLOT.maxZ)
  const dzSouth = Math.max(0, PLOT.minZ - z)
  const distance = Math.hypot(dx, Math.max(dzNorth, dzSouth))
  const relief = (fbm(x / 70, z / 70) - .5) * Math.min(distance * .18, 26)
  // The hill keeps rising behind the road, the slope drops towards the sea in
  // front of the terrace, and the flanks fall away gently on both sides.
  const rise = dzNorth * .11 * (1 - Math.min(1, dzNorth / 900) * .5)
  const fall = dzSouth * .19 + dx * .07 * (z < 10 ? 1.4 : .6)
  return .35 + rise - fall + relief
}

function buildTerrain() {
  const positions: number[] = []
  const colors: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const centreX = (PLOT.minX + PLOT.maxX) / 2
  const centreZ = (PLOT.minZ + PLOT.maxZ) / 2
  const halfX = (PLOT.maxX - PLOT.minX) / 2 - 1.2
  const halfZ = (PLOT.maxZ - PLOT.minZ) / 2 - 1.2
  const dry = new Color('#e3d6b2')
  const lush = new Color('#a9b889')
  const color = new Color()

  for (let ring = 0; ring <= RINGS; ring += 1) {
    // Dense next to the plot where the camera looks closely, sparse far out.
    const t = Math.pow(ring / RINGS, 2.4)
    for (let segment = 0; segment <= SEGMENTS; segment += 1) {
      const angle = (segment / SEGMENTS) * Math.PI * 2
      const cos = Math.cos(angle), sin = Math.sin(angle)
      // Where this ray leaves the (slightly inset) plot rectangle.
      const edge = Math.min(halfX / Math.max(1e-6, Math.abs(cos)), halfZ / Math.max(1e-6, Math.abs(sin)))
      const radius = edge + t * (OUTER_RADIUS - edge)
      const x = centreX + cos * radius
      const z = centreZ + sin * radius
      // Tucked under the plot's own ground at the seam so no gap ever shows.
      const y = ring === 0 ? .2 : heightAt(x, z)
      positions.push(x, y, z)
      uvs.push(x / 7, z / 7)
      const wet = fbm(x / 38 + 4, z / 38 - 2)
      color.copy(dry).lerp(lush, Math.min(1, Math.max(0, (wet - .32) * 1.8)))
      // Lower ground near the sea is greener, high ground drier.
      color.multiplyScalar(.9 + fbm(x / 9, z / 9) * .25)
      colors.push(color.r, color.g, color.b)
    }
  }
  const row = SEGMENTS + 1
  for (let ring = 0; ring < RINGS; ring += 1) {
    for (let segment = 0; segment < SEGMENTS; segment += 1) {
      const a = ring * row + segment
      const b = a + row
      indices.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

/** Clumps of evergreen scrub on the slopes, densest near the plot. */
function buildScrub() {
  let seed = 20261120
  const random = () => {
    seed = (seed + 0x6d2b79f5) >>> 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  // One shrub: two lumpy lobes leaning on each other, smooth-shaded and
  // darker underneath; turned, scaled and squashed per instance.
  const lobe = (radius: number, x: number, y: number, z: number, phase: number) => {
    const part = new SphereGeometry(radius, 9, 6)
    const position = part.getAttribute('position')
    const vertex = new Vector3()
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index)
      const lump = 1 + Math.sin(vertex.x * 4.3 + phase) * Math.sin(vertex.y * 3.7 + phase * 1.7) * Math.sin(vertex.z * 4.9 - phase) * .32
      vertex.multiplyScalar(lump)
      position.setXYZ(index, vertex.x + x, Math.max(vertex.y + y, -.2), vertex.z + z)
    }
    return part
  }
  const geometry = mergeGeometries([lobe(1, 0, 0, 0, .6), lobe(.72, .78, -.12, .34, 2.1)])
  geometry.computeVertexNormals()
  const position = geometry.getAttribute('position')
  const shade = new Float32Array(position.count * 3)
  for (let index = 0; index < position.count; index += 1) {
    const light = .38 + .62 * Math.min(1, Math.max(0, position.getY(index) * .62 + .5))
    shade.set([light, light, light], index * 3)
  }
  geometry.setAttribute('color', new BufferAttribute(shade, 3))

  const centreX = (PLOT.minX + PLOT.maxX) / 2
  const centreZ = (PLOT.minZ + PLOT.maxZ) / 2
  const matrices: Matrix4[] = []
  const tints: Color[] = []
  const palette = [new Color('#58653a'), new Color('#3f5131'), new Color('#6b6f47'), new Color('#4a5937'), new Color('#7b7a55')]
  const up = new Vector3(0, 1, 0)
  for (let attempt = 0; attempt < 14000 && matrices.length < 760; attempt += 1) {
    const angle = random() * Math.PI * 2
    const radius = 40 + Math.pow(random(), 1.7) * 680
    const x = centreX + Math.cos(angle) * radius
    const z = centreZ + Math.sin(angle) * radius
    // Waist-high next to the plot; what stands out from far off is a thicket.
    const size = (.55 + Math.pow(random(), 2.4) * 1.5) * (1 + radius / 190)
    const squash = .55 + random() * .4
    const turn = random() * Math.PI * 2
    const pick = random()
    const tone = .8 + random() * .4
    // Clear of the plot, its road and the villa's own garden.
    if (x > PLOT.minX - 12 && x < PLOT.maxX + 12 && z > PLOT.minZ - 12 && z < PLOT.maxZ + 16) continue
    // Scrub grows in drifts, and leaves the dry ridges bare.
    if (fbm(x / 46 + 9, z / 46 - 3) < .47 + (pick - .5) * .12) continue
    const y = heightAt(x, z)
    if (y < SEA_LEVEL + 2) continue
    matrices.push(new Matrix4().compose(
      new Vector3(x, y + size * squash * .12, z),
      new Quaternion().setFromAxisAngle(up, turn),
      new Vector3(size, size * squash, size),
    ))
    tints.push(palette[Math.floor(pick * palette.length) % palette.length].clone().multiplyScalar(tone))
  }
  const material = new MeshStandardMaterial({ name: 'KD_SCRUB', vertexColors: true, roughness: .92, metalness: 0, envMapIntensity: .7 })
  const mesh = new InstancedMesh(geometry, material, matrices.length)
  matrices.forEach((matrix, index) => {
    mesh.setMatrixAt(index, matrix)
    mesh.setColorAt(index, tints[index])
  })
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.name = 'KD surroundings scrub'
  mesh.castShadow = false
  mesh.receiveShadow = false
  mesh.computeBoundingSphere()
  return mesh
}

const tiled = (texture: Texture | null | undefined, repeat: number) => {
  if (!texture) return null
  const clone = texture.clone()
  clone.wrapS = RepeatWrapping
  clone.wrapT = RepeatWrapping
  clone.repeat.set(repeat, repeat)
  clone.anisotropy = 8
  clone.needsUpdate = true
  return clone
}

export function Surroundings({ model }: { model: string }) {
  const { materials } = useGLTF(model, true, true)
  const geometry = useMemo(buildTerrain, [])
  const scrub = useMemo(buildScrub, [])

  const land = useMemo(() => {
    const grass = materials.Ground003 as MeshStandardMaterial | undefined
    const material = new MeshStandardMaterial({
      name: 'KD_SURROUNDING_LAND',
      vertexColors: true,
      roughness: .96,
      metalness: 0,
      map: tiled(grass?.map, 1),
      normalMap: tiled(grass?.normalMap, 1),
      envMapIntensity: .8,
    })
    // The photographic grass is already green: the vertex colours only steer it
    // between dry and lush. Lifted above 1, because that photograph is of a
    // lawn in shade and a hillside in the sun is twice as bright.
    material.color.setRGB(1.22, 1.17, 1.04)
    // …and that photograph is a saturated spring green; dry hillside grass is not.
    applyVariation(material, { scale: 26, albedo: .22, roughness: .04, hueDrift: .14, grade: { saturation: .62, tint: '#fff8ea' } })
    return material
  }, [materials])

  const ripples = useTexture('/assets/materials/detail/water-normal.webp')
  const sea = useMemo(() => {
    // A swell every ~28 m: at the distance the sea is seen from, anything
    // finer only shimmers.
    const normalMap = tiled(ripples, 250)
    const material = new MeshStandardMaterial({
      name: 'KD_SEA',
      color: '#1d5068',
      roughness: .14,
      metalness: 0,
      normalMap,
      envMapIntensity: 1.2,
    })
    material.normalScale.set(.55, .55)
    return material
  }, [ripples])

  useFrame((_, delta) => {
    const map = sea.normalMap
    if (map) map.offset.x = (map.offset.x + Math.min(delta, .05) * .0009) % 1
  })

  return <>
    <mesh geometry={geometry} material={land} receiveShadow name="KD surroundings land" />
    <primitive object={scrub} />
    <mesh material={sea} rotation-x={-Math.PI / 2} position={[0, SEA_LEVEL, 0]} name="KD surroundings sea">
      <planeGeometry args={[7000, 7000]} />
    </mesh>
  </>
}
