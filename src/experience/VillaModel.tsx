import { useGLTF, useTexture } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo } from 'react'
import { Mesh, MeshPhysicalMaterial, MeshStandardMaterial, NoColorSpace, RepeatWrapping, SRGBColorSpace, Texture, Vector2 } from 'three'

type MaterialSet = {
  basecolor: Texture
  normal?: Texture
  roughness?: Texture
  ao?: Texture
}

function configure(set: MaterialSet, repeat: Vector2, anisotropy: number) {
  for (const texture of [set.basecolor, set.normal, set.roughness, set.ao]) {
    if (!texture) continue
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.repeat.copy(repeat)
    texture.anisotropy = anisotropy
  }
  set.basecolor.colorSpace = SRGBColorSpace
  if (set.normal) set.normal.colorSpace = NoColorSpace
  if (set.roughness) set.roughness.colorSpace = NoColorSpace
  if (set.ao) set.ao.colorSpace = NoColorSpace
}

function applyMaps(material: MeshStandardMaterial | MeshPhysicalMaterial, maps: MaterialSet, normalScale: number, roughness: number) {
  material.map = maps.basecolor
  material.normalMap = maps.normal ?? null
  material.roughnessMap = maps.roughness ?? null
  material.aoMap = maps.ao ?? null
  material.aoMapIntensity = maps.ao ? .38 : 0
  material.normalScale.setScalar(maps.normal ? normalScale : 0)
  material.roughness = roughness
  material.needsUpdate = true
}

export function VillaModel({ mobile }: { mobile: boolean }) {
  const gltf = useGLTF('/models/kaydan-villa.glb')
  const textures = useTexture(mobile ? {
    stoneBasecolor: '/assets/materials-1k/marble_01/basecolor.webp',
    woodBasecolor: '/assets/materials-1k/wood_floor_deck/basecolor.webp',
    textileBasecolor: '/assets/materials-1k/wool_boucle/basecolor.webp',
    plasterBasecolor: '/assets/materials-1k/plastered_wall_04/basecolor.webp',
  } : {
    stoneBasecolor: '/assets/materials-1k/marble_01/basecolor.webp', stoneNormal: '/assets/materials-1k/marble_01/normal.webp', stoneRoughness: '/assets/materials-1k/marble_01/roughness.webp', stoneAo: '/assets/materials-1k/marble_01/ao.webp',
    woodBasecolor: '/assets/materials-1k/wood_floor_deck/basecolor.webp', woodNormal: '/assets/materials-1k/wood_floor_deck/normal.webp', woodRoughness: '/assets/materials-1k/wood_floor_deck/roughness.webp', woodAo: '/assets/materials-1k/wood_floor_deck/ao.webp',
    textileBasecolor: '/assets/materials-1k/wool_boucle/basecolor.webp', textileNormal: '/assets/materials-1k/wool_boucle/normal.webp', textileRoughness: '/assets/materials-1k/wool_boucle/roughness.webp', textileAo: '/assets/materials-1k/wool_boucle/ao.webp',
    plasterBasecolor: '/assets/materials-1k/plastered_wall_04/basecolor.webp', plasterNormal: '/assets/materials-1k/plastered_wall_04/normal.webp', plasterRoughness: '/assets/materials-1k/plastered_wall_04/roughness.webp', plasterAo: '/assets/materials-1k/plastered_wall_04/ao.webp',
  }) as Record<string, Texture>
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy())
  const scene = useMemo(() => {
    const clone = gltf.scene.clone(true)
    clone.traverse((child) => {
      const normalizedName = child.name.replaceAll('_', ' ')
      if (
        normalizedName.startsWith('Pendant cable') ||
        normalizedName.startsWith('Pendant lamp') ||
        normalizedName.startsWith('Palm leaf') ||
        normalizedName.startsWith('Palm trunk') ||
        normalizedName.startsWith('Planter') ||
        (normalizedName.startsWith('Deep lounge sofa') && child.position.z < -21) ||
        (normalizedName.startsWith('Outdoor lounge chair') && Math.abs(child.position.z - 4.18) > .2)
      ) child.visible = false
    })
    return clone
  }, [gltf.scene])

  const materialSets = useMemo(() => {
    const anisotropy = Math.min(8, maxAnisotropy)
    const stone = { basecolor: textures.stoneBasecolor, normal: textures.stoneNormal, roughness: textures.stoneRoughness, ao: textures.stoneAo }
    const wood = { basecolor: textures.woodBasecolor, normal: textures.woodNormal, roughness: textures.woodRoughness, ao: textures.woodAo }
    const textile = { basecolor: textures.textileBasecolor, normal: textures.textileNormal, roughness: textures.textileRoughness, ao: textures.textileAo }
    const plaster = { basecolor: textures.plasterBasecolor, normal: textures.plasterNormal, roughness: textures.plasterRoughness, ao: textures.plasterAo }
    configure(stone, new Vector2(3.5, 3.5), anisotropy)
    configure(wood, new Vector2(2.2, 3.6), anisotropy)
    configure(textile, new Vector2(2.6, 2.6), anisotropy)
    configure(plaster, new Vector2(3, 3), anisotropy)
    return { stone, wood, textile, plaster }
  }, [maxAnisotropy, textures])

  useLayoutEffect(() => {
    scene.traverse((child) => {
      if (!(child instanceof Mesh)) return
      child.castShadow = true
      child.receiveShadow = true
      if (child.geometry.attributes.uv && !child.geometry.attributes.uv2) child.geometry.setAttribute('uv2', child.geometry.attributes.uv)
      const original = child.material
      if (Array.isArray(original)) return
      const material = original.clone() as MeshStandardMaterial | MeshPhysicalMaterial
      if (material.name === 'stone_travertine') applyMaps(material, materialSets.stone, .24, .72)
      if (material.name === 'oak_wood') applyMaps(material, materialSets.wood, .18, .58)
      if (material.name === 'boucle_textile') applyMaps(material, materialSets.textile, .12, .87)
      if (material.name === 'plaster_ivoire') applyMaps(material, materialSets.plaster, .1, .9)
      if (material.name === 'architectural_glass' && material instanceof MeshPhysicalMaterial) {
        material.color.set('#d8ece8')
        material.transmission = .78
        material.thickness = .12
        material.ior = 1.45
        material.roughness = .08
        material.envMapIntensity = 1.1
        material.opacity = .72
        material.depthWrite = false
        material.needsUpdate = true
      }
      child.material = material
    })
  }, [materialSets, scene])
  return <primitive object={scene} />
}

useGLTF.preload('/models/kaydan-villa.glb')
