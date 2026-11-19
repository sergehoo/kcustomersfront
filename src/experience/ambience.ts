import { useCallback, useEffect, useState } from 'react'

/**
 * Day / night, decided from the visitor's own clock.
 *
 * Every lighting decision that differs between the two lives in `AMBIENCES`,
 * so the scene components only read numbers and never branch on the mode.
 * Both modes mount exactly the same lights, materials and meshes — only
 * intensities, colours and visibility change — so switching never changes the
 * light count and never recompiles a shader.
 *
 * `?ambience=day|night` forces the starting mode (QA, marketing captures);
 * the visitor can still flip it with the on-page toggle.
 */
export type AmbienceMode = 'day' | 'night'

export type Ambience = {
  mode: AmbienceMode
  /** Photographic day sky vs. procedural blue-hour dome. */
  daySky: boolean
  /** Scales the sky probe's lighting and reflections. */
  environment: number
  /** Key light: the sun by day, a cool moon by night. */
  key: { color: string; intensity: number }
  /** Exterior ambient fill (blue hour only). */
  nightFill: number
  /** Multipliers applied on top of each fitting's own intensity. */
  lamps: number
  facade: number
  steps: number
  /** Emissive strength of every lens, LED strip and glowing pane. */
  emissive: number
  /** Additive light pools (wall washers, uplights, pool lights). */
  decals: number
  /** Turquoise underwater glow of the pool. */
  pool: number
  exposure: number
  bloom: number
}

export const AMBIENCES: Record<AmbienceMode, Ambience> = {
  day: {
    mode: 'day',
    daySky: true,
    environment: 1,
    key: { color: '#ffeed6', intensity: 1 },
    nightFill: 0,
    lamps: 1,
    facade: 0,
    steps: .35,
    emissive: .6,
    decals: 0,
    pool: 0,
    exposure: 1,
    bloom: .32,
  },
  night: {
    mode: 'night',
    daySky: false,
    environment: .14,
    key: { color: '#9db2e6', intensity: .07 },
    nightFill: .55,
    lamps: 4.2,
    facade: 2.4,
    steps: 2.6,
    emissive: 5,
    decals: 1,
    pool: 1,
    exposure: 1.18,
    bloom: .8,
  },
}

/** Daylight from 07:00 to 18:59 local time. */
export function modeAt(date = new Date()): AmbienceMode {
  const hour = date.getHours()
  return hour >= 7 && hour < 19 ? 'day' : 'night'
}

function forcedMode(): AmbienceMode | null {
  if (typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get('ambience')
  return value === 'day' || value === 'night' ? value : null
}

/**
 * The mode follows the visitor's clock (re-checked every five minutes, so a
 * visit that straddles 19:00 follows the evening) unless they flip it by hand.
 * A manual choice that lands back on the clock's own mode returns to "auto",
 * so the toggle never leaves the visit stuck against the time of day.
 */
export function useAmbienceControl() {
  const forced = forcedMode()
  const [clock, setClock] = useState<AmbienceMode>(() => forced ?? modeAt())
  const [manual, setManual] = useState<AmbienceMode | null>(null)
  useEffect(() => {
    if (forced) return
    const timer = window.setInterval(() => setClock(modeAt()), 5 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [forced])
  const mode = manual ?? clock
  const toggle = useCallback(() => {
    const next: AmbienceMode = mode === 'day' ? 'night' : 'day'
    setManual(next === clock ? null : next)
  }, [mode, clock])
  // "Automatic" means the visitor's clock — not a mode forced by ?ambience=.
  return { ambience: AMBIENCES[mode], mode, automatic: manual === null && !forced, toggle }
}

export function useAmbience(): Ambience {
  return useAmbienceControl().ambience
}
