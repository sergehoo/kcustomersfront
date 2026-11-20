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
// A pane is thicker along a slanted ray: its tint deepens towards the edge of
// the view, which is what gives a sheet of glass its body.
float kdBody = kdGlassTint * (1.0 + (1.0 / max(kdNoV, .3) - 1.0) * .45);
float kdAlpha = clamp(kdBody + kdFresnel * kdGlassMirror, 0.0, 1.0);
// The sky and the room are reflected; the highlight of each lamp is not. A
// point light has no size, so on a perfect mirror it drew a glowing ball in
// mid-air for every fitting in the house, by day as by night.
vec3 kdMirror = reflectedLight.indirectSpecular * kdGlassGloss + reflectedLight.directSpecular * .1;
gl_FragColor = vec4(totalDiffuse * kdBody + kdMirror + totalEmissiveRadiance, kdAlpha);
`

export type GlassOptions = {
  /** Absorption seen head-on (0 = perfectly clear). */
  tint?: number
  color?: string
  /**
   * Strength of the reflection. A double-glazed bay has four faces and
   * reflects about twice what one sheet does; a pane indoors must reflect far
   * less, because the only probe is the open sky — at full strength a stair
   * balustrade mirrored a blue sky that is not in the room.
   */
  gloss?: number
  /** How far the pane closes into a mirror at grazing angles. */
  mirror?: number
  environment?: number
}

export function makeArchitecturalGlass(material: MeshStandardMaterial, { tint = .07, color = '#c9d6d8', gloss = 1.7, mirror = .85, environment = 1.35 }: GlassOptions = {}) {
  if (material.userData.kdGlass) return
  material.userData.kdGlass = true
  material.color = new Color(color)
  material.metalness = 0
  material.roughness = .035
  material.envMapIntensity = environment
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
  const uniforms = { kdGlassTint: { value: tint }, kdGlassGloss: { value: gloss }, kdGlassMirror: { value: mirror } }
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms)
    shader.fragmentShader = `uniform float kdGlassTint;\nuniform float kdGlassGloss;\nuniform float kdGlassMirror;\n${shader.fragmentShader}`
      .replace('#include <opaque_fragment>', OPAQUE)
  }
  material.customProgramCacheKey = () => 'kd-glass'
  material.needsUpdate = true
}
