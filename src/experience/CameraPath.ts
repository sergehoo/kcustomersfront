import { CatmullRomCurve3, MathUtils, Vector3 } from 'three'
import { TOUR_STOPS, type Triplet, type Waypoint } from './tour'

/**
 * The camera path is the tour's timeline (tour.ts), itself generated from the
 * compositions authored and validated in Blender (camera_shots.py).
 *
 * A held shot becomes two identical control points — arrival and departure —
 * so the framing stays put while the copy is read. Waypoints between shots are
 * single control points on real passages (door, corridor, stair, doorways).
 * Mobile has its own control points: each shot's portrait framing is pulled
 * back and widened in Blender, never by scaling desktop coordinates, which used
 * to push interior cameras into the walls.
 */

type Frame = { at: number; desktop: Waypoint; mobile: Waypoint }

const FRAMES: Frame[] = TOUR_STOPS.flatMap((stop) => {
  const frame = { desktop: stop.desktop, mobile: stop.mobile }
  return stop.leave > stop.arrive ? [{ at: stop.arrive, ...frame }, { at: stop.leave, ...frame }] : [{ at: stop.arrive, ...frame }]
})

const STOPS = FRAMES.map((frame) => frame.at)
const LAST = FRAMES.length - 1

if (import.meta.env.DEV) {
  for (let index = 1; index < STOPS.length; index += 1) {
    if (STOPS[index] < STOPS[index - 1]) console.warn(`[CameraPath] frame ${index} is before frame ${index - 1}.`)
  }
}

const vec = ([x, y, z]: Triplet) => new Vector3(x, y, z)
/**
 * `centripetal` avoids the cusps and overshoots a `chordal`/`uniform` curve
 * produces when control points bunch up at every hold.
 */
const curve = (points: Triplet[]) => new CatmullRomCurve3(points.map(vec), false, 'centripetal', .4)

const positionCurve = curve(FRAMES.map((frame) => frame.desktop.position))
const targetCurve = curve(FRAMES.map((frame) => frame.desktop.target))
const mobilePositionCurve = curve(FRAMES.map((frame) => frame.mobile.position))
const mobileTargetCurve = curve(FRAMES.map((frame) => frame.mobile.target))

function segmentAt(progress: number) {
  let index = 0
  while (index < LAST && progress > STOPS[index + 1]) index += 1
  const span = Math.max(1e-6, STOPS[index + 1] - STOPS[index])
  return { index, local: MathUtils.smoothstep((progress - STOPS[index]) / span, 0, 1) }
}

/**
 * Maps scroll progress onto the curve parameter so that frame `i` is reached
 * exactly at its own progress, eased in and out of every stop.
 */
function curveParameterAt(progress: number) {
  if (progress <= STOPS[0]) return 0
  if (progress >= STOPS[LAST]) return 1
  const { index, local } = segmentAt(progress)
  return (index + local) / LAST
}

function fovAt(progress: number, mobile: boolean) {
  const pick = (frame: Frame) => (mobile ? frame.mobile.fov : frame.desktop.fov)
  if (progress <= STOPS[0]) return pick(FRAMES[0])
  if (progress >= STOPS[LAST]) return pick(FRAMES[LAST])
  const { index, local } = segmentAt(progress)
  return MathUtils.lerp(pick(FRAMES[index]), pick(FRAMES[index + 1]), local)
}

export function cameraStateAt(progress: number, position: Vector3, target: Vector3, mobile = false) {
  const clamped = MathUtils.clamp(progress, 0, 1)
  const parameter = curveParameterAt(clamped)
  ;(mobile ? mobilePositionCurve : positionCurve).getPoint(parameter, position)
  ;(mobile ? mobileTargetCurve : targetCurve).getPoint(parameter, target)
  return fovAt(clamped, mobile)
}

/** Debug overlay and validation only. */
export const CAMERA_POSITION_PATH = positionCurve
export const CAMERA_TARGET_PATH = targetCurve
export const CAMERA_FRAMES = FRAMES
