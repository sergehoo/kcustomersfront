import { CatmullRomCurve3, MathUtils, Vector3 } from 'three'

const point = (x: number, y: number, z: number) => new Vector3(x, y, z)

/** One continuous, human-scale dolly through the same connected GLB. */
export const CAMERA_PATH_POINTS = [
  point(4.8, 1.65, 31.5), point(3.55, 1.68, 27.4), point(.65, 1.9, 23.6),
  point(.2, 2.65, 20.6), point(.4, 3.55, 18.35), point(.85, 4.25, 16.45),
  point(1.75, 4.82, 14.7), point(2.12, 4.86, 13.05), point(2.65, 4.85, 12.2),
  point(2.35, 4.84, 11.25), point(-.1, 4.84, 11.45), point(-4.25, 4.84, 12.15),
  point(-5.15, 4.84, 11.4), point(-4.4, 4.84, 10), point(-2.55, 4.84, 9.35),
  point(-.35, 4.84, 9.45), point(2.7, 4.82, 9.75), point(4.15, 4.78, 9.35),
  point(4.2, 4.72, 8.15), point(4, 4.65, 6.4), point(2.55, 4.62, 4.25),
  point(3.1, 4.62, 2.1), point(2.15, 4.6, .75), point(-.65, 4.6, 1.1),
  point(-2.5, 4.6, 3.25),
]

export const CAMERA_TARGET_POINTS = [
  point(2.3, 4.75, 13.6), point(2.3, 4.75, 13.6), point(2.25, 4.8, 13.5),
  point(2.25, 4.82, 13.4), point(2.25, 4.82, 13.25), point(2.15, 4.78, 12.45),
  point(2.3, 4.7, 11.8), point(1.5, 4.62, 11.45), point(-1.6, 4.48, 11.35),
  point(-4.2, 4.42, 11.2), point(-5.8, 4.4, 10.75), point(-6.3, 4.4, 10.25),
  point(-5.2, 4.4, 9.7), point(-3.3, 4.42, 9.4), point(-1.1, 4.42, 9.55),
  point(1.1, 4.4, 9.65), point(3.55, 4.35, 9.25), point(4.2, 4.25, 8.25),
  point(4.45, 4.05, 6.25), point(5.1, 3.9, 4.1), point(4.2, 3.75, 1.8),
  point(2, 3.72, .35), point(-.65, 3.8, .8), point(-2.9, 4.05, 3.65),
  point(-3.6, 4.2, 6.2),
]

const mobilePositions = CAMERA_PATH_POINTS.map((value, index) => {
  const mobile = value.clone()
  mobile.x *= .86
  if (index < 8) mobile.z += .65
  return mobile
})
const mobileTargets = CAMERA_TARGET_POINTS.map((value) => point(value.x * .9, value.y, value.z))

export const CAMERA_POSITION_PATH = new CatmullRomCurve3(CAMERA_PATH_POINTS, false, 'centripetal', .42)
export const CAMERA_TARGET_PATH = new CatmullRomCurve3(CAMERA_TARGET_POINTS, false, 'centripetal', .42)
export const MOBILE_CAMERA_POSITION_PATH = new CatmullRomCurve3(mobilePositions, false, 'centripetal', .42)
export const MOBILE_CAMERA_TARGET_PATH = new CatmullRomCurve3(mobileTargets, false, 'centripetal', .42)

const FOV_STOPS = [[0, 50], [.15, 48], [.3, 51], [.58, 49], [.84, 52], [1, 48]] as const
// Choreography is intentionally non-linear. The first approach now holds back
// before the stair risers, while the pool sequence advances more gradually so
// the camera never drops into the water or crowds the sunbeds.
const PATH_TIMING_STOPS = [
  [0, 0], [.2, .12], [.3, .3], [.4, .5], [.57, .62],
  [.7, .8], [.8, .82], [.9, .94], [1, 1],
] as const

function pathProgressAt(progress: number) {
  for (let index = 0; index < PATH_TIMING_STOPS.length - 1; index += 1) {
    const start = PATH_TIMING_STOPS[index]
    const end = PATH_TIMING_STOPS[index + 1]
    if (progress <= end[0]) {
      const local = (progress - start[0]) / (end[0] - start[0])
      return MathUtils.lerp(start[1], end[1], MathUtils.smoothstep(local, 0, 1))
    }
  }
  return 1
}

function fovAt(progress: number, mobile: boolean) {
  const extra = mobile ? 5 : 0
  for (let index = 0; index < FOV_STOPS.length - 1; index += 1) {
    const start = FOV_STOPS[index]
    const end = FOV_STOPS[index + 1]
    if (progress <= end[0]) {
      const local = (progress - start[0]) / (end[0] - start[0])
      return MathUtils.lerp(start[1] + extra, end[1] + extra, MathUtils.smoothstep(local, 0, 1))
    }
  }
  return 48 + extra
}

export function cameraStateAt(progress: number, position: Vector3, target: Vector3, mobile = false) {
  const clamped = MathUtils.clamp(progress, 0, 1)
  const positionPath = mobile ? MOBILE_CAMERA_POSITION_PATH : CAMERA_POSITION_PATH
  const targetPath = mobile ? MOBILE_CAMERA_TARGET_PATH : CAMERA_TARGET_PATH
  const pathProgress = pathProgressAt(clamped)
  // Use the position curve's arc-length mapping for both splines. Applying
  // getPointAt() independently made the shorter target curve race ahead.
  const curveT = positionPath.getUtoTmapping(pathProgress, 0)
  positionPath.getPoint(curveT, position)
  targetPath.getPoint(curveT, target)
  return fovAt(clamped, mobile)
}
