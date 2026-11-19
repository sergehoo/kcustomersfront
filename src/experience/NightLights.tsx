import { useLayoutEffect, useMemo, useState } from 'react'
import {
  AdditiveBlending, CanvasTexture, InstancedMesh, Matrix4, MeshBasicMaterial, PlaneGeometry, Quaternion, SRGBColorSpace, Vector3,
} from 'three'
import type { Ambience } from './ambience'

/**
 * Night architectural lighting, drawn rather than computed.
 *
 * Each real light adds its cost to every pixel of every material. The
 * scallop a wall-washer throws up a white façade, the pool of a downlight on
 * a door and the glow an LED strip leaves on a riser are what the eye reads —
 * so they are painted as additive light decals at the exact fittings, and only
 * a handful of real lights (Lighting.tsx) carry the actual illumination.
 * By day the decals are hidden; toggling visibility never recompiles anything.
 */
type Decal = {
  /** Centre of the decal on the surface. */
  position: [number, number, number]
  /** Surface normal the decal faces (unit axis). */
  normal: [number, number, number]
  size: [number, number]
  kind: 'scallop' | 'downlight' | 'pool'
  color: string
  strength: number
}

const DECALS: Decal[] = [
  // Grazing uplight on the limestone tower (front face at z 17.32).
  { position: [.85, 6.5, 17.34], normal: [0, 0, 1], size: [1.7, 5.6], kind: 'scallop', color: '#ffc98c', strength: .95 },
  // Uplight on the porch column east of the door.
  { position: [6.58, 5.3, 18.04], normal: [0, 0, 1], size: [.75, 3.0], kind: 'scallop', color: '#ffd29e', strength: .8 },
  // West wing wash.
  { position: [-7.6, 6.1, 16.24], normal: [0, 0, 1], size: [1.5, 4.6], kind: 'scallop', color: '#ffd29e', strength: .75 },
  // Downlight from the porch soffit onto the pivot door, and its pool on the landing.
  { position: [4.225, 5.15, 16.34], normal: [0, 0, 1], size: [2.0, 2.8], kind: 'downlight', color: '#ffd7a6', strength: 1 },
  { position: [4.225, 3.815, 17.35], normal: [0, 1, 0], size: [3.6, 2.4], kind: 'pool', color: '#ffd3a0', strength: .7 },
]

/**
 * The main stair as built by `blender/scripts/restructure_front.py`: each LED
 * strip under a nosing washes the riser below it.
 */
const STAIR = { axis: 4.225, width: 2.4, top: 3.8, foot: .7, landingFront: 19.1, going: .32, midLanding: 1.6 }

function riserGlows() {
  const riser = (STAIR.top - STAIR.foot) / 18
  const matrices: Matrix4[] = []
  const flights = [
    { top: STAIR.top, start: STAIR.landingFront },
    { top: STAIR.top - 9 * riser, start: STAIR.landingFront + 8 * STAIR.going + STAIR.midLanding },
  ]
  for (const flight of flights) {
    for (let k = 1; k <= 8; k += 1) {
      const yTop = flight.top - k * riser
      const front = flight.start + k * STAIR.going
      const height = riser - .06
      matrices.push(new Matrix4().compose(
        new Vector3(STAIR.axis, yTop - .06 - height / 2, front - .026),
        new Quaternion(),
        new Vector3(STAIR.width - .24, height, 1),
      ))
    }
  }
  return matrices
}

function canvasTexture(draw: (context: CanvasRenderingContext2D, width: number, height: number) => void, width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')!
  draw(context, width, height)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/** Uplight scallop: hot spot at the foot, a soft parabola opening upwards. */
const scallop = () => canvasTexture((c, w, h) => {
  const image = c.createImageData(w, h)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const u = (x / (w - 1)) * 2 - 1
      const v = 1 - y / (h - 1)
      const spread = .18 + v * .82
      const lateral = Math.max(0, 1 - Math.pow(Math.abs(u) / spread, 2))
      const falloff = Math.pow(1 - v, 1.6) * (1 - Math.exp(-v * 18))
      const value = Math.min(1, lateral * falloff * 1.6)
      const i = (y * w + x) * 4
      image.data[i] = image.data[i + 1] = image.data[i + 2] = Math.round(value * 255)
      image.data[i + 3] = 255
    }
  }
  c.putImageData(image, 0, 0)
}, 64, 128)

/** Downlight: the same scallop, opening downwards from a crisp top edge. */
const downlight = () => canvasTexture((c, w, h) => {
  const image = c.createImageData(w, h)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const u = (x / (w - 1)) * 2 - 1
      const v = y / (h - 1)
      const spread = .2 + v * .8
      const lateral = Math.max(0, 1 - Math.pow(Math.abs(u) / spread, 2))
      const value = Math.min(1, lateral * Math.pow(1 - v, 1.2) * (1 - Math.exp(-v * 14)) * 1.5)
      const i = (y * w + x) * 4
      image.data[i] = image.data[i + 1] = image.data[i + 2] = Math.round(value * 255)
      image.data[i + 3] = 255
    }
  }
  c.putImageData(image, 0, 0)
}, 64, 128)

const pool = () => canvasTexture((c, w, h) => {
  const gradient = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
  gradient.addColorStop(0, '#ffffff')
  gradient.addColorStop(.35, '#8a8a8a')
  gradient.addColorStop(1, '#000000')
  c.fillStyle = gradient
  c.fillRect(0, 0, w, h)
}, 128, 128)

/** Riser glow below an LED nosing: bright under the strip, gone in 15 cm. */
const riser = () => canvasTexture((c, w, h) => {
  const gradient = c.createLinearGradient(0, 0, 0, h)
  gradient.addColorStop(0, '#ffffff')
  gradient.addColorStop(.25, '#9c9c9c')
  gradient.addColorStop(1, '#000000')
  c.fillStyle = gradient
  c.fillRect(0, 0, w, h)
}, 8, 64)

function decalMaterial(map: CanvasTexture, color: string, strength: number) {
  const material = new MeshBasicMaterial({
    map, color, transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  })
  material.color.multiplyScalar(strength)
  return material
}

export function NightLights({ ambience }: { ambience: Ambience }) {
  const [risers, setRisers] = useState<InstancedMesh | null>(null)
  const textures = useMemo(() => ({ scallop: scallop(), downlight: downlight(), pool: pool(), riser: riser() }), [])
  const plane = useMemo(() => new PlaneGeometry(1, 1), [])

  const decals = useMemo(() => DECALS.map((decal) => {
    const material = decalMaterial(textures[decal.kind], decal.color, decal.strength)
    const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(...decal.normal))
    return { decal, material, rotation }
  }), [textures])

  // Riser glows under the LED strips of the main stair.
  useLayoutEffect(() => {
    const matrices = riserGlows()
    const material = decalMaterial(textures.riser, '#ffc985', 1.1)
    const mesh = new InstancedMesh(plane, material, matrices.length)
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix))
    mesh.name = 'KD night riser glow'
    mesh.frustumCulled = false
    setRisers(mesh)
    return () => { material.dispose() }
  }, [plane, textures])

  const visible = ambience.decals > 0
  for (const { material, decal } of decals) material.opacity = ambience.decals * Math.min(1, decal.strength + .2)

  return <group name="KD night lights" visible={visible}>
    {decals.map(({ decal, material, rotation }, index) => <mesh
      key={index}
      geometry={plane}
      material={material}
      position={decal.position}
      quaternion={rotation}
      scale={[decal.size[0], decal.size[1], 1]}
      renderOrder={2}
    />)}
    {risers && <primitive object={risers} />}
  </group>
}
