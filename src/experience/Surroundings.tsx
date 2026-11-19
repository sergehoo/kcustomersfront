import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { BufferAttribute, BufferGeometry, Color, MeshStandardMaterial, RepeatWrapping, type Texture } from 'three'
import { applyVariation } from './realism/materialVariation'

/**
 * The plot used to stop dead at its own edge: past the retaining walls the
 * camera saw the bottom half of the sky probe — a blurred beach and a city
 * skyline — where a coastal hillside villa should have land falling away to
 * the sea. This adds the land and the sea, nothing else: no props, two draw
 * calls, ~14 k triangles.
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
  const dry = new Color('#8c8463')
  const lush = new Color('#4f5f33')
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
    // The photographic grass is already green: let the vertex colours steer it
    // between dry and lush rather than tint it twice.
    material.color.set('#c9c4b2')
    applyVariation(material, { scale: 26, albedo: .22, roughness: .04, hueDrift: .14 })
    return material
  }, [materials])

  const sea = useMemo(() => {
    const water = materials.Water as MeshStandardMaterial | undefined
    const normalMap = tiled(water?.normalMap, 900)
    return new MeshStandardMaterial({
      name: 'KD_SEA',
      color: '#1c4757',
      roughness: .16,
      metalness: 0,
      normalMap,
      envMapIntensity: 1.15,
    })
  }, [materials])

  useFrame((_, delta) => {
    const map = sea.normalMap
    if (map) map.offset.x = (map.offset.x + Math.min(delta, .05) * .0009) % 1
  })

  return <>
    <mesh geometry={geometry} material={land} receiveShadow name="KD surroundings land" />
    <mesh material={sea} rotation-x={-Math.PI / 2} position={[0, SEA_LEVEL, 0]} name="KD surroundings sea">
      <planeGeometry args={[7000, 7000]} />
    </mesh>
  </>
}
