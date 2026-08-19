import { useGLTF, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { DoubleSide, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, RepeatWrapping, Texture, Vector2 } from 'three'

const DESKTOP_MODEL = '/models/production/kaydan-villa-production-web.glb'
const MOBILE_MODEL = '/models/production/kaydan-villa-production-mobile.glb'

/** Material names come from the production GLB — verified with `npm run inspect:glb`. */
const GLASS = /^Glass|Glassend|911Glass|modern_ceiling_lamp_01_glass/i
const WATER = /^Water$/i
const FOLIAGE = /^GG0500|calathea_orbifolia|potted_plant_01_leaves/i
const SOFT = /DiningChair|DiningRug|Carpet_Plush/i
const STONE = /KAYDAN_TRAVERTINE|rock_wall_11|stone_pathway|Ground003|Rock0/i
const REFLECTIVE = /Glass|Water|Chrome|Gold|Metal|Brass/i
/** The villa's render surfaces: large, untextured and dead flat until now. */
const PLASTER = /KAYDAN_PLASTER|Plaster|Concrete048|Material\.001|^material/i
const MASONRY = /rock_wall_11|KAYDAN_TRAVERTINE|stone_pathway/i

export function ExteriorVilla({ mobile }: { mobile: boolean }) {
  const gltf = useGLTF(mobile ? MOBILE_MODEL : DESKTOP_MODEL, true, true)
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene])
  const animatedWaterMaps = useRef(new Set<Texture>())
  // 20 kB of detail maps buy the render surfaces micro-relief. Without them the
  // plaster and concrete return a single flat value per face and the façade reads
  // as an untextured massing model however good the lighting is.
  const [plasterNormal, plasterRoughness, stoneNormal] = useTexture([
    '/assets/materials/detail/plaster-normal.webp',
    '/assets/materials/detail/plaster-roughness.webp',
    '/assets/materials/detail/stone-normal.webp',
  ])

  useLayoutEffect(() => {
    animatedWaterMaps.current.clear()
    for (const texture of [plasterNormal, plasterRoughness, stoneNormal]) {
      texture.wrapS = RepeatWrapping
      texture.wrapT = RepeatWrapping
      texture.anisotropy = mobile ? 2 : 8
    }
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

        // Detail maps are only applied where the GLB supplies none of its own, so
        // nothing that is already textured gets overwritten.
        if (PLASTER.test(name) && !material.normalMap) {
          material.normalMap = plasterNormal.clone()
          material.normalMap.repeat.set(9, 9)
          material.normalMap.needsUpdate = true
          material.normalScale = new Vector2(.34, .34)
          if (!material.roughnessMap) {
            material.roughnessMap = plasterRoughness.clone()
            material.roughnessMap.repeat.set(9, 9)
            material.roughnessMap.needsUpdate = true
          }
          // A touch below fully matt so the volumes separate under a low sun.
          material.roughness = .78
          material.envMapIntensity = 1.05
        }
        if (MASONRY.test(name) && !material.normalMap) {
          material.normalMap = stoneNormal.clone()
          material.normalMap.repeat.set(6, 6)
          material.normalMap.needsUpdate = true
          material.normalScale = new Vector2(.55, .55)
          material.envMapIntensity = 1.0
        }
        if (FOLIAGE.test(name)) {
          // Cut-out leaves: without an alpha test they render as opaque cards.
          material.alphaTest = .35
          material.side = DoubleSide
          material.roughness = .84
        }
        material.needsUpdate = true
      }
    })
  }, [mobile, scene, plasterNormal, plasterRoughness, stoneNormal])

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
