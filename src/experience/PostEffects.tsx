import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useEffect, useRef } from 'react'
import { HalfFloatType } from 'three'

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
 */
export function PostEffects({ mobile, bloom = .32 }: { mobile: boolean; bloom?: number }) {
  // n8ao ships no types.
  const ao = useRef<{ configuration: { transparencyAware: boolean } } | null>(null)
  useEffect(() => {
    // Not exposed as a prop. Transparency-aware AO re-renders every
    // transparent mesh — all the glazing — in an extra pass, and clear glass
    // should not occlude what is behind it anyway.
    if (ao.current) ao.current.configuration.transparencyAware = false
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__ao = ao.current
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
      aoRadius={mobile ? 1.6 : 2}
      distanceFalloff={1.2}
      intensity={mobile ? 2.6 : 3.4}
      color="#16130f"
    />
    <SMAA />
    <Bloom mipmapBlur luminanceThreshold={.92} luminanceSmoothing={.15} intensity={bloom} radius={.7} />
    <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    <HueSaturation saturation={.06} />
    <BrightnessContrast contrast={.07} />
    <Vignette offset={.32} darkness={.42} />
  </EffectComposer>
}
