import { CatmullRomCurve3, MathUtils, Vector3 } from 'three'
import { progressOf, type ExperienceSectionId } from './sections'

type Triplet = [number, number, number]

type Keyframe = {
  /** Either a section id (anchors exactly on that section's scroll progress) or a raw progress. */
  at: ExperienceSectionId | number
  position: Triplet
  target: Triplet
  fov: number
  /** Optional note kept next to the numbers so the intent survives future edits. */
  note?: string
}

/**
 * Villa reference levels, measured from the production GLB (see `npm run inspect:glb`):
 * driveway y = 0.70 · ground floor y = 3.79 · upper floor y = 6.86 · ceiling y = 7.57.
 * Human eye height is therefore ~2.35 outside, ~5.42 inside and ~8.45 upstairs.
 * The previous path sat at y = 4.84 — barely a metre above the slab — which is why
 * every interior shot framed the floor tiles.
 */

const KEYFRAMES: Keyframe[] = [
  // 01 — EXTÉRIEUR. Full property shot: hillside, entry stair, front door, garage, car, bonsai.
  { at: 'exterior', position: [4.9, 2.6, 30.0], target: [0.9, 5.2, 16.4], fov: 52, note: 'plan de propriété' },
  { at: .07, position: [3.6, 2.6, 26.6], target: [1.0, 5.1, 16.2], fov: 51 },

  // 02 — ENTRÉE. Walk the driveway, climb the stone stair, arrive at the front door (x 2.17, z 13.6).
  // The lane x ≈ 0.9→2.2 is the only one clear of the boulders at x -1.9…1.1 and x 1.95…3.2.
  { at: 'entrance', position: [0.9, 2.7, 23.4], target: [1.3, 4.6, 15.6], fov: 50, note: 'pied de l’escalier' },
  { at: .19, position: [1.4, 3.6, 20.4], target: [1.8, 4.9, 15.0], fov: 49, note: 'montée' },
  { at: .235, position: [2.2, 4.7, 17.6], target: [2.2, 5.0, 14.2], fov: 50, note: 'haut des marches' },
  { at: .268, position: [2.3, 5.3, 14.6], target: [2.15, 5.15, 12.6], fov: 54, note: 'porte d’entrée' },

  // 03 — HALL D’ACCUEIL. Through the doorway, past the entrance pier, onto the reception counter.
  { at: .286, position: [0.3, 5.38, 13.4], target: [-3.0, 5.0, 13.6], fov: 56, note: 'franchissement' },
  { at: 'visitor', position: [-2.6, 5.42, 12.2], target: [-5.4, 4.8, 14.6], fov: 52, note: 'comptoir d’accueil' },

  // 04 — ESPACE DE TRAVAIL. Arc around the counter onto the six-seat table, stone wall behind,
  // pendant overhead, glazing and outdoor kitchen on the right.
  { at: .37, position: [-3.0, 5.38, 11.4], target: [-5.8, 4.7, 12.6], fov: 52 },
  { at: 'office', position: [-1.6, 5.32, 12.4], target: [-6.0, 4.62, 10.6], fov: 47, note: 'table de réunion' },

  // 05 — CIRCULATION. Turn back east and rise: the floating treads and the glass balustrade
  // read as a full-height vertical event against the horizon.
  { at: .50, position: [-2.4, 5.45, 13.0], target: [-2.0, 5.3, 14.8], fov: 52, note: 'pivot vers l’escalier' },
  { at: 'circulation', position: [-2.2, 5.6, 13.2], target: [0.9, 5.6, 15.8], fov: 52, note: 'escalier suspendu' },
  { at: .62, position: [-1.2, 6.1, 12.2], target: [0.4, 6.6, 14.8], fov: 52, note: 'élévation vers l’étage' },

  // 06 — SALON CLIENT. Out through the sliding bay (the only opening, x -4.36…-3.14 at z 8.6)
  // onto the terrace table: six seats, outdoor kitchen, interior still readable through the glass.
  { at: .645, position: [-2.4, 5.4, 10.4], target: [-4.0, 4.9, 8.0], fov: 54 },
  { at: .672, position: [-3.7, 5.35, 8.6], target: [-4.4, 4.7, 6.6], fov: 54, note: 'passage de la baie' },
  { at: 'client', position: [-0.6, 5.3, 4.2], target: [-4.6, 4.5, 6.6], fov: 52, note: 'table d’échange' },

  // 07 — TERRASSE. Along the deck west of the pool, then turn back: south façade, both levels of
  // glazing, lit interior, sunbeds, pool in the foreground. The climax of the visit.
  { at: .78, position: [-2.2, 5.35, 2.6], target: [0.6, 5.0, 7.2], fov: 53 },
  { at: 'terrace', position: [-3.6, 5.6, -0.6], target: [2.6, 5.2, 7.4], fov: 55, note: 'façade sud + piscine' },

  // Closing lift. The camera rises off the deck and pulls back while the DOM outro takes the frame.
  { at: .905, position: [-4.6, 6.3, -3.2], target: [1.6, 5.4, 8.0], fov: 55 },
  { at: .96, position: [-6.2, 7.4, -5.2], target: [1.8, 5.4, 8.4], fov: 54 },
  { at: 1, position: [-7.6, 8.3, -6.6], target: [1.8, 5.4, 8.6], fov: 54, note: 'plan large final' },
]

const resolve = (at: Keyframe['at']) => (typeof at === 'number' ? at : progressOf(at))

const STOPS = KEYFRAMES.map((frame) => resolve(frame.at))

if (import.meta.env.DEV) {
  for (let index = 1; index < STOPS.length; index += 1) {
    if (STOPS[index] <= STOPS[index - 1]) {
      console.warn(`[CameraPath] keyframe ${index} (${STOPS[index]}) is not after keyframe ${index - 1} (${STOPS[index - 1]}).`)
    }
  }
}

const vec = ([x, y, z]: Triplet) => new Vector3(x, y, z)

/**
 * `centripetal` avoids the cusps a `chordal`/`uniform` curve produces when two
 * keyframes sit close together — which happens at every room pivot.
 */
const positionCurve = new CatmullRomCurve3(KEYFRAMES.map((frame) => vec(frame.position)), false, 'centripetal', .4)
const targetCurve = new CatmullRomCurve3(KEYFRAMES.map((frame) => vec(frame.target)), false, 'centripetal', .4)

const mobilePositionCurve = new CatmullRomCurve3(KEYFRAMES.map((frame) => {
  const [x, y, z] = frame.position
  // Pull back slightly and stay a touch higher: a 55° portrait frame crops the sides hard.
  return new Vector3(x * .92, y + .12, z + (z > 12 ? .8 : .45))
}), false, 'centripetal', .4)
const mobileTargetCurve = new CatmullRomCurve3(KEYFRAMES.map((frame) => vec(frame.target)), false, 'centripetal', .4)

const LAST = KEYFRAMES.length - 1

/**
 * Maps scroll progress onto the curve parameter so that keyframe `i` is reached
 * exactly at its own progress. `CatmullRomCurve3.getPoint(i / LAST)` returns
 * control point `i` verbatim, so a section's framing is guaranteed, and the
 * eased segment interpolation removes the constant-speed robotic feel.
 */
function curveParameterAt(progress: number) {
  if (progress <= STOPS[0]) return 0
  if (progress >= STOPS[LAST]) return 1
  let index = 0
  while (index < LAST && progress > STOPS[index + 1]) index += 1
  const span = Math.max(1e-6, STOPS[index + 1] - STOPS[index])
  const local = (progress - STOPS[index]) / span
  return (index + MathUtils.smoothstep(local, 0, 1)) / LAST
}

function fovAt(progress: number) {
  if (progress <= STOPS[0]) return KEYFRAMES[0].fov
  if (progress >= STOPS[LAST]) return KEYFRAMES[LAST].fov
  let index = 0
  while (index < LAST && progress > STOPS[index + 1]) index += 1
  const span = Math.max(1e-6, STOPS[index + 1] - STOPS[index])
  const local = MathUtils.smoothstep((progress - STOPS[index]) / span, 0, 1)
  return MathUtils.lerp(KEYFRAMES[index].fov, KEYFRAMES[index + 1].fov, local)
}

export function cameraStateAt(progress: number, position: Vector3, target: Vector3, mobile = false) {
  const clamped = MathUtils.clamp(progress, 0, 1)
  const parameter = curveParameterAt(clamped)
  ;(mobile ? mobilePositionCurve : positionCurve).getPoint(parameter, position)
  ;(mobile ? mobileTargetCurve : targetCurve).getPoint(parameter, target)
  return fovAt(clamped) + (mobile ? 6 : 0)
}

/** Debug overlay only. */
export const CAMERA_POSITION_PATH = positionCurve
export const CAMERA_TARGET_PATH = targetCurve
export const CAMERA_KEYFRAMES = KEYFRAMES.map((frame, index) => ({ ...frame, progress: STOPS[index] }))
