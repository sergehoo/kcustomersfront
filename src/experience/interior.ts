import { MathUtils } from 'three'
import { TOUR_MARKS } from './tour'

/**
 * 0 on the hillside, 1 indoors — one curve for everything that must differ
 * inside: exposure (CameraRig), the floor bounce and lamps (Lighting) and the
 * occlusion scale (PostEffects).
 *
 * It ramps exactly where the tour crosses the envelope (tour.ts): through the
 * front door on the way in, through the terrace door on the way out. It used to
 * be keyed to fixed progress values, so the hall got a tenth of the interior
 * treatment and read as a dark, smoky room.
 */
export function insideAt(progress: number) {
  const [in0, in1] = TOUR_MARKS.enter
  const [out0, out1] = TOUR_MARKS.exit
  return MathUtils.smoothstep(progress, in0, in1) * (1 - MathUtils.smoothstep(progress, out0, out1))
}
