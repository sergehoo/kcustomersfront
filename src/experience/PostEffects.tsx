import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { HalfFloatType, MathUtils } from 'three'
import { insideAt } from './interior'
import { FinishEffect } from './realism/finish'

/**
 * Photographic finishing, in the order a camera would apply it.
 *
 * - N8AO: occlusion where volumes meet and under every overhang — the slab
 *   over the entrance, a riser against its tread, a sofa on a rug. The GLB
 *   has no baked AO, and its absence is the single biggest reason objects
 *   looked pasted onto the ground rather than resting on it.
 * - Neutral tone mapping: keeps materials and the photographic sky at their
 *   authored colour below ~0.8 and only rolls off highlights, where ACES
 *   shifted hues and crushed the shade side of every façade.
 * - A whisper of bloom on genuine highlights (sun glints, lamp lenses) and a
 *   lens vignette. No grain, no chromatic aberration: premium, not stylised.
 * - A print sharpen and a light grade, last (realism/finish.ts).
 */
// Occlusion at the scale of each space. Outside, a 2 m radius grounds the
// façade, the stair and the planters seen from 15–30 m. Indoors every wall,
// ceiling and piece of furniture is within 2 m of the lens, so the same pass
// laid soft grey-black patches over whole walls and ceilings — the smoky veil
// of the hall and the suite. Indoors it only marks contact: corners, feet,
// cushions. Radius, intensity and falloff are uniforms: no shader rebuild.
const AO_OUTSIDE = { desktop: { aoRadius: 2, intensity: 3.4 }, mobile: { aoRadius: 1.6, intensity: 2.6 }, distanceFalloff: 1.2 }
const AO_INSIDE = { aoRadius: .6, intensity: 1.8, distanceFalloff: 1 }

type AOConfiguration = { transparencyAware: boolean; aoRadius: number; intensity: number; distanceFalloff: number }

export function PostEffects({ mobile, progress, bloom = .32 }: { mobile: boolean; progress: number; bloom?: number }) {
  // n8ao ships no types.
  const ao = useRef<{ configuration: AOConfiguration } | null>(null)
  // Phones keep a lighter sharpen: their pixels are already finer than the eye.
  const finish = useMemo(() => new FinishEffect({ sharpness: mobile ? .35 : .6 }), [mobile])
  useEffect(() => () => finish.dispose(), [finish])
  useEffect(() => {
    // Not exposed as a prop. Transparency-aware AO re-renders every
    // transparent mesh — all the glazing — in an extra pass, and clear glass
    // should not occlude what is behind it anyway.
    if (ao.current) ao.current.configuration.transparencyAware = false
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__ao = ao.current
  })

  useFrame(() => {
    const configuration = ao.current?.configuration
    if (!configuration) return
    const inside = insideAt(progress)
    const outside = mobile ? AO_OUTSIDE.mobile : AO_OUTSIDE.desktop
    configuration.aoRadius = MathUtils.lerp(outside.aoRadius, AO_INSIDE.aoRadius, inside)
    configuration.intensity = MathUtils.lerp(outside.intensity, AO_INSIDE.intensity, inside)
    configuration.distanceFalloff = MathUtils.lerp(AO_OUTSIDE.distanceFalloff, AO_INSIDE.distanceFalloff, inside)
  })

  return <EffectComposer multisampling={0} frameBufferType={HalfFloatType} enableNormalPass={false}>
    <N8AO
      ref={ao}
      // 'performance' (8 samples, denoised): at 2160×1350 it measured ~40 fps
      // where 'medium' fell to ~7, for a difference hard to see once denoised.
      // Never changed at runtime — that rebuilds the AO shaders.
      quality="performance"
      halfRes
      depthAwareUpsampling
      aoRadius={mobile ? AO_OUTSIDE.mobile.aoRadius : AO_OUTSIDE.desktop.aoRadius}
      distanceFalloff={AO_OUTSIDE.distanceFalloff}
      intensity={mobile ? AO_OUTSIDE.mobile.intensity : AO_OUTSIDE.desktop.intensity}
      color="#16130f"
    />
    <SMAA />
    <Bloom mipmapBlur luminanceThreshold={.92} luminanceSmoothing={.15} intensity={bloom} radius={.7} />
    <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    <HueSaturation saturation={.06} />
    <BrightnessContrast contrast={.07} />
    <Vignette offset={.32} darkness={.42} />
    <primitive object={finish} dispose={null} />
  </EffectComposer>
}
