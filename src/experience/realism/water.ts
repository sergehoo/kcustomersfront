import { AddEquation, Color, CustomBlending, MeshPhysicalMaterial, OneFactor, OneMinusSrcAlphaFactor, RepeatWrapping, type MeshStandardMaterial, type Texture, type WebGLProgramParametersWithUniforms } from 'three'

/**
 * Pool water, without a refraction pass.
 *
 * The exported material was a clear film: from the terrace the eye went
 * straight through it to the floor of the pool, which read as an empty basin.
 * Real pool water is recognised by four things, and each is drawn here:
 *
 * - a body: turquoise where you look down into it, deeper and denser as the
 *   view flattens, so the far end of the pool closes into colour;
 * - a mirror: Fresnel reflection of the sky, broken by wind ripples (two
 *   layers of a tiling normal map sliding across each other in world space);
 * - sun glints on those ripples, which the bloom pass catches;
 * - caustics: the network of light the ripples focus on the floor, seen
 *   through the surface. By night the same network modulates the glow of the
 *   underwater lights.
 *
 * The fragment is written pre-multiplied, like the glazing: reflection is
 * added at full strength and alpha carries the body and the Fresnel term.
 */
export type WaterUniforms = {
  kdWaterTime: { value: number }
  /** Strength of the sun's caustics: 1 by day, 0 by night. */
  kdWaterSun: { value: number }
}

const VERTEX = /* glsl */`
#include <project_vertex>
vKdWaterWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
`

const NORMAL = /* glsl */`
#include <normal_fragment_maps>
vec2 kdRipple;
{
  vec2 kdP = vKdWaterWorld.xz;
  vec2 kdA = texture2D(kdWaterNormal, kdP / 3.4 + kdWaterTime * vec2(.013, .007)).xy * 2.0 - 1.0;
  vec2 kdB = texture2D(kdWaterNormal, kdP / 1.45 - kdWaterTime * vec2(.009, -.014) + .37).xy * 2.0 - 1.0;
  kdRipple = kdA * .55 + kdB * .35;
  normal = normalize(mat3(viewMatrix) * normalize(vec3(kdRipple.x * .32, 1.0, kdRipple.y * .32)));
}
`

const OPAQUE = /* glsl */`
float kdNoV = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
float kdFresnel = .02 + .98 * pow(1.0 - kdNoV, 5.0);
// What is seen through the surface, wobbling with the ripples above it.
vec2 kdFloor = vKdWaterWorld.xz + kdRipple * .22;
float kdCaustic = min(
  texture2D(kdCaustics, kdFloor / 2.3 + kdWaterTime * vec2(.016, .011)).r,
  texture2D(kdCaustics, kdFloor / 3.1 - kdWaterTime * vec2(.012, .017) + .5).r
);
kdCaustic = smoothstep(.04, .5, kdCaustic);
float kdGraze = pow(1.0 - kdNoV, 1.6);
vec3 kdBody = totalDiffuse * mix(vec3(1.25, 1.2, 1.12), vec3(.5, .74, .86), kdGraze);
kdBody += vec3(.72, .98, .92) * kdCaustic * kdWaterSun * .26 * (1.0 - kdGraze);
float kdOpacity = mix(.62, .96, kdGraze);
vec3 kdGlow = totalEmissiveRadiance * (.72 + kdCaustic * .5);
gl_FragColor = vec4((kdBody + kdGlow) * kdOpacity + totalSpecular, clamp(kdOpacity + kdFresnel * (1.0 - kdOpacity), 0.0, 1.0));
`

export function makePoolWater(material: MeshStandardMaterial, ripples: Texture, caustics: Texture): WaterUniforms {
  for (const texture of [ripples, caustics]) {
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
  }
  // Exported with KHR_materials_transmission, which costs a second render of
  // the whole scene for one pool.
  if (material instanceof MeshPhysicalMaterial) material.transmission = 0
  material.map = null
  material.normalMap = null
  material.roughnessMap = null
  material.metalnessMap = null
  material.color = new Color('#3aa9b9')
  material.roughness = .07
  material.metalness = 0
  material.envMapIntensity = 1.5
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
  const uniforms = {
    kdWaterTime: { value: 0 },
    kdWaterSun: { value: 1 },
    kdWaterNormal: { value: ripples },
    kdCaustics: { value: caustics },
  }
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = `varying vec3 vKdWaterWorld;\n${shader.vertexShader}`
      .replace('#include <project_vertex>', VERTEX)
    shader.fragmentShader = `varying vec3 vKdWaterWorld;\nuniform float kdWaterTime;\nuniform float kdWaterSun;\nuniform sampler2D kdWaterNormal;\nuniform sampler2D kdCaustics;\n${shader.fragmentShader}`
      .replace('#include <normal_fragment_maps>', NORMAL)
      .replace('#include <opaque_fragment>', OPAQUE)
  }
  material.customProgramCacheKey = () => 'kd-pool-water'
  material.needsUpdate = true
  return uniforms
}
