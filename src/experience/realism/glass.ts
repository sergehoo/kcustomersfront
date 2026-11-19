import { AddEquation, Color, CustomBlending, MeshStandardMaterial, OneFactor, OneMinusSrcAlphaFactor, type WebGLProgramParametersWithUniforms } from 'three'

/**
 * Architectural glazing without a transmission pass.
 *
 * Plain `transparent` + `opacity` multiplies the reflection by the opacity as
 * well, so a pane either looks like a grey film (opacity up) or disappears
 * with its reflection (opacity down) — the "plaque grise" look. Real glass
 * transmits most light head-on and turns into a mirror at grazing angles.
 *
 * The fragment is therefore written pre-multiplied: specular reflection is
 * added at full strength, and alpha only carries the Fresnel term plus a small
 * absorption tint. Blending is `ONE, ONE_MINUS_SRC_ALPHA`, so what is behind
 * the glass is attenuated by exactly what the glass reflects.
 */
const OPAQUE = /* glsl */`
float kdNoV = clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0);
float kdFresnel = pow(1.0 - kdNoV, 5.0);
float kdAlpha = clamp(kdGlassTint + kdFresnel * .85, 0.0, 1.0);
gl_FragColor = vec4(totalDiffuse * kdGlassTint + totalSpecular + totalEmissiveRadiance, kdAlpha);
`

export function makeArchitecturalGlass(material: MeshStandardMaterial, { tint = .07, color = '#c9d6d8' }: { tint?: number; color?: string } = {}) {
  if (material.userData.kdGlass) return
  material.userData.kdGlass = true
  material.color = new Color(color)
  material.metalness = 0
  material.roughness = .035
  material.envMapIntensity = 1.35
  material.transparent = true
  material.opacity = 1
  material.depthWrite = false
  material.blending = CustomBlending
  material.blendEquation = AddEquation
  material.blendSrc = OneFactor
  material.blendDst = OneMinusSrcAlphaFactor
  material.blendSrcAlpha = OneFactor
  material.blendDstAlpha = OneMinusSrcAlphaFactor
  material.premultipliedAlpha = false
  const uniforms = { kdGlassTint: { value: tint } }
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms)
    shader.fragmentShader = `uniform float kdGlassTint;\n${shader.fragmentShader}`
      .replace('#include <opaque_fragment>', OPAQUE)
  }
  material.customProgramCacheKey = () => 'kd-glass'
  material.needsUpdate = true
}
