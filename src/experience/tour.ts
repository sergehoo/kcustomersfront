import { MathUtils } from 'three'
import { TOUR_ROOMS } from './tourShots'

/**
 * The visit, as a property photographer would walk it: room after room, an
 * overview first, then the pieces that matter, each shot aimed at a named
 * target on real furniture. The compositions themselves live in Blender
 * (blender/scripts/camera_shots.py → tourShots.ts), where they are validated
 * against the model: camera clearance, target visible, no leg through a wall.
 *
 * This module turns them into a timeline. Every stop gets its own share of the
 * scroll — a hold for a shot, travel proportional to the distance for a move —
 * so a 14 m transition can never again be crossed in a few dozen pixels, and
 * each room's scroll range grows with the number of shots it has.
 */

export type Triplet = [number, number, number]
export type RoomId =
  | 'exterior' | 'entrance' | 'visitor' | 'living' | 'dining' | 'kitchen' | 'circulation'
  | 'suite' | 'bathroom' | 'bedroom' | 'terrace' | 'pool' | 'garden' | 'finale'

export type Waypoint = { position: Triplet; target: Triplet; fov: number }
export type TourShot = Waypoint & {
  shot: string
  /** The TARGET_ anchor the camera looks at (sofa, island, bed…). */
  subject: string
  /** Relative time the framing is held, in shot units. */
  hold: number
  /** Portrait framing: pulled back where the room allows, wider lens. */
  mobile: { position: Triplet; fov: number }
  /** Waypoints walked before this shot, within the room. */
  via: Waypoint[]
  note: string
}
export type TourRoom = { room: RoomId; approach: Waypoint[]; shots: TourShot[] }

export type TourStop = {
  room: RoomId
  /** `null` for a waypoint between shots. */
  shot: string | null
  subject: string | null
  desktop: Waypoint
  mobile: Waypoint
  /** Normalised progress at which the camera reaches the stop, and leaves it. */
  arrive: number
  leave: number
}

/** Scroll units: a held shot is ~1, a move costs a base plus its length. */
const MOVE_BASE = .28
const MOVE_PER_METRE = .075
/** One scroll unit, in viewport heights. */
const UNIT_VH = 36

const distance = (a: Triplet, b: Triplet) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const widen = (fov: number) => Math.min(72, fov * 1.42)

function buildTimeline(rooms: TourRoom[]) {
  const raw: (Omit<TourStop, 'arrive' | 'leave'> & { hold: number })[] = []
  for (const room of rooms) {
    const waypoint = (w: Waypoint) => raw.push({
      room: room.room, shot: null, subject: null, hold: 0,
      desktop: w, mobile: { ...w, fov: widen(w.fov) },
    })
    room.approach.forEach(waypoint)
    for (const shot of room.shots) {
      shot.via.forEach(waypoint)
      raw.push({
        room: room.room, shot: shot.shot, subject: shot.subject, hold: shot.hold,
        desktop: { position: shot.position, target: shot.target, fov: shot.fov },
        mobile: { position: shot.mobile.position, target: shot.target, fov: shot.mobile.fov },
      })
    }
  }
  let t = 0
  const timed = raw.map((stop, index) => {
    if (index > 0) t += MOVE_BASE + distance(raw[index - 1].desktop.position, stop.desktop.position) * MOVE_PER_METRE
    const arrive = t
    t += stop.hold
    return { ...stop, arrive, leave: t }
  })
  const total = t
  const stops: TourStop[] = timed.map((stop) => ({
    room: stop.room, shot: stop.shot, subject: stop.subject, desktop: stop.desktop, mobile: stop.mobile,
    arrive: stop.arrive / total, leave: stop.leave / total,
  }))
  return { stops, units: total }
}

const { stops, units } = buildTimeline(TOUR_ROOMS)

export const TOUR_STOPS = stops

/** Total scroll length of the visit, in viewport heights. */
export const TOUR_SCROLL_VH = Math.round(units * UNIT_VH)

/**
 * Where each room's editorial copy takes over: the arrival on its overview,
 * once the approach is done — never on a wall halfway through a corridor.
 */
export const ROOM_PROGRESS = Object.fromEntries(
  TOUR_ROOMS.map((room) => [room.room, stops.find((stop) => stop.room === room.room && stop.shot !== null)!.arrive]),
) as Record<RoomId, number>

export const TOUR_SHOT_COUNT = stops.filter((stop) => stop.shot !== null).length
export const TOUR_ROOM_COUNT = TOUR_ROOMS.length

/** The villa's walls: inside, the lighting switches to its interior treatment. */
const indoors = ([x, y, z]: Triplet) => x > -8.2 && x < 6.5 && z > 8.62 && z < 16.25 && y > 3.9 && y < 10

/**
 * Where the camera actually crosses the envelope — the front door on the way
 * in, the terrace door on the way out — as progress ranges. Exposure, lamps,
 * occlusion scale and the sun's swing all key off these, not off constants.
 */
export const TOUR_MARKS = (() => {
  const first = stops.findIndex((stop) => indoors(stop.desktop.position))
  let last = first
  stops.forEach((stop, index) => { if (indoors(stop.desktop.position)) last = index })
  return {
    enter: [stops[first - 1].leave, stops[first].arrive] as const,
    exit: [stops[last].leave, stops[last + 1].arrive] as const,
  }
})()

const stopOf = (room: RoomId, shot: string) => stops.find((stop) => stop.room === room && stop.shot === shot)!
const firstOf = (room: RoomId) => stops.find((stop) => stop.room === room)!

/**
 * The front door pivots open while the camera walks from the landing to the
 * threshold, and closes once it has left the hall.
 */
const DOOR = (() => {
  const door = stopOf('entrance', 'door')
  const threshold = firstOf('visitor')
  const hallEnd = stops.filter((stop) => stop.room === 'visitor').at(-1)!
  const living = firstOf('living')
  return { open0: door.leave, open1: threshold.arrive, close0: hallEnd.leave, close1: living.arrive }
})()

export function doorOpeningAt(progress: number) {
  return MathUtils.smoothstep(progress, DOOR.open0, DOOR.open1) * (1 - MathUtils.smoothstep(progress, DOOR.close0, DOOR.close1))
}
