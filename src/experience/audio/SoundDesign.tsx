import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Box3, MathUtils, Mesh, Vector3 } from 'three'
import type { Ambience } from '../ambience'
import { BIRDS, birdPosition } from '../Birds'
import { WIND_TIME } from '../realism/wind'
import { television } from '../Television'
import type { Mix } from './engine'
import { FILM_LEVEL, mixAt } from './mix'
import { audio, setSoundMode } from './sound'

/**
 * Follows the visit with sound. It makes no sound itself and holds no audio
 * element: every frame it tells the engine what the picture is doing.
 *
 * - the scroll gives the room mix, blended between rooms (mix.ts);
 * - the camera is the listener, so the television is heard from where it hangs;
 * - while the television's film plays, the music ducks under it and comes
 *   back when the room is left — it never stops;
 * - the wind is the gust the planting is in at that moment, at the camera;
 * - a bird that crosses the frame is heard, and from its side of the screen;
 * - the pool comes forward when it is actually in the picture.
 */
/** The water surface: its middle and its four corners. The pool is "in the
 *  picture" as soon as any of them is — from the terrace its middle often is not. */
/**
 * Music under the film. The film has its own score: at .05 the visit's music
 * was still a second tune under it. At .02 it is masked — still playing, so it
 * comes back without a restart, but no longer heard as music.
 */
const DUCKED = .02

const POOL = [[2.4, .4], [-2.3, -1.1], [7.2, -1.1], [-2.3, 1.9], [7.2, 1.9]].map(([x, z]) => new Vector3(x, 3.68, z))

export function SoundDesign({ progress, ambience }: { progress: number; ambience: Ambience }) {
  const scene = useThree((state) => state.scene)
  const mix = useMemo<Mix>(() => ({ music: 0, exterior: 0, birds: 0, wind: 0, room: 0, tv: 0, pool: 0 }), [])
  const point = useMemo(() => new Vector3(), [])
  const forward = useMemo(() => new Vector3(), [])
  const poolFocus = useRef(.55)
  const screenLookup = useRef({ found: false, frames: 0 })

  useEffect(() => { setSoundMode(ambience.mode) }, [ambience.mode])

  useFrame(({ camera, clock }, delta) => {
    if (!audio.audible) return
    mixAt(progress, ambience.mode, mix)

    /** Screen x of a world point if it is in frame, else null. */
    const framed = (margin: number) => {
      point.applyMatrix4(camera.matrixWorldInverse)
      if (point.z > -1) return null
      point.applyMatrix4(camera.projectionMatrix)
      return Math.abs(point.x) < margin && Math.abs(point.y) < margin ? point.x : null
    }

    let seen = 0
    let side = 0
    if (ambience.daySky) {
      for (const bird of BIRDS) {
        birdPosition(bird, clock.elapsedTime, point)
        const x = framed(1)
        if (x !== null) { seen += 1; side += x }
      }
    }
    const presence = Math.min(1, seen / 3)
    audio.setBirds(presence, seen ? side / seen : 0)
    // The garden always has a bird somewhere; one in the sky brings them up.
    mix.birds *= .5 + .5 * presence

    const water = POOL.some((corner) => { point.copy(corner); return framed(1) !== null })
    poolFocus.current = MathUtils.damp(poolFocus.current, water ? 1 : .55, 1.4, delta)
    mix.pool *= poolFocus.current

    // The film's sound exists only while it runs; the engine fades both ways.
    // While it runs it holds one level for the whole room: blended towards the
    // next room like the other layers, it sank through the second half of the
    // living room and left the music on top of the voice.
    if (television.playing) {
      mix.tv = FILM_LEVEL
      mix.music = Math.min(mix.music, DUCKED)
    } else mix.tv = 0

    audio.setMix(mix)
    camera.getWorldDirection(forward)
    audio.setListener(camera.position, forward)

    // The gust of realism/wind.ts, read at the camera, normalised to 0–1.
    const t = WIND_TIME.value
    const gust = .5 + .5 * Math.sin(t * .42 + camera.position.x * .21 + camera.position.z * .17)
    audio.setWind(gust, Math.sin(t * .19) * .45)

    // The screen is part of the villa model, which arrives after this mounts.
    const tv = screenLookup.current
    if (!tv.found && (tv.frames += 1) % 45 === 1) {
      scene.traverse((child) => {
        if (tv.found || !(child instanceof Mesh)) return
        const material = Array.isArray(child.material) ? child.material[0] : child.material
        if (material?.name !== 'KAYDAN_TV_SCREEN') return
        const centre = new Box3().setFromObject(child).getCenter(new Vector3())
        audio.setTelevision(centre.x, centre.y, centre.z)
        tv.found = true
      })
    }
  })

  return null
}
