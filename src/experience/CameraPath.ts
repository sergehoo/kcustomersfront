import { CatmullRomCurve3, MathUtils, Vector3 } from 'three'
import { progressOf, type ExperienceSectionId } from './sections'

type Triplet = [number, number, number]

type Keyframe = {
  /** Either a section id (anchors exactly on that section's scroll progress) or a raw progress. */
  at: ExperienceSectionId | number
  position: Triplet
  target: Triplet
  fov: number
  /**
   * Fraction of the gap to the *next* keyframe for which the camera holds this
   * exact framing before moving on (0…0.9). Expressed against the neighbour
   * rather than the section span so it can never overshoot and make the stop
   * list non-monotonic. Without a hold the camera drifts off the composition
   * while the editorial copy is still revealing, and the reader never sees the
   * shot the keyframe was chosen for.
   */
  hold?: number
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
  // 01 — EXTÉRIEUR. Hero from the east corner of the parvis: the whole façade,
  // the stair rising on the door's axis between its planted tiers, the
  // driveway and carport on the west, palms framing the ends, the sky above.
  // Kept at z ≤ 31.7 so the mobile path (pulled back 0.8 m) stays inside the fence.
  { at: 'exterior', hold: .45, position: [10.0, 2.75, 31.7], target: [1.4, 5.6, 17.0], fov: 54, note: 'hero — façade, escalier dans l’axe, accès voiture' },
  { at: .075, position: [8.6, 2.6, 31.4], target: [2.2, 5.3, 16.8], fov: 52 },

  // 02 — ENTRÉE. The restructured approach (blender/scripts/restructure_front.py) is one
  // axis, x 4.225: parvis, stair in two flights, landing, pivot door. The
  // climb stays on it, so the door is always at the end of the frame.
  { at: 'entrance', hold: .5, position: [4.225, 2.35, 31.6], target: [4.225, 4.7, 16.3], fov: 50, note: 'parvis, porte dans l’axe' },
  { at: .16, position: [4.225, 2.45, 27.4], target: [4.225, 4.85, 16.3], fov: 50, note: 'pied de l’escalier' },
  { at: .195, position: [4.225, 3.85, 22.6], target: [4.225, 5.0, 16.3], fov: 52, note: 'palier intermédiaire' },
  { at: .218, position: [4.225, 5.4, 19.9], target: [4.225, 5.05, 16.2], fov: 56, note: 'palier, face à la porte d’entrée' },
  // Round the east side of the porch column before turning down the east walk.
  { at: .227, position: [8.3, 5.45, 18.7], target: [8.3, 5.0, 14.0], fov: 54, note: 'contournement du poteau' },
  // The recessed door is presented from the landing, but it is not the way in:
  // raycasting shows solid plaster behind it on every axis. The visit continues
  // along the east flank of the terrace and enters through the south sliding bay
  // (x -4.36…-3.14 at z 8.6), which is a real opening — no wall is ever crossed.
  // South along the east walk (x 8.35 clears the villa face at x 6.6), out past the
  // south elevation, then west across the terrace and north through the bay. Every
  // leg stays on built deck — the previous version cut the corner through the wall.
  { at: .234, position: [8.35, 5.45, 14.6], target: [8.3, 4.95, 10.0], fov: 52, note: 'chemin du flanc est' },
  { at: .2405, position: [8.35, 5.45, 9.2], target: [4.2, 4.95, 7.2], fov: 54, note: 'sortie au sud' },
  { at: .2455, position: [3.4, 5.42, 7.1], target: [-2.8, 4.95, 7.4], fov: 54, note: 'traversée de la terrasse' },
  { at: .2485, position: [-3.35, 5.40, 6.9], target: [-3.45, 5.05, 10.8], fov: 56, note: 'face à la baie' },

  // 03 — HALL D’ACCUEIL. Through the doorway, past the entrance pier, onto the counter.
  { at: 'visitor', hold: .5, position: [-3.3, 5.42, 10.9], target: [-5.4, 4.8, 14.6], fov: 54, note: 'comptoir d’accueil' },

  // 04 — ESPACE DE TRAVAIL. The six-seat table, stone wall behind, pendant overhead.
  { at: .31, position: [-3.0, 5.38, 11.4], target: [-5.8, 4.7, 12.6], fov: 52 },
  { at: 'office', hold: .5, position: [-1.6, 5.32, 12.4], target: [-6.0, 4.62, 10.6], fov: 47, note: 'table de réunion' },

  // 05 — CIRCULATION. Head-on up the flight: floating treads, steel stringers, horizon.
  { at: .43, position: [-0.4, 5.42, 12.0], target: [0.6, 5.8, 14.4], fov: 53, note: 'pivot vers l’escalier' },
  { at: 'circulation', hold: .45, position: [1.3, 5.5, 11.4], target: [0.9, 6.5, 15.2], fov: 55, note: 'escalier suspendu' },

  // 06 — SUITE PARENTALE. Up to the landing, through the doorway opened in the
  // suite's east partition (ExteriorVilla → openDoorway), along the south bay,
  // and round to the window corner: bed, channelled headboard, nightstands and
  // the low afternoon sun raking across the linen and the oak dressing.
  { at: .525, position: [1.0, 7.5, 13.4], target: [0.2, 7.7, 11.4], fov: 56, note: 'arrivée à l’étage' },
  { at: .55, position: [0.1, 8.3, 11.7], target: [-3.2, 8.05, 11.5], fov: 58, note: 'palier, face à la suite' },
  { at: .562, position: [-1.7, 8.25, 11.5], target: [-4.6, 7.8, 10.2], fov: 60, note: 'seuil de la suite' },
  { at: .571, position: [-3.0, 8.2, 9.75], target: [-6.4, 7.7, 10.3], fov: 62, note: 'le long de la baie' },
  { at: 'suite', hold: .5, position: [-7.45, 8.4, 8.9], target: [-3.45, 7.35, 11.3], fov: 64, note: 'lit, tête de lit, chevets, lumière rasante' },

  // 07 — SALLE DE BAIN. Back out to the landing and in through the bathroom
  // doorway; framed from beside the vanity, west of the shower post, so the
  // freestanding tub, the marble walls and the brass fittings fill the shot.
  { at: .628, position: [-3.0, 8.2, 9.8], target: [-1.6, 8.1, 11.6], fov: 60, note: 'retour vers la porte' },
  { at: .64, position: [-1.4, 8.25, 11.75], target: [-1.6, 8.1, 13.6], fov: 60, note: 'palier' },
  { at: .651, position: [-1.55, 8.22, 12.85], target: [-5.6, 7.8, 13.9], fov: 64, note: 'seuil de la salle de bain' },
  { at: 'bathroom', hold: .45, position: [-3.9, 8.2, 12.75], target: [-7.0, 7.45, 15.2], fov: 72, note: 'baignoire îlot, marbre, double vasque' },

  // Back down the stair and out through the sliding bay (x -4.36…-3.14 at z 8.6).
  { at: .695, position: [-0.6, 7.9, 13.4], target: [0.6, 6.6, 12.4], fov: 56, note: 'redescente' },
  { at: .715, position: [-1.6, 5.6, 11.0], target: [-3.8, 5.0, 8.4], fov: 54 },
  { at: .728, position: [-3.7, 5.35, 8.6], target: [-4.4, 4.7, 6.6], fov: 54, note: 'passage de la baie' },

  // 08 — SALON CLIENT. The terrace table, outdoor kitchen, interior through the glass.
  { at: 'client', hold: .5, position: [-0.6, 5.3, 4.2], target: [-4.6, 4.5, 6.6], fov: 52, note: 'table d’échange' },

  // 09 — TERRASSE. Along the deck west of the pool, then turn back onto the façade.
  { at: .81, position: [-2.2, 5.35, 2.6], target: [0.6, 5.0, 7.2], fov: 53 },
  { at: 'terrace', hold: .5, position: [-3.6, 5.6, -0.6], target: [2.6, 5.2, 7.4], fov: 55, note: 'façade sud + piscine' },

  // Closing lift while the DOM outro takes the frame.
  { at: .92, position: [-4.6, 6.3, -3.2], target: [1.6, 5.4, 8.0], fov: 55 },
  { at: .965, position: [-6.2, 7.4, -5.2], target: [1.8, 5.4, 8.4], fov: 54 },
  { at: 1, position: [-7.6, 8.3, -6.6], target: [1.8, 5.4, 8.6], fov: 54, note: 'plan large final' },
]

const resolve = (at: Keyframe['at']) => (typeof at === 'number' ? at : progressOf(at))

/** A held keyframe becomes two identical control points, so the shot stays put. */
const FRAMES = KEYFRAMES.flatMap((frame, index) => {
  const at = resolve(frame.at)
  const next = KEYFRAMES[index + 1]
  if (!frame.hold || !next) return [{ frame, at }]
  const held = at + Math.min(.9, frame.hold) * (resolve(next.at) - at)
  return [{ frame, at }, { frame, at: held }]
})

const STOPS = FRAMES.map((entry) => entry.at)

if (import.meta.env.DEV) {
  for (let index = 1; index < STOPS.length; index += 1) {
    if (STOPS[index] < STOPS[index - 1]) {
      console.warn(`[CameraPath] keyframe ${index} (${STOPS[index]}) is before keyframe ${index - 1} (${STOPS[index - 1]}).`)
    }
  }
}

const vec = ([x, y, z]: Triplet) => new Vector3(x, y, z)

/**
 * `centripetal` avoids the cusps a `chordal`/`uniform` curve produces when two
 * keyframes sit close together — which happens at every room pivot.
 */
const positionCurve = new CatmullRomCurve3(FRAMES.map(({ frame }) => vec(frame.position)), false, 'centripetal', .4)
const targetCurve = new CatmullRomCurve3(FRAMES.map(({ frame }) => vec(frame.target)), false, 'centripetal', .4)

const mobilePositionCurve = new CatmullRomCurve3(FRAMES.map(({ frame }) => {
  const [x, y, z] = frame.position
  // Pull back slightly and stay a touch higher: a 55° portrait frame crops the sides hard.
  return new Vector3(x * .92, y + .12, z + (z > 12 ? .8 : .45))
}), false, 'centripetal', .4)
const mobileTargetCurve = new CatmullRomCurve3(FRAMES.map(({ frame }) => vec(frame.target)), false, 'centripetal', .4)

const LAST = FRAMES.length - 1

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
  if (progress <= STOPS[0]) return FRAMES[0].frame.fov
  if (progress >= STOPS[LAST]) return FRAMES[LAST].frame.fov
  let index = 0
  while (index < LAST && progress > STOPS[index + 1]) index += 1
  const span = Math.max(1e-6, STOPS[index + 1] - STOPS[index])
  const local = MathUtils.smoothstep((progress - STOPS[index]) / span, 0, 1)
  return MathUtils.lerp(FRAMES[index].frame.fov, FRAMES[index + 1].frame.fov, local)
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
export const CAMERA_KEYFRAMES = FRAMES.map(({ frame }, index) => ({ ...frame, progress: STOPS[index] }))
