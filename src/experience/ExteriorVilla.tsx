import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { DoubleSide, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, RepeatWrapping, Texture } from 'three'
import { VILLA_POSITION, VILLA_SCALE } from './VillaTransform'

const DESKTOP_MODEL = '/models/exterior/kaydan-coastal-villa-web.glb'
const MOBILE_MODEL = '/models/exterior/kaydan-coastal-villa-mobile.glb'
const PRODUCTION_DESKTOP_MODEL = '/models/production/kaydan-villa-production-web.glb'
const PRODUCTION_MOBILE_MODEL = '/models/production/kaydan-villa-production-mobile.glb'

export function ExteriorVilla({ mobile }: { mobile: boolean }) {
  const production = typeof window === 'undefined' || new URLSearchParams(window.location.search).get('legacy3d') !== 'true'
  const path = production
    ? (mobile ? PRODUCTION_MOBILE_MODEL : PRODUCTION_DESKTOP_MODEL)
    : (mobile ? MOBILE_MODEL : DESKTOP_MODEL)
  const gltf = useGLTF(path, true, true)
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene])
  const animatedWaterMaps = useRef(new Set<Texture>())

  useLayoutEffect(() => {
    animatedWaterMaps.current.clear()
    scene.traverse((child) => {
      const blocksEntrance = ['ferns_1', 'plants', 'plants_003', 'rock_006', 'trop_leav_4', 'trop_leav_5', 'trop_leav_5_001'].includes(child.name)
      if (blocksEntrance || child.name.startsWith('DogwoodTree_001') || child.name.startsWith('Oak+Tree_260112')) {
        child.visible = false
        return
      }
      if (!(child instanceof Mesh)) return
      child.castShadow = !mobile
      child.receiveShadow = true
      child.frustumCulled = true
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      for (const material of materials) {
        if (!(material instanceof MeshStandardMaterial)) continue
        if (material.map) material.map.anisotropy = mobile ? 2 : 8
        material.envMapIntensity = /Glass|Water|Chrome|Metal/i.test(material.name) ? 1.45 : .9
        if (/Glass$|Glassend/i.test(material.name) && material instanceof MeshPhysicalMaterial) {
          material.transmission = .76
          material.thickness = .09
          material.ior = 1.48
          material.roughness = .08
          material.opacity = 1
          material.transparent = false
        }
        if (/Water/i.test(material.name)) {
          material.color.set('#72aeb7')
          material.roughness = .12
          material.metalness = .08
          const waterMap = material.normalMap ?? material.map
          if (waterMap) {
            waterMap.wrapS = RepeatWrapping
            waterMap.wrapT = RepeatWrapping
            animatedWaterMaps.current.add(waterMap)
          }
        }
        if (/Couch|DiningRug|Carpet/i.test(material.name)) material.roughness = .88
        if (/TilesTravertine|Concrete|rock_wall|stone_pathway/i.test(material.name)) material.roughness = .74
        if (/Dogwood|Oak_Tree|ferns|trop_leav/i.test(material.name)) {
          material.color.set('#718560')
          material.emissive.set('#1d2918')
          material.emissiveIntensity = .32
          material.roughness = .84
          material.alphaTest = .35
          material.side = DoubleSide
        }
        material.needsUpdate = true
      }
    })
  }, [mobile, scene])

  useFrame((_, delta) => {
    const speed = Math.min(delta, .05)
    animatedWaterMaps.current.forEach((texture) => {
      texture.offset.x = (texture.offset.x + speed * .012) % 1
      texture.offset.y = (texture.offset.y + speed * .006) % 1
    })
  })

  return <primitive
    object={scene}
    name="KAYDAN exterior villa"
    position={production ? [0, 0, 0] : VILLA_POSITION}
    scale={production ? 1 : VILLA_SCALE}
  />
}

if (typeof window !== 'undefined') {
  const production = new URLSearchParams(window.location.search).get('legacy3d') !== 'true'
  const preloadPath = production
    ? (window.matchMedia('(max-width: 767px)').matches ? PRODUCTION_MOBILE_MODEL : PRODUCTION_DESKTOP_MODEL)
    : (window.matchMedia('(max-width: 767px)').matches ? MOBILE_MODEL : DESKTOP_MODEL)
  useGLTF.preload(preloadPath, true, true)
}
