import { Color, Vector2, Vector4, type Material, type MeshStandardMaterial, type Texture, type WebGLProgramParametersWithUniforms } from 'three'

/**
 * Breaks the "one flat value per face" look of large architectural surfaces.
 *
 * A real render, concrete or stone wall is never one colour: it carries large
 * soft tonal blotches, a roughness that changes where hands, rain and sun have
 * been, and faint vertical run-off under every ledge. None of that is in the
 * GLB (no AO, no second UV set, tiling maps only), so it is synthesised here in
 * world space — which also means it never repeats with the texture tile.
 *
 * Everything is uniform-driven so all patched materials share one program per
 * base shader.
 */
export type VariationOptions = {
  /** World size of the large tonal blotches, in metres. */
  scale?: number
  /** ± relative albedo change from the blotches (0.08 = ±8 %). */
  albedo?: number
  /** ± roughness change. */
  roughness?: number
  /** Strength of vertical run-off streaks on vertical faces (0 = none). */
  streaks?: number
  /** Darkening towards the foot of vertical faces, within `groundBand` metres of `groundLevels`. */
  grime?: number
  /** Colour the streaks and grime pull towards. */
  dirt?: string
  /** Slight warm/cool hue drift, as sun-bleached render shows. */
  hueDrift?: number
  /**
   * Large-format calepinage in world space: slabs on horizontal faces, panels
   * (or courses) on vertical ones, with a fine joint and a per-slab tone so a
   * terrace reads as laid stone rather than one stretched texture.
   */
  tiles?: {
    floor?: [number, number]
    wall?: [number, number]
    joint?: number
    jointColor?: string
    tone?: number
    /** Offset of every other course, in slabs: .5 is a running bond (default), 0 a straight grid, −1 a random one (planks). */
    bond?: number
  }
  /** Colour grading of the albedo after its map: a tint and a saturation (1 = untouched). */
  grade?: { tint?: string; saturation?: number }
  /**
   * A tiling albedo projected in world space on the three axes and multiplied
   * in: veining, bedding, pores at their true scale on surfaces whose UVs are
   * arbitrary. With `tiles`, every slab samples a different part of it, the way
   * cut stone never continues a vein across a joint.
   */
  triplanar?: { map: Texture; scale: number; strength?: number }
  /**
   * Tiling tangent-space normals projected the same way: a weave on a sofa
   * built from boxes, a pile on a rug, creases on a duvet. `second` adds a
   * layer at another scale.
   */
  detailNormal?: { map: Texture; scale: number; strength?: number; second?: { map: Texture; scale: number; strength?: number } }
}

const DEFAULTS: Required<Omit<VariationOptions, 'tiles' | 'grade' | 'triplanar' | 'detailNormal'>> = {
  scale: 3.2,
  albedo: .08,
  roughness: .08,
  streaks: 0,
  grime: 0,
  dirt: '#3b352d',
  hueDrift: .02,
}

/** Slab tops measured from the production GLB: driveway, ground floor, upper floor. */
const GROUND_LEVELS = '0.70, 3.79, 6.86'

const NOISE = /* glsl */`
varying vec3 vKdWorld;
varying vec3 vKdNormal;
uniform float kdScale;
uniform float kdAlbedo;
uniform float kdRoughness;
uniform float kdStreaks;
uniform float kdGrime;
uniform vec3 kdDirt;
uniform float kdHue;
uniform vec4 kdTile;
uniform float kdJoint;
uniform vec3 kdJointColor;
uniform float kdTileTone;
uniform float kdBond;
uniform vec3 kdTint;
uniform float kdSaturation;
#ifdef KD_TRIPLANAR
uniform sampler2D kdTriMap;
uniform vec2 kdTri;
#endif
#ifdef KD_DETAIL_NORMAL
uniform sampler2D kdDetailMap;
uniform vec2 kdDetail;
#endif
#ifdef KD_DETAIL_NORMAL_2
uniform sampler2D kdDetailMap2;
uniform vec2 kdDetail2;
#endif

float kdHash(vec3 p) {
  p = fract(p * .3183099 + .1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float kdNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(kdHash(i + vec3(0, 0, 0)), kdHash(i + vec3(1, 0, 0)), f.x),
                 mix(kdHash(i + vec3(0, 1, 0)), kdHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(kdHash(i + vec3(0, 0, 1)), kdHash(i + vec3(1, 0, 1)), f.x),
                 mix(kdHash(i + vec3(0, 1, 1)), kdHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float kdFbm(vec3 p) {
  float v = 0.0;
  float a = .55;
  for (int i = 0; i < 4; i++) { v += a * kdNoise(p); p = p * 2.03 + 11.7; a *= .5; }
  return v;
}
float kdTileHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 kdTriWeights(vec3 n) {
  vec3 w = pow(abs(n), vec3(6.0));
  return w / (w.x + w.y + w.z);
}
#if defined(KD_DETAIL_NORMAL) || defined(KD_DETAIL_NORMAL_2)
// UDN blend: each projection's tangent-space offset laid onto its world axes.
vec3 kdDetailOffset(sampler2D map, vec3 p, vec3 w) {
  vec2 tx = texture2D(map, p.zy).xy * 2.0 - 1.0;
  vec2 ty = texture2D(map, p.xz).xy * 2.0 - 1.0;
  vec2 tz = texture2D(map, p.xy).xy * 2.0 - 1.0;
  return vec3(0.0, tx.y, tx.x) * w.x + vec3(ty.x, 0.0, ty.y) * w.y + vec3(tz.x, tz.y, 0.0) * w.z;
}
#endif
float kdGroundDistance(float y) {
  float levels[3] = float[3](${GROUND_LEVELS});
  float d = 100.0;
  for (int i = 0; i < 3; i++) { float h = y - levels[i]; if (h >= -.05) d = min(d, h); }
  return d;
}
`

/** Computes world position and normal in the vertex stage, instancing included. */
const VERTEX_WORLD = /* glsl */`
#include <project_vertex>
{
  vec4 kdPosition = vec4(transformed, 1.0);
  vec3 kdNormalObject = objectNormal;
  #ifdef USE_INSTANCING
    kdPosition = instanceMatrix * kdPosition;
    kdNormalObject = mat3(instanceMatrix) * kdNormalObject;
  #endif
  vKdWorld = (modelMatrix * kdPosition).xyz;
  vKdNormal = normalize(mat3(modelMatrix) * kdNormalObject);
}
`

const FRAGMENT_COLOR = /* glsl */`
#include <color_fragment>
{
  float kdLuma = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722));
  diffuseColor.rgb = mix(vec3(kdLuma), diffuseColor.rgb, kdSaturation) * kdTint;
}
vec3 kdSlab = vec3(0.0);
{
  vec3 kdN = normalize(vKdNormal);
  bool kdFloor = abs(kdN.y) > .6;
  vec2 kdSize = kdFloor ? kdTile.xy : kdTile.zw;
  if (kdSize.x > 0.0) {
    vec2 kdUv = kdFloor ? vKdWorld.xz : vec2(abs(kdN.x) > abs(kdN.z) ? vKdWorld.z : vKdWorld.x, vKdWorld.y);
    vec2 kdCell = kdUv / kdSize;
    // Running bond: every other course offset by half a unit; a negative
    // bond staggers each course at random, as boards are laid.
    kdCell.x += kdBond < 0.0 ? kdTileHash(vec2(floor(kdCell.y), 3.7)) : mod(floor(kdCell.y), 2.0) * kdBond;
    vec2 kdId = floor(kdCell);
    kdSlab = vec3(kdTileHash(kdId + 1.3), kdTileHash(kdId + 7.9), kdTileHash(kdId + 4.1)) * 9.0;
    vec2 kdF = fract(kdCell) * kdSize;
    float kdEdge = min(min(kdF.x, kdSize.x - kdF.x), min(kdF.y, kdSize.y - kdF.y));
    float kdJ = 1.0 - smoothstep(kdJoint * .5, kdJoint, kdEdge);
    diffuseColor.rgb *= 1.0 + (kdTileHash(kdId) - .5) * 2.0 * kdTileTone;
    diffuseColor.rgb = mix(diffuseColor.rgb, kdJointColor, kdJ * .85);
  }
}
#ifdef KD_TRIPLANAR
{
  vec3 kdW = kdTriWeights(normalize(vKdNormal));
  vec3 kdP = vKdWorld / kdTri.x + kdSlab;
  vec3 kdTex = texture2D(kdTriMap, kdP.zy).rgb * kdW.x + texture2D(kdTriMap, kdP.xz).rgb * kdW.y + texture2D(kdTriMap, kdP.xy).rgb * kdW.z;
  diffuseColor.rgb *= mix(vec3(1.0), kdTex, kdTri.y);
}
#endif
float kdLarge = kdFbm(vKdWorld / kdScale);
float kdSmall = kdNoise(vKdWorld * (4.0 / kdScale) + 3.1);
float kdTone = (kdLarge - .5) * 2.0 * kdAlbedo + (kdSmall - .5) * kdAlbedo * .5;
diffuseColor.rgb *= 1.0 + kdTone;
diffuseColor.rgb *= vec3(1.0 + kdHue * (kdLarge - .5), 1.0, 1.0 - kdHue * (kdLarge - .5));
float kdVertical = 1.0 - abs(vKdNormal.y);
if (kdStreaks > 0.0 && kdVertical > .5) {
  // Stretched noise: thin, long, mostly vertical run-off marks.
  float kdStreak = kdFbm(vec3(vKdWorld.x * 6.0 + vKdWorld.z * 6.0, vKdWorld.y * .35, vKdWorld.z * 6.0 - vKdWorld.x * 2.0));
  kdStreak = smoothstep(.52, .86, kdStreak) * kdStreaks * kdVertical;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * kdDirt * 2.2, kdStreak);
}
if (kdGrime > 0.0 && kdVertical > .5) {
  float kdFoot = 1.0 - smoothstep(0.0, .55 + kdLarge * .35, kdGroundDistance(vKdWorld.y));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * kdDirt * 2.0, kdFoot * kdGrime);
}
`

const FRAGMENT_NORMAL = /* glsl */`
#include <normal_fragment_maps>
#if defined(KD_DETAIL_NORMAL) || defined(KD_DETAIL_NORMAL_2)
{
  vec3 kdW = kdTriWeights(normalize(vKdNormal));
  vec3 kdBump = vec3(0.0);
  #ifdef KD_DETAIL_NORMAL
    kdBump += kdDetailOffset(kdDetailMap, vKdWorld / kdDetail.x, kdW) * kdDetail.y;
  #endif
  #ifdef KD_DETAIL_NORMAL_2
    kdBump += kdDetailOffset(kdDetailMap2, vKdWorld / kdDetail2.x, kdW) * kdDetail2.y;
  #endif
  normal = normalize(normal + mat3(viewMatrix) * kdBump * (gl_FrontFacing ? 1.0 : -1.0));
}
#endif
`

const FRAGMENT_ROUGHNESS = /* glsl */`
#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + (kdFbm(vKdWorld / (kdScale * .6) + 7.3) - .5) * 2.0 * kdRoughness, .04, 1.0);
`

type Patched = Material & { userData: { kdVariation?: boolean } }

export function applyVariation(material: MeshStandardMaterial, options: VariationOptions = {}) {
  const target = material as MeshStandardMaterial & Patched
  if (target.userData.kdVariation) return
  target.userData.kdVariation = true
  const o = { ...DEFAULTS, ...options }
  const uniforms = {
    kdScale: { value: o.scale },
    kdAlbedo: { value: o.albedo },
    kdRoughness: { value: o.roughness },
    kdStreaks: { value: o.streaks },
    kdGrime: { value: o.grime },
    kdDirt: { value: new Color(o.dirt) },
    kdHue: { value: o.hueDrift },
    kdTile: { value: new Vector4(...(options.tiles?.floor ?? [0, 0]), ...(options.tiles?.wall ?? [0, 0])) },
    kdJoint: { value: options.tiles?.joint ?? .006 },
    kdJointColor: { value: new Color(options.tiles?.jointColor ?? '#8a8276') },
    kdTileTone: { value: options.tiles?.tone ?? .05 },
    kdBond: { value: options.tiles?.bond ?? .5 },
    kdTint: { value: new Color(options.grade?.tint ?? '#ffffff') },
    kdSaturation: { value: options.grade?.saturation ?? 1 },
    ...(options.triplanar && {
      kdTriMap: { value: options.triplanar.map },
      kdTri: { value: new Vector2(options.triplanar.scale, options.triplanar.strength ?? 1) },
    }),
    ...(options.detailNormal && {
      kdDetailMap: { value: options.detailNormal.map },
      kdDetail: { value: new Vector2(options.detailNormal.scale, options.detailNormal.strength ?? 1) },
    }),
    ...(options.detailNormal?.second && {
      kdDetailMap2: { value: options.detailNormal.second.map },
      kdDetail2: { value: new Vector2(options.detailNormal.second.scale, options.detailNormal.second.strength ?? 1) },
    }),
  }
  // Optional layers are compiled in only where a recipe asks for them.
  const features = [options.triplanar && 'KD_TRIPLANAR', options.detailNormal && 'KD_DETAIL_NORMAL', options.detailNormal?.second && 'KD_DETAIL_NORMAL_2']
    .filter((feature): feature is string => Boolean(feature))
  target.defines = { ...target.defines }
  for (const feature of features) target.defines[feature] = ''
  // Kept on the material so a look-dev session can retune it live.
  target.userData.kdUniforms = uniforms
  const previous = target.onBeforeCompile
  target.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
    previous?.call(target, shader, renderer)
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = `varying vec3 vKdWorld;\nvarying vec3 vKdNormal;\n${shader.vertexShader}`
      .replace('#include <project_vertex>', VERTEX_WORLD)
    shader.fragmentShader = `${NOISE}\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', FRAGMENT_COLOR)
      .replace('#include <normal_fragment_maps>', FRAGMENT_NORMAL)
      .replace('#include <roughnessmap_fragment>', FRAGMENT_ROUGHNESS)
  }
  const previousKey = target.customProgramCacheKey?.bind(target)
  target.customProgramCacheKey = () => `${previousKey?.() ?? ''}|kd-variation|${features.join('+')}`
  target.needsUpdate = true
}
