import { MathUtils } from 'three'
import { EXPERIENCE_SECTIONS } from '../sections'
import type { RoomId } from '../tour'
import type { Mix, SoundMode } from './engine'

/**
 * What each room sounds like — the one table to edit.
 *
 * Levels are gains on layers that all sit at a comparable loudness, so the
 * numbers read as a mix: music around .15, the garden between .10 and .15,
 * the television near .10, the pool up to .19. Nothing is switched on or off
 * by a threshold: `mixAt` blends a room's row into the next one while the
 * camera travels between them, the way the lighting is interpolated, and the
 * engine then glides every gain to its target.
 *
 * Indoors the garden does not vanish, it recedes: the south bay stands open,
 * so a little air and a distant bird still come through.
 */
const ROOMS: Record<RoomId, Mix> = {
  exterior:    { music: .16, exterior: .10, birds: .15, wind: .13, room: 0,    tv: 0,    pool: 0 },
  entrance:    { music: .16, exterior: .09, birds: .13, wind: .11, room: 0,    tv: 0,    pool: 0 },
  visitor:     { music: .15, exterior: .03, birds: .03, wind: .035, room: .05, tv: .02,  pool: 0 },
  living:      { music: .14, exterior: .02, birds: .02, wind: .03, room: .05,  tv: .11,  pool: 0 },
  dining:      { music: .15, exterior: .015, birds: .015, wind: .02, room: .05, tv: .06, pool: 0 },
  kitchen:     { music: .15, exterior: .015, birds: .015, wind: .02, room: .05, tv: .03, pool: 0 },
  circulation: { music: .16, exterior: .01, birds: .01, wind: .015, room: .05, tv: .02,  pool: 0 },
  // Bedrooms: calm. The curtains move, so a breath of wind stays.
  suite:       { music: .14, exterior: .012, birds: .012, wind: .03, room: .045, tv: 0,  pool: 0 },
  // No tap is running: near-silence is the luxury here.
  bathroom:    { music: .13, exterior: 0,   birds: 0,    wind: 0,   room: .04,  tv: 0,   pool: 0 },
  bedroom:     { music: .14, exterior: .012, birds: .012, wind: .025, room: .045, tv: 0, pool: 0 },
  terrace:     { music: .16, exterior: .09, birds: .10, wind: .11, room: 0,    tv: 0,    pool: .12 },
  pool:        { music: .16, exterior: .09, birds: .10, wind: .10, room: 0,    tv: 0,    pool: .19 },
  garden:      { music: .16, exterior: .10, birds: .14, wind: .12, room: 0,    tv: 0,    pool: .04 },
  // The close: the music opens a little, the water carries the scene.
  finale:      { music: .19, exterior: .07, birds: .08, wind: .07, room: 0,    tv: 0,    pool: .17 },
}

/** Night: the birds have gone to roost, the air is stiller, the water nearer. */
const NIGHT: Mix = { music: 1, exterior: .85, birds: .1, wind: .8, room: 1, tv: 1, pool: 1.22 }

const LAYERS = Object.keys(NIGHT) as (keyof Mix)[]

/** Share of a room's scroll span after which its sound starts turning into the next room's. */
const HANDOVER = .7

export function mixAt(progress: number, mode: SoundMode, out: Mix): Mix {
  let index = 0
  while (index < EXPERIENCE_SECTIONS.length - 1 && progress >= EXPERIENCE_SECTIONS[index + 1].progress) index += 1
  const here = EXPERIENCE_SECTIONS[index]
  const next = EXPERIENCE_SECTIONS[index + 1]
  const from = ROOMS[here.id]
  const to = next ? ROOMS[next.id] : from
  const local = next ? (progress - here.progress) / Math.max(1e-6, next.progress - here.progress) : 0
  const blend = MathUtils.smoothstep(local, HANDOVER, 1)
  for (const layer of LAYERS) {
    out[layer] = MathUtils.lerp(from[layer], to[layer], blend) * (mode === 'night' ? NIGHT[layer] : 1)
  }
  return out
}
