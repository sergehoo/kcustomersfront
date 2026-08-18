import { useGLTF, useTexture } from '@react-three/drei'
import { useCallback, useLayoutEffect, useMemo } from 'react'
import {
  DoubleSide,
  Mesh,
  Material,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  Object3D,
  SRGBColorSpace,
  Texture,
} from 'three'

type Placement = {
  position: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
}

const CHAIR = '/models/external/furniture/modern-arm-chair.glb'
const LAMP = '/models/external/lighting/modern-ceiling-lamp.glb'
const CALATHEA = '/models/external/vegetation/calathea-orbifolia.glb'

const chairPlacements: Placement[] = [
  { position: [-2.65, 0, 11.35], rotation: [0, .2, 0] },
  { position: [.25, 0, 11.35], rotation: [0, -.18, 0] },
  { position: [-5.25, 0, 4.65], rotation: [0, -.3, 0] },
  { position: [-4.45, 0, -14.8], rotation: [0, 1.15, 0] },
  { position: [-2.8, 0, -22.2], rotation: [0, .55, 0] },
  { position: [2.6, 0, -22.2], rotation: [0, -.55, 0] },
  { position: [-2.7, 0, -24.5], rotation: [0, 2.55, 0] },
  { position: [2.5, 0, -24.5], rotation: [0, -2.55, 0] },
]

const lampPlacements: Placement[] = [
  { position: [-1, 3.5, 1.9] },
  { position: [1.2, 3.5, 1.9] },
  { position: [3.4, 3.5, 1.9] },
  { position: [3.7, 3.5, -6.9] },
  { position: [.2, 3.5, -16] },
]

const calatheaPlacements: Placement[] = [
  { position: [-6.75, .02, 12.6], rotation: [0, .45, 0], scale: .7 },
  { position: [6.4, .02, 11.7], rotation: [0, -.4, 0], scale: .62 },
  { position: [-7.1, .02, -8.2], rotation: [0, .25, 0], scale: .55 },
  { position: [6.8, .02, -16.9], rotation: [0, .5, 0], scale: .7 },
  { position: [-6.4, .02, -24.25], rotation: [0, -.3, 0], scale: .72 },
  { position: [6.35, .02, -24.4], rotation: [0, .4, 0], scale: .68 },
]

function cloneForPlacement(source: Object3D) {
  const clone = source.clone(true)
  clone.traverse((child) => {
    if (!(child instanceof Mesh)) return
    child.material = Array.isArray(child.material)
      ? child.material.map((material) => material.clone())
      : child.material.clone()
    child.castShadow = true
    child.receiveShadow = true
  })
  return clone
}

function ModelInstances({ source, placements, prepare }: { source: Object3D; placements: Placement[]; prepare?: (object: Object3D) => void }) {
  const instances = useMemo(() => placements.map(() => {
    const object = cloneForPlacement(source)
    prepare?.(object)
    return object
  }), [placements, prepare, source])
  return <>{instances.map((object, index) => {
    const placement = placements[index]
    return <primitive
      key={index}
      object={object}
      position={placement.position}
      rotation={placement.rotation ?? [0, 0, 0]}
      scale={placement.scale ?? 1}
    />
  })}</>
}

function configureTexture(texture: Texture | undefined, color = false) {
  if (!texture) return
  texture.colorSpace = color ? SRGBColorSpace : NoColorSpace
  texture.anisotropy = 8
}

function replaceMaterials(mesh: Mesh, replace: (material: Material) => Material) {
  mesh.material = Array.isArray(mesh.material)
    ? mesh.material.map(replace)
    : replace(mesh.material)
}

export function ImportedAssets({ mobile }: { mobile: boolean }) {
  const chair = useGLTF(CHAIR).scene
  const lamp = useGLTF(LAMP).scene
  const calathea = useGLTF(CALATHEA).scene
  const textile = useTexture(mobile ? {
    color: '/assets/materials-1k/wool_boucle/basecolor.webp',
  } : {
    color: '/assets/materials-1k/wool_boucle/basecolor.webp',
    normal: '/assets/materials-1k/wool_boucle/normal.webp',
    roughness: '/assets/materials-1k/wool_boucle/roughness.webp',
  }) as Record<string, Texture>

  useLayoutEffect(() => {
    configureTexture(textile.color, true)
    configureTexture(textile.normal)
    configureTexture(textile.roughness)
  }, [textile])

  const prepareChair = useCallback((object: Object3D) => object.traverse((child) => {
      if (!(child instanceof Mesh)) return
      replaceMaterials(child, (source) => source.name.includes('pillow')
        ? new MeshStandardMaterial({
          name: 'kaydan_boucle_upholstery',
          color: '#b8a896',
          normalMap: textile.normal ?? null,
          roughnessMap: textile.roughness ?? null,
          roughness: .86,
        })
        : source)
    }), [textile])

  const prepareLamp = useCallback((object: Object3D) => object.traverse((child) => {
      if (!(child instanceof Mesh)) return
      replaceMaterials(child, (source) => source.name.includes('globe')
        ? new MeshPhysicalMaterial({
          name: 'kaydan_frosted_glass',
          color: '#f5e5c9',
          emissive: '#f2b766',
          emissiveIntensity: .3,
          roughness: .18,
          transmission: .36,
          thickness: .08,
          ior: 1.45,
        })
        : source)
    }), [])

  const preparePlant = useCallback((object: Object3D) => object.traverse((child) => {
      if (!(child instanceof Mesh)) return
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      for (const material of materials) {
        if (!(material instanceof MeshStandardMaterial) || !material.name.includes('leaves')) continue
        material.alphaTest = .42
        material.side = DoubleSide
        material.roughness = .78
        material.needsUpdate = true
      }
    }), [])

  return <group name="Kaydan curated external assets">
    <ModelInstances source={chair} placements={chairPlacements} prepare={prepareChair} />
    <ModelInstances source={lamp} placements={lampPlacements} prepare={prepareLamp} />
    <ModelInstances source={calathea} placements={mobile ? calatheaPlacements.slice(0, 3) : calatheaPlacements} prepare={preparePlant} />
  </group>
}

for (const path of [CHAIR, LAMP, CALATHEA]) useGLTF.preload(path)
