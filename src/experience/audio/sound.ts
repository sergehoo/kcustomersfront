import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { AudioExperience, type SoundMode } from './engine'

/**
 * The one engine of the page, and the visitor's choice about it.
 *
 * - Nothing audible ever starts by itself. A first-time visitor hears the
 *   visit when they press « Découvrir l'expérience » (or the sound control).
 * - The choice is remembered. Someone who had the sound on finds it again on
 *   their next visit — at their first click or key press, because a browser
 *   will not let a page play before that. Someone who muted it stays muted,
 *   and the call to action no longer turns it on.
 * - If the browser refuses audio the visit simply goes on silent.
 */
export const audio = new AudioExperience()
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as Record<string, unknown>).__audio = audio

const KEY = 'kd.sound'
type Preference = 'on' | 'off' | null

function stored(): Preference {
  try {
    const value = window.localStorage.getItem(KEY)
    return value === 'on' || value === 'off' ? value : null
  } catch { return null }
}

let preference: Preference = typeof window === 'undefined' ? null : stored()
let playing = false
/** A start is under way: the same gesture must not be answered twice. */
let starting = false
let mode: SoundMode = 'day'
const listeners = new Set<() => void>()

function publish(next: boolean) {
  playing = next
  listeners.forEach((listener) => listener())
}

function remember(value: 'on' | 'off') {
  preference = value
  try { window.localStorage.setItem(KEY, value) } catch { /* private mode: the choice lasts the visit */ }
}

/** From a click or a key press only. */
async function enable() {
  if (starting) return
  starting = true
  remember('on')
  const started = await audio.start(mode)
  starting = false
  publish(started)
}

function disable() {
  remember('off')
  audio.mute()
  publish(false)
}

/** Day or night, as the visit shows it. */
export function setSoundMode(next: SoundMode) {
  mode = next
  audio.setMode(next)
}

export function useSound() {
  const on = useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    () => playing,
    () => false,
  )

  // A returning visitor who left the sound on: it comes back with their first
  // gesture, whatever it is.
  useEffect(() => {
    if (preference !== 'on' || playing) return
    // …except a press on the sound control itself, which speaks for itself:
    // answering it here as well turned the sound on and straight off again.
    const resume = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('.sound-toggle')) return
      if (preference === 'on' && !playing) void enable()
    }
    window.addEventListener('pointerdown', resume, { once: true })
    window.addEventListener('keydown', resume, { once: true })
    return () => {
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
    }
  }, [])

  // A background tab does not keep an orchestra playing.
  useEffect(() => {
    const onVisibility = () => audio.hold(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const toggle = useCallback(() => {
    if (starting) return
    if (playing) disable()
    else void enable()
  }, [])
  /** The visit's own start: turns the sound on unless the visitor has muted it before. */
  const begin = useCallback(() => { if (preference !== 'off' && !playing) void enable() }, [])
  return { on, toggle, begin }
}
