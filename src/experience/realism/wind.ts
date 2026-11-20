import { Vector4, type MeshStandardMaterial, type WebGLProgramParametersWithUniforms } from 'three'

/**
 * A light breeze through the planting.
 *
 * Every plant was a still sculpture, which more than its modelling is what
 * made the garden read as artificial. Leaves are moved in the vertex shader —
 * no per-frame work on the CPU, no extra draw call — by three things layered
 * as they are in a real garden:
 *
 * - a gust that crosses the plot every few seconds, so plants do not all move
 *   at once and none moves all the time;
 * - a slow sway inside the gust, each plant on its own phase;
 * - a faint flutter of the thin tips.
 *
 * How much a vertex moves depends on how far it is from where the plant is
 * held (`height` up a blade, `reach` out along a frond): roots and trunks stay
 * put, tips travel a few centimetres. Amplitudes are deliberately small — the
 * eye should register that the garden is alive, not watch it wave.
 */
export type WindProfile = {
  /** Flexibility gained per metre of height in the plant's own space. */
  height?: number
  /** Flexibility gained per metre away from the plant's axis. */
  reach?: number
  /** Travel of the most flexible tip in a full gust, in metres. */
  strength: number
  /** Share of fast leaf flutter on top of the sway. */
  flutter?: number
}

/** One clock for every plant, advanced by the garden each frame. */
export const WIND_TIME = { value: 0 }

const PROJECT = /* glsl */`
vec4 mvPosition = vec4(transformed, 1.0);
#ifdef USE_BATCHING
  mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
{
  float kdFlex = clamp(max(position.y, 0.0) * kdWindProfile.x + length(position.xz) * kdWindProfile.y, 0.0, 1.0);
  kdFlex *= kdFlex;
  vec3 kdAt = (modelMatrix * mvPosition).xyz;
  float kdGust = .45 + .55 * sin(kdWindTime * .42 + kdAt.x * .21 + kdAt.z * .17);
  float kdSway = sin(kdWindTime * 1.15 + kdAt.x * .9 + kdAt.z * .7) + .45 * sin(kdWindTime * 2.1 - kdAt.x * 1.6 + kdAt.z * 2.3);
  float kdFlutter = sin(kdWindTime * 5.3 + kdAt.x * 7.1 + kdAt.y * 5.7 + kdAt.z * 6.3);
  float kdPush = (kdGust * kdSway * .7 + kdFlutter * kdWindProfile.w) * kdWindProfile.z * kdFlex;
  // Bent leaves also dip a little: they turn about their base, they do not slide.
  mvPosition.xyz += vec3(.84, 0.0, .54) * kdPush - vec3(0.0, abs(kdPush) * .3, 0.0);
}
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;
`

export function applyWind(material: MeshStandardMaterial, { height = 0, reach = 0, strength, flutter = .12 }: WindProfile) {
  if (material.userData.kdWind) return
  material.userData.kdWind = true
  const uniforms = { kdWindTime: WIND_TIME, kdWindProfile: { value: new Vector4(height, reach, strength, flutter) } }
  const previous = material.onBeforeCompile
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
    previous?.call(material, shader, renderer)
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = `uniform float kdWindTime;\nuniform vec4 kdWindProfile;\n${shader.vertexShader}`
      .replace('#include <project_vertex>', PROJECT)
  }
  const previousKey = material.customProgramCacheKey?.bind(material)
  material.customProgramCacheKey = () => `${previousKey?.() ?? ''}|kd-wind`
  material.needsUpdate = true
}
