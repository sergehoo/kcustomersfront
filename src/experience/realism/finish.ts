import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'
import { Uniform } from 'three'

/**
 * The last thing a photograph goes through: a print sharpen and a grade.
 *
 * - Sharpening is contrast-adaptive (the CAS kernel): it restores the fine
 *   edges that SMAA and the half-resolution occlusion soften — weave, stone
 *   joints, mullions — and backs off where contrast is already high, so it
 *   never rings a halo round a window frame. This is most of what separates a
 *   "4K" frame from a soft one at the same pixel count.
 * - The grade is a gentle S-curve in display space with a split tone, cool in
 *   the shadows and warm in the lights, as on graded architectural film. Both
 *   are small on purpose: the image should look photographed, not filtered.
 *
 * Declared as a convolution so the composer gives it its own pass, after tone
 * mapping: it then reads the finished, anti-aliased frame.
 */
const fragment = /* glsl */`
uniform float sharpness;
uniform float tone;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  vec3 n = texture2D(inputBuffer, uv + vec2(0.0, texelSize.y)).rgb;
  vec3 s = texture2D(inputBuffer, uv - vec2(0.0, texelSize.y)).rgb;
  vec3 e = texture2D(inputBuffer, uv + vec2(texelSize.x, 0.0)).rgb;
  vec3 w = texture2D(inputBuffer, uv - vec2(texelSize.x, 0.0)).rgb;
  vec3 lo = min(c, min(min(n, s), min(e, w)));
  vec3 hi = max(c, max(max(n, s), max(e, w)));
  vec3 amount = sqrt(clamp(min(lo, 1.0 - hi) / max(hi, vec3(1e-4)), 0.0, 1.0));
  vec3 weight = amount * (-1.0 / mix(8.0, 5.0, sharpness));
  vec3 crisp = clamp((c + (n + s + e + w) * weight) / (1.0 + 4.0 * weight), 0.0, 1.0);

  vec3 graded = pow(crisp, vec3(1.0 / 2.2));
  graded = mix(graded, graded * graded * (3.0 - 2.0 * graded), tone * .2);
  float luma = dot(graded, vec3(.2126, .7152, .0722));
  graded += tone * (vec3(-.010, .002, .014) * (1.0 - smoothstep(0.0, .5, luma)) + vec3(.012, .004, -.012) * smoothstep(.5, 1.0, luma));
  outputColor = vec4(pow(clamp(graded, 0.0, 1.0), vec3(2.2)), inputColor.a);
}
`

export class FinishEffect extends Effect {
  constructor({ sharpness = .6, tone = 1 }: { sharpness?: number; tone?: number } = {}) {
    super('KaydanFinish', fragment, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ['sharpness', new Uniform(sharpness)],
        ['tone', new Uniform(tone)],
      ]),
    })
  }
}
