import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { DoubleSide, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, RepeatWrapping, Texture } from 'three'

const DESKTOP_MODEL = '/models/production/kaydan-villa-production-web.glb'
const MOBILE_MODEL = '/models/production/kaydan-villa-production-mobile.glb'

/** Material names come from the production GLB — verified with `npm run inspect:glb`. */
const GLASS = /^Glass|Glassend|911Glass|modern_ceiling_lamp_01_glass/i
const WATER = /^Water$/i
const FOLIAGE = /^GG0500|calathea_orbifolia|potted_plant_01_leaves/i
const SOFT = /DiningChair|DiningRug|Carpet_Plush/i
const STONE = /KAYDAN_TRAVERTINE|rock_wall_11|stone_pathway|Ground003|Rock0/i
const REFLECTIVE = /Glass|Water|Chrome|Gold|Metal|Brass/i

export function ExteriorVilla({ mobile }: { mobile: boolean }) {
  const gltf = useGLTF(mobile ? MOBILE_MODEL : DESKTOP_MODEL, true, true)
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene])
  const animatedWaterMaps = useRef(new Set<Texture>())

  useLayoutEffect(() => {
    animatedWaterMaps.current.clear()
    scene.traverse((child) => {
      if (!(child instanceof Mesh)) return
      child.castShadow = !mobile
      child.receiveShadow = true
      child.frustumCulled = true

      const materials = Array.isArray(child.material) ? child.material : [child.material]
      for (const material of materials) {
        if (!(material instanceof MeshStandardMaterial)) continue
        const name = material.name
        if (material.map) material.map.anisotropy = mobile ? 2 : 8
        material.envMapIntensity = REFLECTIVE.test(name) ? 1.45 : .9

        if (GLASS.test(name) && material instanceof MeshPhysicalMaterial) {
          material.transmission = .76
          material.thickness = .09
          material.ior = 1.48
          material.roughness = .08
          material.opacity = 1
          material.transparent = false
        }
        if (WATER.test(name)) {
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
        if (SOFT.test(name)) material.roughness = .88
        if (STONE.test(name)) material.roughness = .74
        if (FOLIAGE.test(name)) {
          // Cut-out leaves: without an alpha test they render as opaque cards.
          material.alphaTest = .35
          material.side = DoubleSide
          material.roughness = .84
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

  return <primitive object={scene} name="KAYDAN villa" />
}

if (typeof window !== 'undefined') {
  useGLTF.preload(window.matchMedia('(max-width: 767px)').matches ? MOBILE_MODEL : DESKTOP_MODEL, true, true)
}
