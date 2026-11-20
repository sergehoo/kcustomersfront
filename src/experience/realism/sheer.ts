import { DoubleSide, type MeshStandardMaterial, type WebGLProgramParametersWithUniforms } from 'three'

/**
 * Voile curtains.
 *
 * An opaque white mesh in front of a bay reads as a painted board however well
 * it is pleated. What makes a sheer a sheer is how it handles the light:
 *
 * - where the cloth faces you it is one layer of open weave: the daylight
 *   behind comes through and you half-see the terrace;
 * - where a fold turns away you look through several layers: it closes and
 *   darkens. Those alternating bands are the pleats;
 * - by day the whole panel is lit from behind, by night only by the room.
 *
 * It also breathes: a slow wave along its own normals, free at the hem and
 * held at the heading (`uv.y` runs from 0 at the hem to 1 at the track, as
 * authored by blender/scripts/refine_textiles.py). Amplitudes are in metres
 * whatever scale the quantised mesh is stored at.
 */
export type SheerUniforms = {
  kdSheerTime: { value: number }
  /** Daylight coming through the cloth: ~.35 by day, ~0 by night. */
  kdSheerLight: { value: number }
}

const VERTEX = /* glsl */`
#include <begin_vertex>
{
  vec3 kdAt = (modelMatrix * vec4(position, 1.0)).xyz;
  float kdHang = pow(1.0 - clamp(uv.y, 0.0, 1.0), 1.6);
  float kdSway = sin(kdSheerTime * .85 + kdAt.x * 2.1 + kdAt.z * 2.1 + kdAt.y * .7)
    + .45 * sin(kdSheerTime * 1.6 + kdAt.x * 5.3 - kdAt.z * 4.1);
  transformed += objectNormal * kdSway * kdHang * .011 / length(modelMatrix[0].xyz);
}
`

const OPAQUE = /* glsl */`
float kdNoV = clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0);
float kdFold = pow(1.0 - kdNoV, 1.3);
vec3 kdLit = outgoingLight + diffuseColor.rgb * kdSheerLight * (1.0 - kdFold * .8);
gl_FragColor = vec4(kdLit, mix(.5, .97, kdFold));
`

export function makeSheer(material: MeshStandardMaterial): SheerUniforms {
  material.side = DoubleSide
  material.transparent = true
  material.opacity = 1
  // Written to depth so the folds occlude one another without sorting, and
  // so the occlusion pass sees the curtain.
  material.depthWrite = true
  const uniforms = { kdSheerTime: { value: 0 }, kdSheerLight: { value: .34 } }
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = `uniform float kdSheerTime;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', VERTEX)
    shader.fragmentShader = `uniform float kdSheerLight;\n${shader.fragmentShader}`
      .replace('#include <opaque_fragment>', OPAQUE)
  }
  material.customProgramCacheKey = () => 'kd-sheer'
  material.needsUpdate = true
  return uniforms
}
