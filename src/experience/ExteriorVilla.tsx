import { useGLTF, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Box3, Color, DoubleSide, Group, MathUtils, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, NoColorSpace, RepeatWrapping, Texture, Vector2, type Object3D } from 'three'
import type { Ambience } from './ambience'
import { makeArchitecturalGlass } from './realism/glass'
import { applyVariation, type VariationOptions } from './realism/materialVariation'
import { doorOpeningAt } from './tour'

const DESKTOP_MODEL = '/models/production/kaydan-villa-production-web.glb'
const MOBILE_MODEL = '/models/production/kaydan-villa-production-mobile.glb'

export const villaModel = (mobile: boolean) => (mobile ? MOBILE_MODEL : DESKTOP_MODEL)

/** Material names come from the production GLB — verified with `npm run inspect:glb`. */
const GLAZING = /^(Glass|Glassend|911Glass|KAYDAN_INNER_GLASS|KAYDAN_TINTED_GLASS)$/
const WATER = /^Water$/i
const FOLIAGE = /^GG0500|calathea_orbifolia|potted_plant_01_leaves/i
const SOFT = /DiningChair|DiningRug|Carpet_Plush/i
const REFLECTIVE = /Glass|Water|Chrome|Gold|Metal|Brass/i
/** Furniture and decoration (furnish_interiors.py, build_upper_floor.py). */
const FURNISHING = /^(Living_|Dining_|Kitchen_(Stool|Bowl|Vase|Tray|Furniture)|Hall_|Landing_|Master_|Bath_|Bed2_|Terrace_|BED|NIGHTSTAND|DRESS_|BATH_|LAMP_|BENCH|SIDE_TABLE|CURTAIN)/

/** Surfaces authored in Blender, which export at roughness 1 — fully matt. */
const AUTHORED = /^KAYDAN_(FRONT_STONE|FRONT_STONE_WARM|TREAD|PAVING|ASPHALT|KERB|SOIL|LAWN|UPPER_)/i

/**
 * Per-material realism recipes. Scales are in metres and amplitudes are kept
 * small on purpose: the aim is to stop a 10 m face returning one flat value,
 * not to make the villa look weathered.
 */
const VARIATION: [RegExp, VariationOptions][] = [
  // Off-white render on every volume, as on the reference villas. Dirt is kept
  // very faint: on white it reads as neglect, not realism.
  [/^(Material\.001|KAYDAN_RENDER_WHITE)$/, { scale: 2.6, albedo: .045, roughness: .1, streaks: .07, grime: .12, dirt: '#6d6458', hueDrift: .012 }],
  [/^KAYDAN_PLASTER_IVORY$/, { scale: 2.6, albedo: .045, roughness: .1, streaks: .06, grime: .12, dirt: '#6d6458', hueDrift: .012 }],
  [/^KAYDAN_UPPER_PLASTER$|^material$/, { scale: 3.4, albedo: .05, roughness: .1, grime: .14, dirt: '#5b5246' }],
  // Honed limestone cladding in large panels (tower, cheeks, retaining walls),
  // replacing the rubble stone: mineral and warm, but architectural.
  [/^(rock_wall_11_disp_2k|KAYDAN_FRONT_STONE|KAYDAN_FRONT_STONE_WARM)$/, { scale: 1.8, albedo: .05, roughness: .08, hueDrift: .02, tiles: { floor: [1.2, .6], wall: [1.2, .6], joint: .008, jointColor: '#a2988a', tone: .05 } }],
  [/^KAYDAN_TRAVERTINE$/, { scale: 2.2, albedo: .06, roughness: .14, hueDrift: .03 }],
  // Large-format pale limestone outside: 120 × 60 cm, fine joints, slab-to-slab tone.
  [/^(KAYDAN_PAVING|stone_pathway_02)$/, { scale: 1.6, albedo: .05, roughness: .1, hueDrift: .02, tiles: { floor: [1.2, .6], wall: [1.2, .3], joint: .007, jointColor: '#9d9486', tone: .045 } }],
  [/^KAYDAN_TREAD$/, { scale: 1.1, albedo: .05, roughness: .1, hueDrift: .02, tiles: { floor: [1.2, .6], joint: .006, jointColor: '#a59b8c', tone: .04 } }],
  [/^KAYDAN_(ASPHALT|KERB)$/, { scale: 3.5, albedo: .12, roughness: .1 }],
  // Driveway in dark granite setts, so the car route reads apart from the parvis.
  [/^KAYDAN_DRIVE$/, { scale: 1.4, albedo: .08, roughness: .1, tiles: { floor: [.9, .45], joint: .008, jointColor: '#2c2a27', tone: .07 } }],
  [/^Ground003$/, { scale: 4.5, albedo: .2, roughness: .05, hueDrift: .12 }],
  [/^KAYDAN_(LAWN|SOIL)$/, { scale: 2.2, albedo: .16, roughness: .04, hueDrift: .1 }],
  [/^(KAYDAN_WOOD_WARM|KAYDAN_DARKWOOD|KAYDAN_UPPER_OAK)$/, { scale: 1.2, albedo: .06, roughness: .1 }],
  [/^KAYDAN_UPPER_MARBLE$/, { scale: 1.5, albedo: .04, roughness: .08 }],
]


/** One boxwood material per source lawn material, shared across remounts. */
const HEDGES = new WeakMap<MeshStandardMaterial, MeshStandardMaterial>()

export function ExteriorVilla({ mobile, ambience, progress }: { mobile: boolean; ambience: Ambience; progress: number }) {
  const gltf = useGLTF(villaModel(mobile), true, true)
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene])
  const animatedWaterMaps = useRef(new Set<Texture>())
  const [plasterNormal, plasterRoughness, stoneNormal, woodGrain] = useTexture([
    '/assets/materials/detail/plaster-normal.webp',
    '/assets/materials/detail/plaster-roughness.webp',
    '/assets/materials/detail/stone-normal.webp',
    '/assets/materials/detail/wood-grain.webp',
  ])

  useLayoutEffect(() => {
    animatedWaterMaps.current.clear()
    const anisotropy = mobile ? 2 : 8

    const donors = new Map<string, MeshStandardMaterial>()
    scene.traverse((child) => {
      if (!(child instanceof Mesh)) return
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
        if (material instanceof MeshStandardMaterial && material.map) donors.set(material.name, material)
      }
    })
    // Travertine, not the stone pathway: the pathway albedo is a dark grey and it
    // turned every tread near-black.
    const paveDonor = donors.get('KAYDAN_TRAVERTINE') ?? donors.get('stone_pathway_02')
    const grassDonor = donors.get('Ground003')

    const borrow = (target: MeshStandardMaterial, donor: MeshStandardMaterial | undefined, repeat: number, tint: string, mix: number) => {
      if (!donor?.map) return
      for (const slot of ['map', 'normalMap', 'roughnessMap'] as const) {
        const source = donor[slot]
        if (!source) continue
        const clone = source.clone()
        clone.wrapS = RepeatWrapping
        clone.wrapT = RepeatWrapping
        clone.repeat.set(repeat, repeat)
        clone.anisotropy = anisotropy
        clone.needsUpdate = true
        target[slot] = clone
      }
      target.color.set('#ffffff').lerp(new Color(tint), mix)
      target.normalScale = new Vector2(.8, .8)
      target.needsUpdate = true
    }

    const detail = (texture: Texture, repeatX: number, repeatY = repeatX) => {
      const clone = texture.clone()
      clone.wrapS = RepeatWrapping
      clone.wrapT = RepeatWrapping
      clone.repeat.set(repeatX, repeatY)
      clone.anisotropy = anisotropy
      clone.needsUpdate = true
      return clone
    }

    woodGrain.colorSpace = NoColorSpace
    for (const texture of [plasterNormal, plasterRoughness, stoneNormal, woodGrain]) {
      texture.wrapS = RepeatWrapping
      texture.wrapT = RepeatWrapping
      texture.anisotropy = anisotropy
    }

    scene.traverse((child) => {
      if (!(child instanceof Mesh)) return
      const materials = (Array.isArray(child.material) ? child.material : [child.material]) as MeshStandardMaterial[]
      const glazed = materials.some((material) => GLAZING.test(material.name) || material.transparent)

      // Only meshes big enough to throw a readable shadow are casters, and never
      // glazing: a pane that casts kept every room in the villa's own shadow, so
      // no patch of sun ever reached an interior floor.
      // World radius: the meshopt-quantised geometry is stored in normalised
      // units and scaled back by its node, so the local radius alone is meaningless.
      child.geometry.computeBoundingSphere()
      child.updateWorldMatrix(true, false)
      const radius = (child.geometry.boundingSphere?.radius ?? 0) * child.matrixWorld.getMaxScaleOnAxis()
      // Furnishing: only the large pieces (sofas, beds, tables, armchairs) throw
      // a sun shadow worth its pass — the shadow map covers the whole villa, so
      // every small interior piece was drawn into it from every camera.
      const furnishing = FURNISHING.test(child.name) || FURNISHING.test(child.parent?.name ?? '')
      child.castShadow = !mobile && !glazed && radius > (furnishing ? .75 : .35)
      child.receiveShadow = !glazed
      child.frustumCulled = true

      for (const material of materials) {
        if (!(material instanceof MeshStandardMaterial)) continue
        // Materials are shared with the GLTF cache: prepare once, never compound.
        if (material.userData.kdPrepared) continue
        material.userData.kdPrepared = true
        const name = material.name
        if (material.map) material.map.anisotropy = anisotropy
        material.envMapIntensity = REFLECTIVE.test(name) ? 1.3 : .95

        if (GLAZING.test(name)) {
          makeArchitecturalGlass(material, name === '911Glass'
            ? { tint: .32, color: '#1b2024' }
            : name === 'Glassend' ? { tint: .2, color: '#8fb3a4' }
              // Upper curtain wall: darker, so the room behind is only hinted at.
              : name === 'KAYDAN_TINTED_GLASS' ? { tint: .24, color: '#2b3236' } : { tint: .06, color: '#c3d1d4' })
          if (material instanceof MeshPhysicalMaterial) material.transmission = 0
          continue
        }

        // Luxury palette: off-white render, honed limestone, pale paving.
        // Material.001 was also exported as metalness 1 by mistake.
        if (name === 'Material.001' || name === 'KAYDAN_PLASTER_IVORY' || name === 'KAYDAN_RENDER_WHITE') {
          material.metalness = 0
          material.roughness = .82
          // Ivory / off-white rather than clinical white: it is what lets the
          // render take the sun warmly and separates it from the white sky.
          material.color.set(name === 'KAYDAN_PLASTER_IVORY' ? '#f1ebe0' : '#eee7db')
          // The GLB's render texture is a mid grey (sRGB 141 on average): it
          // dragged every "white" wall down to concrete. Grain comes from the
          // relief map and the variation shader instead.
          material.map = null
          // The interior plaster also kept that concrete's normal map: broad
          // blotches which, under a lamp grazing a wall, read as smoke stains
          // across the suite and the hall. Interior plaster stays smooth — a
          // fine relief tiled on this mesh's large UVs showed as a pattern.
          if (name === 'KAYDAN_PLASTER_IVORY') material.normalMap = null
        }
        if (/^(rock_wall_11_disp_2k|KAYDAN_FRONT_STONE|KAYDAN_FRONT_STONE_WARM)$/.test(name)) {
          // Rubble stone out, honed limestone in: a fine mineral grain (the
          // plaster detail) under panel joints drawn by the variation shader.
          material.map = null
          material.color.set(name === 'KAYDAN_FRONT_STONE' ? '#cdbfa8' : '#d9ccb6')
          material.normalMap = detail(plasterNormal, 4)
          material.normalScale = new Vector2(.35, .35)
          material.roughnessMap = detail(plasterRoughness, 4)
          material.roughness = .62
        }
        if (name === 'KAYDAN_TREAD') borrow(material, paveDonor, 1.2, '#ebe5da', .5)
        // The restructured parvis has metric UVs (restructure_front.py): ~2.9 m per
        // texture tile; the leftover pathway keeps its own unit UVs.
        if (name === 'KAYDAN_PAVING') borrow(material, paveDonor, .35, '#e2dbcf', .55)
        if (name === 'stone_pathway_02') borrow(material, paveDonor, 5.5, '#e2dbcf', .55)
        if (name === 'KAYDAN_DRIVE') {
          borrow(material, paveDonor, .5, '#5b5750', .82)
          material.roughness = .62
        }
        if (name === 'KAYDAN_RENDER_WHITE') {
          material.normalMap = detail(plasterNormal, .6)
          material.normalScale = new Vector2(.4, .4)
          material.roughnessMap = detail(plasterRoughness, .6)
        }
        if (name === 'KAYDAN_DOOR_OAK') {
          // Vertical grain on the pivot door and the garden gate.
          const grain = detail(woodGrain, .9, .32)
          grain.rotation = Math.PI / 2
          material.map = grain
          material.color.set('#b08a62')
          material.roughness = .46
        }
        if (name === 'KAYDAN_ENTRY_GLASS') {
          // Fixed glazing either side of the door: dark and reflective by day,
          // a warm lit hall by night (see the ambience effect below).
          material.color.set('#20262a')
          material.roughness = .1
          material.metalness = .35
          material.envMapIntensity = 1.4
          material.emissive = new Color('#ffcb8e')
          material.emissiveIntensity = 0
          material.userData.kdEntryGlass = true
        }
        if (name === 'KAYDAN_LED') material.userData.kdLed = true
        // The lawn strips were a flat green: borrow the hillside's photographic
        // grass at a finer scale and pull it towards a watered green.
        if (name === 'KAYDAN_LAWN') borrow(material, grassDonor, 9, '#3f5a26', .72)
        if (AUTHORED.test(name)) {
          material.roughness = /TREAD|PAVING/.test(name) ? .52 : /LAWN|SOIL/.test(name) ? .95 : .62
          material.envMapIntensity = 1.05
        }
        if (name === 'WindowFrame') {
          // Anodised anthracite frames, as on the reference villas, instead of pale plastic.
          material.color.set('#3a3b3d')
          material.metalness = .55
          material.roughness = .42
        }
        if (/^(KAYDAN_DARKWOOD|KAYDAN_UPPER_OAK)$/.test(name) && !material.map) {
          // Authored with a flat tint only: borrow a real grain as a luminance map.
          material.map = detail(woodGrain, name === 'KAYDAN_UPPER_OAK' ? 3 : 1.5)
          material.color.multiplyScalar(1.3)
          material.roughness = .62
        }
        if (WATER.test(name)) {
          material.userData.kdPool = true
          material.emissive = new Color('#1fa9bd')
          material.emissiveIntensity = 0
          material.color.set('#5f9fa8')
          material.roughness = .06
          material.metalness = .02
          const waterMap = material.normalMap ?? material.map
          if (waterMap) {
            waterMap.wrapS = RepeatWrapping
            waterMap.wrapT = RepeatWrapping
            animatedWaterMaps.current.add(waterMap)
          }
        }
        if (SOFT.test(name)) material.roughness = .9

        // Micro-relief where the GLB supplies none of its own.
        if (/^(Material\.001|KAYDAN_UPPER_PLASTER|material)$/.test(name) && !material.normalMap) {
          const coarse = name === 'Material.001'
          material.normalMap = detail(plasterNormal, coarse ? 6 : 9)
          material.normalScale = new Vector2(coarse ? .45 : .34, coarse ? .45 : .34)
          if (!material.roughnessMap) material.roughnessMap = detail(plasterRoughness, coarse ? 6 : 9)
          material.roughness = coarse ? .78 : .8
        }
        if (name === 'KAYDAN_TRAVERTINE' && !material.normalMap) {
          material.normalMap = detail(stoneNormal, 6)
          material.normalScale = new Vector2(.45, .45)
        }
        if (/Rock0/.test(name)) material.roughness = .82
        // Lenses and lamp shades: their strength follows day/night.
        if (material.emissive && material.emissive.getHex() !== 0 && !material.userData.kdLed && !material.userData.kdEntryGlass) {
          material.userData.kdEmissive = material.emissiveIntensity
        }
        if (FOLIAGE.test(name)) {
          material.alphaTest = .35
          material.side = DoubleSide
          material.roughness = .78
          material.envMapIntensity = .75
        }

        const recipe = VARIATION.find(([pattern]) => pattern.test(name))
        if (recipe) applyVariation(material, recipe[1])
        material.needsUpdate = true
      }
    })

    // The clipped hedges along the forecourt were exported with the lawn
    // material, so they read as boxes of turf. Anything lawn-clad that stands
    // up off the ground gets a dense, dark boxwood instead.
    scene.traverse((child) => {
      if (!(child instanceof Mesh) || Array.isArray(child.material)) return
      const lawn = child.material as MeshStandardMaterial
      if (lawn.name !== 'KAYDAN_LAWN') return
      child.geometry.computeBoundingBox()
      const box = child.geometry.boundingBox!.clone().applyMatrix4(child.matrixWorld)
      if (box.max.y - box.min.y < .3) return
      let hedge = HEDGES.get(lawn)
      if (!hedge) {
        hedge = lawn.clone()
        hedge.name = 'KD_HEDGE'
        hedge.userData = { kdPrepared: true }
        hedge.color.set('#62803f')
        hedge.roughness = .9
        hedge.normalScale = new Vector2(2.2, 2.2)
        hedge.envMapIntensity = .7
        if (hedge.map) hedge.map = detail(hedge.map, 3)
        if (hedge.normalMap) hedge.normalMap = detail(hedge.normalMap, 3)
        applyVariation(hedge, { scale: .45, albedo: .32, roughness: .05, hueDrift: .12 })
        HEDGES.set(lawn, hedge)
      }
      child.material = hedge
    })
    // The upper floor's partitions, doorways and bathroom ceiling are part of
    // the model now (blender/scripts/restructure_volumes.py): nothing is
    // patched here at load time any more.
  }, [mobile, scene, plasterNormal, plasterRoughness, stoneNormal, woodGrain])

  // Day/night: intensities only — no material is recompiled.
  useLayoutEffect(() => {
    scene.traverse((child) => {
      if (!(child instanceof Mesh)) return
      for (const material of (Array.isArray(child.material) ? child.material : [child.material]) as MeshStandardMaterial[]) {
        if (typeof material.userData.kdEmissive === 'number') material.emissiveIntensity = material.userData.kdEmissive * ambience.emissive
        if (material.userData.kdPool) material.emissiveIntensity = ambience.pool * 1.1
        // Stair LED strips: off by day, the line that draws the way up by night.
        if (material.userData.kdLed) material.emissiveIntensity = ambience.mode === 'night' ? 3.5 : 0
        if (material.userData.kdEntryGlass) material.emissiveIntensity = ambience.mode === 'night' ? .75 : 0
      }
    })
  }, [scene, ambience])

  // The front door is a pivot door: its leaf and pull turn about a vertical
  // axis 40 cm in from the east edge, the long side swinging out over the porch
  // (a wall stands just inside), as the visit walks in (tour.ts).
  const door = useMemo(() => {
    const parts = [scene.getObjectByName('ENTRY_DOOR'), scene.getObjectByName('ENTRY_DOOR_PULL')].filter((part): part is Object3D => Boolean(part))
    if (!parts.length) return null
    scene.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(parts[0])
    const hinge = new Group()
    hinge.name = 'KD entry door hinge'
    hinge.position.set(bounds.max.x - .4, 0, (bounds.min.z + bounds.max.z) / 2)
    scene.add(hinge)
    hinge.updateMatrixWorld(true)
    parts.forEach((part) => hinge.attach(part))
    return hinge
  }, [scene])

  // Sheer curtains breathe: a slow wave along their own normals, strongest at
  // the hem. Patched once, so it compiles with everything else at load.
  const breeze = useMemo(() => ({ value: 0 }), [])
  useLayoutEffect(() => {
    scene.traverse((child) => {
      if (!(child instanceof Mesh)) return
      const material = child.material as MeshStandardMaterial
      if (material?.name !== 'KAYDAN_SHEER' || material.userData.kdBreeze) return
      material.userData.kdBreeze = true
      material.onBeforeCompile = (shader) => {
        shader.uniforms.kdTime = breeze
        shader.vertexShader = `uniform float kdTime;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
          float kdSway = sin(kdTime * 1.05 + position.x * 2.3 + position.z * 2.3 + position.y * .9);
          transformed += objectNormal * kdSway * .011;`)
      }
      material.customProgramCacheKey = () => 'kd-sheer'
      material.needsUpdate = true
    })
  }, [scene, breeze])

  // Rooms that cannot be seen from where the camera is are not drawn. From the
  // north side — the arrival, the entrance, the garden — the upper floor's
  // suite, bathroom and bedroom are behind solid walls, and the hall behind a
  // closed door (and from the south, behind the house); together they were ~150 draw calls per frame there (main,
  // shadow and occlusion passes). Visibility only: nothing recompiles.
  const hidden = useMemo(() => {
    const collect = (pattern: RegExp) => {
      const found: Object3D[] = []
      scene.traverse((child) => {
        if (pattern.test(child.name) && !pattern.test(child.parent?.name ?? '')) found.push(child)
      })
      return found
    }
    return { upstairs: collect(/^(Master|Bath|Bed2)_/), hall: collect(/^Hall_/) }
  }, [scene])

  useFrame((state, delta) => {
    const speed = Math.min(delta, .05)
    animatedWaterMaps.current.forEach((texture) => {
      texture.offset.x = (texture.offset.x + speed * .012) % 1
      texture.offset.y = (texture.offset.y + speed * .006) % 1
    })
    const z = state.camera.position.z
    hidden.upstairs.forEach((object) => { object.visible = z < 16.4 })
    hidden.hall.forEach((object) => { object.visible = z > 8.6 && z < 18.2 })
    breeze.value = state.clock.elapsedTime
    if (door) door.rotation.y = MathUtils.degToRad(86) * doorOpeningAt(progress)
  })

  if (import.meta.env.DEV) {
    ;(window as unknown as Record<string, unknown>).__villa = scene
  }

  return <primitive object={scene} name="KAYDAN villa" />
}

if (typeof window !== 'undefined') {
  useGLTF.preload(window.matchMedia('(max-width: 767px)').matches ? MOBILE_MODEL : DESKTOP_MODEL, true, true)
}
