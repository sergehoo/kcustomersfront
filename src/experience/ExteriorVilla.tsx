import { useGLTF, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Box3, Color, DoubleSide, Group, MathUtils, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, NoColorSpace, RepeatWrapping, SRGBColorSpace, Texture, Vector2, type Object3D } from 'three'
import type { Ambience } from './ambience'
import { makeArchitecturalGlass } from './realism/glass'
import { applyVariation, type VariationOptions } from './realism/materialVariation'
import { makeSheer, type SheerUniforms } from './realism/sheer'
import { makePoolWater, type WaterUniforms } from './realism/water'
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

/** Glazing that stands inside the house: stair balustrade, shower screens. */
const INTERIOR_GLASS = /^(Stair_Glass|BATH_SHOWER_GLASS|Bath_Glass)/
/** Every woven or knitted surface: its sheen is retuned (see `soften`). */
const TEXTILE = /^KAYDAN_(SOFA_BOUCLE|UPPER_BOUCLE|BOUCLE_DEEP|THROW|CUSHION_|LINEN|OUTDOOR_FABRIC|DRAPE_LINEN|BEDLINEN|RUG|SHEER)/

type DetailMaps = {
  limestone: Texture
  marble: Texture
  plaster: Texture
  linen: Texture
  boucle: Texture
  rug: Texture
  wrinkle: Texture
}

/**
 * Per-material realism recipes. Scales are in metres and amplitudes are kept
 * small on purpose: the aim is to stop a 10 m face returning one flat value,
 * not to make the villa look weathered.
 *
 * Stone and cloth get their matter from tiling maps projected in world space
 * (`triplanar`, `detailNormal`): the model's floors, walls and box-built
 * furniture have no UV layout that could carry a texture at its true scale.
 */
function recipes(maps: DetailMaps, mobile: boolean): [RegExp, VariationOptions][] {
  const bedding = (scale: number, strength = 1) => ({ map: maps.limestone, scale, strength })
  // The grain of honed stone is only seen up close: phones skip its three samples.
  const honed = mobile ? undefined : { map: maps.plaster, scale: .9, strength: .22 }
  return [
    // Off-white render on every volume, as on the reference villas. Dirt is kept
    // very faint: on white it reads as neglect, not realism.
    [/^(Material\.001|KAYDAN_RENDER_WHITE)$/, { scale: 2.6, albedo: .06, roughness: .1, streaks: .08, grime: .13, dirt: '#6d6458', hueDrift: .014 }],
    [/^KAYDAN_PLASTER_IVORY$/, { scale: 2.6, albedo: .045, roughness: .1, streaks: .06, grime: .12, dirt: '#6d6458', hueDrift: .012 }],
    [/^KAYDAN_UPPER_PLASTER$|^material$/, { scale: 3.4, albedo: .05, roughness: .1, grime: .14, dirt: '#5b5246' }],
    // Honed limestone cladding in large panels (tower, cheeks, retaining walls),
    // replacing the rubble stone: mineral and warm, but architectural.
    [/^(rock_wall_11_disp_2k|KAYDAN_FRONT_STONE|KAYDAN_FRONT_STONE_WARM)$/, { scale: 1.8, albedo: .05, roughness: .08, hueDrift: .02, triplanar: bedding(1.7), tiles: { floor: [1.2, .6], wall: [1.2, .6], joint: .008, jointColor: '#a2988a', tone: .05 } }],
    // The same pale limestone runs from the terrace into the ground floor, in
    // 120 × 120 slabs laid on a straight grid; coursed 120 × 60 on the walls.
    [/^KAYDAN_TRAVERTINE$/, { scale: 2.2, albedo: .035, roughness: .1, hueDrift: .014, triplanar: bedding(2.1), detailNormal: honed, tiles: { floor: [1.2, 1.2], wall: [1.2, .6], joint: .0045, jointColor: '#b4ab9d', tone: .035, bond: 0 } }],
    // Large-format pale limestone outside: 120 × 60 cm, fine joints, slab-to-slab tone.
    [/^(KAYDAN_PAVING|stone_pathway_02)$/, { scale: 1.6, albedo: .05, roughness: .1, hueDrift: .02, triplanar: bedding(2.1), detailNormal: honed, tiles: { floor: [1.2, .6], wall: [1.2, .3], joint: .007, jointColor: '#9d9486', tone: .045 } }],
    [/^KAYDAN_TREAD$/, { scale: 1.1, albedo: .05, roughness: .1, hueDrift: .02, triplanar: bedding(1.9), detailNormal: honed, tiles: { floor: [1.2, .6], joint: .006, jointColor: '#a59b8c', tone: .04 } }],
    [/^KAYDAN_(ASPHALT|KERB)$/, { scale: 3.5, albedo: .12, roughness: .1 }],
    // Driveway in dark granite setts, so the car route reads apart from the parvis.
    [/^KAYDAN_DRIVE$/, { scale: 1.4, albedo: .08, roughness: .1, triplanar: bedding(1.3, .8), detailNormal: honed, tiles: { floor: [.9, .45], joint: .008, jointColor: '#2c2a27', tone: .07 } }],
    [/^Ground003$/, { scale: 4.5, albedo: .2, roughness: .05, hueDrift: .12 }],
    [/^KAYDAN_(LAWN|SOIL)$/, { scale: 2.2, albedo: .16, roughness: .04, hueDrift: .1 }],
    // The photographed boards are a red-orange pine: graded towards a smoked
    // walnut, which is what the stair, the island and the doors are meant to be.
    [/^KAYDAN_WOOD_WARM$/, { scale: 1.2, albedo: .05, roughness: .1, grade: { tint: '#c4b29e', saturation: .34 } }],
    [/^KAYDAN_DARKWOOD$/, { scale: 1.2, albedo: .06, roughness: .1 }],
    [/^KAYDAN_UPPER_OAK$/, { scale: 1.2, albedo: .06, roughness: .1 }],
    // Oak floors: boards 19 cm wide, staggered at random, a hairline between them.
    [/^KAYDAN_UPPER_OAK__FLOOR$/, { scale: 1.6, albedo: .05, roughness: .1, tiles: { floor: [1.9, .19], joint: .0024, jointColor: '#5f4f3f', tone: .09, bond: -1 } }],
    // White marble: veining at its true scale; on the bathroom's floor and
    // walls, slabs whose veins stop at each joint.
    [/^KAYDAN_UPPER_MARBLE$/, { scale: 1.5, albedo: .02, roughness: .06, hueDrift: .006, triplanar: { map: maps.marble, scale: 3.3, strength: .5 } }],
    [/^KAYDAN_UPPER_MARBLE__(FLOOR|ROOM)$/, { scale: 1.5, albedo: .02, roughness: .06, hueDrift: .006, triplanar: { map: maps.marble, scale: 3.3, strength: .5 }, tiles: { floor: [1.2, 1.2], wall: [1.2, 2.3], joint: .003, jointColor: '#c4bfb6', tone: .014, bond: 0 } }],
    // Cloth. A looped wool on the sofas, cushions and throws…
    [/^KAYDAN_(SOFA_BOUCLE|UPPER_BOUCLE|BOUCLE_DEEP|THROW|CUSHION_SAND)$/, { scale: .9, albedo: .05, roughness: .04, hueDrift: 0, detailNormal: { map: maps.boucle, scale: .15, strength: .95 } }],
    // …a slubbed linen on headboards, cushions, outdoor seats and drapes…
    [/^KAYDAN_(LINEN|LINEN_WARM|OUTDOOR_FABRIC|CUSHION_TERRA|CUSHION_CHARCOAL|DRAPE_LINEN)$/, { scale: .8, albedo: .04, roughness: .04, hueDrift: 0, detailNormal: { map: maps.linen, scale: .065, strength: .6 } }],
    // …bed linen keeps its own fine weave (UV) and takes the creases of a made bed…
    [/^KAYDAN_BEDLINEN(_SAND)?$/, { scale: .7, albedo: .025, roughness: .03, hueDrift: 0, detailNormal: { map: maps.wrinkle, scale: 1.4, strength: .19 } }],
    // …a loop pile on the rugs, with the uneven tone of hand-tufted wool.
    [/^(KAYDAN_RUG|Plane\.001__0|DiningRug)$/, { scale: .55, albedo: .075, roughness: .03, hueDrift: .01, detailNormal: { map: maps.rug, scale: .2, strength: 1.1 } }],
    [/^KAYDAN_SHEER$/, { scale: .6, albedo: .03, roughness: 0, hueDrift: 0, detailNormal: { map: maps.linen, scale: .04, strength: .3 } }],
  ]
}

/** One boxwood material per source lawn material, shared across remounts. */
const HEDGES = new WeakMap<MeshStandardMaterial, MeshStandardMaterial>()

export function ExteriorVilla({ mobile, ambience, progress }: { mobile: boolean; ambience: Ambience; progress: number }) {
  const gltf = useGLTF(villaModel(mobile), true, true)
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene])
  const water = useRef<WaterUniforms | null>(null)
  const sheer = useRef<SheerUniforms | null>(null)
  const [plasterNormal, plasterRoughness, woodGrain] = useTexture([
    '/assets/materials/detail/plaster-normal.webp',
    '/assets/materials/detail/plaster-roughness.webp',
    '/assets/materials/detail/wood-grain.webp',
  ])
  // Synthesised by scripts/generate_detail_textures.py.
  const [limestone, marble, linen, boucle, rug, wrinkle, ripples, caustics] = useTexture([
    '/assets/materials/detail/limestone-albedo.webp',
    '/assets/materials/detail/marble-albedo.webp',
    '/assets/materials/detail/linen-normal.webp',
    '/assets/materials/detail/boucle-normal.webp',
    '/assets/materials/detail/rug-normal.webp',
    '/assets/materials/detail/wrinkle-normal.webp',
    '/assets/materials/detail/water-normal.webp',
    '/assets/materials/detail/caustics.webp',
  ])

  useLayoutEffect(() => {
    const anisotropy = mobile ? 4 : 16

    // Snapshots, not the materials themselves: the travertine gives up its own
    // maps further down, and the order materials are met in is not fixed.
    type Donor = { map: Texture | null; normalMap: Texture | null; roughnessMap: Texture | null }
    const donors = new Map<string, Donor>()
    scene.traverse((child) => {
      if (!(child instanceof Mesh)) return
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
        if (material instanceof MeshStandardMaterial && material.map && !donors.has(material.name)) {
          donors.set(material.name, { map: material.map, normalMap: material.normalMap, roughnessMap: material.roughnessMap })
        }
      }
    })
    const grassDonor = donors.get('Ground003')

    const borrow = (target: MeshStandardMaterial, donor: Donor | undefined, repeat: number, tint: string, mix: number) => {
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
    limestone.colorSpace = SRGBColorSpace
    marble.colorSpace = SRGBColorSpace
    for (const texture of [plasterNormal, plasterRoughness, woodGrain, limestone, marble, linen, boucle, rug, wrinkle, ripples, caustics]) {
      texture.wrapS = RepeatWrapping
      texture.wrapT = RepeatWrapping
      texture.anisotropy = anisotropy
      texture.needsUpdate = true
    }
    const variation = recipes({ limestone, marble, plaster: plasterNormal, linen, boucle, rug, wrinkle }, mobile)

    // Some surfaces share a material with pieces that must not look like
    // them: the oak of a floor is laid in boards, that of a nightstand is not;
    // the bathroom's marble is cut in slabs, a tray's is one piece; a stair
    // balustrade must not mirror the sky as a bay window does.
    const variants = new Map<string, MeshStandardMaterial>()
    const variant = (material: MeshStandardMaterial, suffix: string) => {
      const key = `${material.name}__${suffix}`
      let clone = variants.get(key)
      if (!clone) {
        clone = material.clone()
        clone.name = key
        clone.userData = {}
        variants.set(key, clone)
      }
      return clone
    }
    scene.traverse((child) => {
      if (!(child instanceof Mesh) || Array.isArray(child.material)) return
      const material = child.material as MeshStandardMaterial
      if (material.userData.kdPrepared) return
      if (/^F_/.test(child.name) && /^KAYDAN_UPPER_(OAK|MARBLE)$/.test(material.name)) child.material = variant(material, 'FLOOR')
      else if (material.name === 'KAYDAN_UPPER_MARBLE' && child.parent?.name === 'Bath_Furniture') child.material = variant(material, 'ROOM')
      else if (material.name === 'Glass' && INTERIOR_GLASS.test(child.name)) child.material = variant(material, 'INTERIOR')
    })

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

        if (GLAZING.test(name) || name === 'Glass__INTERIOR') {
          makeArchitecturalGlass(material, name === '911Glass'
            ? { tint: .32, color: '#1b2024' }
            : name === 'Glassend' ? { tint: .2, color: '#8fb3a4' }
              // Upper curtain wall: darker, so the room behind is only hinted at.
              : name === 'KAYDAN_TINTED_GLASS' ? { tint: .24, color: '#2b3236' }
                // Low-iron glass indoors: almost no body, a faint green edge, a soft reflection.
                : name === 'Glass__INTERIOR' || name === 'KAYDAN_INNER_GLASS' ? { tint: .035, color: '#cfe0d8', gloss: .55, mirror: .4, environment: .55 }
                  : { tint: .055, color: '#c3d1d4' })
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
          // A touch under the first pass: the last few percent of albedo are
          // what tipped a sunlit wall from bright into blank.
          material.color.set(name === 'KAYDAN_PLASTER_IVORY' ? '#f1ebe0' : '#e4ddd0')
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
          material.color.set(name === 'KAYDAN_FRONT_STONE' ? '#cfc3ae' : '#dccfba')
          material.normalMap = detail(plasterNormal, 4)
          material.normalScale = new Vector2(.35, .35)
          material.roughnessMap = detail(plasterRoughness, 4)
          material.roughness = .62
        }
        if (/^(KAYDAN_TRAVERTINE|KAYDAN_TREAD|KAYDAN_PAVING|stone_pathway_02)$/.test(name)) {
          // One pale honed limestone from the forecourt to the terrace and
          // through the ground floor. The photographed travertine was a
          // saturated yellow in 30 cm tiles, and every slab repeated the
          // same four: bedding, pores and slab joints are drawn in world
          // space instead (see `recipes`), so no two slabs match.
          material.map = null
          material.normalMap = null
          material.roughnessMap = null
          material.metalnessMap = null
          material.metalness = 0
          material.color.set(name === 'KAYDAN_TRAVERTINE' ? '#ddd6c9' : name === 'KAYDAN_TREAD' ? '#ded7ca' : '#d6cfc2')
        }
        if (name === 'KAYDAN_DRIVE') {
          // Dark granite setts. Tinting the travertine photograph turned
          // them khaki: a cool grey with the stone's own grain instead.
          material.map = null
          material.normalMap = null
          material.roughnessMap = null
          material.color.set('#5a5855')
          material.roughness = .6
        }
        if (name === 'KAYDAN_RENDER_WHITE') {
          material.normalMap = detail(plasterNormal, .6)
          material.normalScale = new Vector2(.62, .62)
          material.roughnessMap = detail(plasterRoughness, .6)
        }
        if (name === 'KAYDAN_DOOR_OAK') {
          // Vertical grain on the pivot door and the garden gate.
          // Four tiles up the leaf: at one, the grain blurred into broad bands.
          const grain = detail(woodGrain, 3.6, 1.3)
          grain.rotation = Math.PI / 2
          material.map = grain
          material.color.set('#b08a62')
          material.roughness = .5
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
        if (name === 'KAYDAN_TV_SCREEN') {
          // The living-room television (blender/scripts/refine_media.py): on by
          // day as by night — it is not a lamp, the ambience does not dim it.
          // Television.tsx gives it its picture and its brightness.
          material.userData.kdScreen = true
          material.roughness = .1
          material.envMapIntensity = .4
        }
        // The lawn strips were a flat green: borrow the hillside's photographic
        // grass at a finer scale and pull it towards a watered green.
        if (name === 'KAYDAN_LAWN') borrow(material, grassDonor, 9, '#3f5a26', .72)
        if (AUTHORED.test(name)) {
          material.roughness = /TREAD|PAVING/.test(name) ? .5 : /LAWN|SOIL/.test(name) ? .95 : .62
          material.envMapIntensity = 1.05
        }
        // Honed, not polished: a soft, broad reflection of the bays across the floor.
        if (name === 'KAYDAN_TRAVERTINE') material.roughness = .4
        if (name === 'stone_pathway_02') material.roughness = .5
        if (name === 'WindowFrame') {
          // Anodised anthracite frames, as on the reference villas, instead of pale plastic.
          material.color.set('#3a3b3d')
          material.metalness = .55
          material.roughness = .42
        }
        if (/^(KAYDAN_DARKWOOD|KAYDAN_UPPER_OAK(__FLOOR)?)$/.test(name) && !material.map) {
          // Authored with a flat tint only: borrow a real grain as a luminance map.
          material.map = detail(woodGrain, name === 'KAYDAN_DARKWOOD' ? 1.5 : 3)
          material.color.multiplyScalar(1.3)
          material.roughness = name === 'KAYDAN_UPPER_OAK__FLOOR' ? .5 : .62
        }
        if (name === 'KAYDAN_WOOD_WARM') {
          // An oiled finish: the exported roughness map left it close to matt.
          material.roughness = .78
          material.envMapIntensity = .8
        }
        if (/^KAYDAN_UPPER_MARBLE/.test(name)) {
          // Polished, but indoors: the lacquer is kept thin and the probe low,
          // or the whole floor mirrored a blue sky that the ceiling hides.
          material.color.set('#f4f1ea')
          material.roughness = .34
          material.envMapIntensity = .5
          if (material instanceof MeshPhysicalMaterial) {
            // Any glossier and each ceiling fitting showed up in the walls as
            // a small glowing disc.
            material.clearcoat = .16
            material.clearcoatRoughness = .3
          }
        }
        if (WATER.test(name)) {
          material.userData.kdPool = true
          material.emissive = new Color('#1fa9bd')
          material.emissiveIntensity = 0
          water.current = makePoolWater(material, ripples, caustics)
          continue
        }
        if (SOFT.test(name)) material.roughness = .9
        if (TEXTILE.test(name)) {
          // Exported with a full white sheen, which laid a chalky film over
          // every fabric. Cloth catches light at grazing angles in its own
          // colour, lifted a little — and softly.
          if (material instanceof MeshPhysicalMaterial) {
            material.sheen = 1
            material.sheenRoughness = .72
            material.sheenColor.copy(material.color).lerp(new Color('#ffffff'), .35).multiplyScalar(.42)
          }
          material.envMapIntensity = .7
          // UV maps on the box-built pieces stretch a tiling normal face by
          // face: the weave comes from the world-space detail instead.
          if (!/BEDLINEN/.test(name)) material.normalMap = null
        }
        if (name === 'Plane.001__0') {
          // The living-room rug was a flat mid-grey card.
          material.color.set('#b9b1a4')
          material.roughness = .96
        }
        if (name === 'KAYDAN_SHEER') sheer.current = makeSheer(material)
        if (name === 'KAYDAN_DRAPE_LINEN') material.side = DoubleSide

        // Micro-relief where the GLB supplies none of its own.
        if (/^(Material\.001|KAYDAN_UPPER_PLASTER|material)$/.test(name) && !material.normalMap) {
          const coarse = name === 'Material.001'
          material.normalMap = detail(plasterNormal, coarse ? 6 : 9)
          material.normalScale = new Vector2(coarse ? .45 : .34, coarse ? .45 : .34)
          if (!material.roughnessMap) material.roughnessMap = detail(plasterRoughness, coarse ? 6 : 9)
          material.roughness = coarse ? .78 : .8
        }
        if (/Rock0/.test(name)) material.roughness = .82
        // Lenses and lamp shades: their strength follows day/night.
        if (material.emissive && material.emissive.getHex() !== 0 && !material.userData.kdLed && !material.userData.kdEntryGlass && !material.userData.kdScreen) {
          material.userData.kdEmissive = material.emissiveIntensity
        }
        if (FOLIAGE.test(name)) {
          material.alphaTest = .35
          material.side = DoubleSide
          material.roughness = .78
          material.envMapIntensity = .75
        }

        const recipe = variation.find(([pattern]) => pattern.test(name))
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
  }, [mobile, scene, plasterNormal, plasterRoughness, woodGrain, limestone, marble, linen, boucle, rug, wrinkle, ripples, caustics])

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
    // Caustics need a sun; sheers are lit from behind by the day outside.
    if (water.current) water.current.kdWaterSun.value = ambience.mode === 'night' ? 0 : 1
    if (sheer.current) sheer.current.kdSheerLight.value = ambience.mode === 'night' ? .02 : .34
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
    if (water.current) water.current.kdWaterTime.value += Math.min(delta, .05)
    if (sheer.current) sheer.current.kdSheerTime.value = state.clock.elapsedTime
    const z = state.camera.position.z
    hidden.upstairs.forEach((object) => { object.visible = z < 16.4 })
    hidden.hall.forEach((object) => { object.visible = z > 8.6 && z < 18.2 })
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
