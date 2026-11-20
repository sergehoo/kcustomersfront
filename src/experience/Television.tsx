import { useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Box3, Color, Mesh, SRGBColorSpace, Vector3, VideoTexture, type MeshStandardMaterial, type Texture } from 'three'
import { audio } from './audio/sound'

/**
 * The living-room television plays Kaydan's presentation film.
 *
 *   HTMLVideoElement → THREE.VideoTexture → the screen's own material
 *
 * It is the screen of the model (blender/scripts/refine_media.py) that shows
 * the picture: nothing floats over the canvas.
 *
 * The film is tied to the room, not to the scroll. Entering the living room
 * seeks to `START` and plays; staying there — whatever the camera does between
 * the room's shots — changes nothing; leaving pauses and rewinds to `START`,
 * so the next visit starts at the same place. That is an effect on `active`
 * turning true or false, never a per-frame seek.
 *
 * Its sound goes through the visit's audio engine (attachTelevision): placed
 * where the screen hangs, faded in and out, cut by the same mute. A browser
 * will not start a film with sound before the visitor has clicked somewhere,
 * so while the visit's sound is off the film plays silently.
 */
const SOURCE = '/media/kaydan-presentation.mp4'
/** The film's frame at `START`: what the screen shows before the room is entered. */
const POSTER = '/media/kaydan-presentation-poster.webp'
/** Where the film is taken up, in seconds. */
const START = 40

/** Read by the sound design: while the film plays, the music ducks under it. */
export const television = { playing: false }

export function Television({ active, night }: { active: boolean; night: boolean }) {
  const scene = useThree((state) => state.scene)
  const screen = useRef<{ material: MeshStandardMaterial; aspect: number } | null>(null)
  const lookups = useRef(0)
  const uploaded = useRef(-1)
  const poster = useTexture(POSTER)

  const video = useMemo(() => {
    const element = document.createElement('video')
    element.src = SOURCE
    // Nothing is downloaded until the visit reaches the room.
    element.preload = 'none'
    element.playsInline = true
    element.muted = true
    element.setAttribute('aria-hidden', 'true')
    return element
  }, [])

  const picture = useMemo(() => {
    const texture = new VideoTexture(video)
    texture.colorSpace = SRGBColorSpace
    // The screen's UVs come from glTF, whose images are not flipped.
    texture.flipY = false
    return texture
  }, [video])

  useEffect(() => {
    audio.attachTelevision(video)
    const onPlaying = () => { television.playing = true }
    const onStopped = () => { television.playing = false }
    // The rewind on leaving the room: the paused screen shows that frame.
    const onSeeked = () => { picture.needsUpdate = true }
    video.addEventListener('playing', onPlaying)
    video.addEventListener('pause', onStopped)
    video.addEventListener('seeked', onSeeked)
    return () => {
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('pause', onStopped)
      video.removeEventListener('seeked', onSeeked)
      video.pause()
      television.playing = false
      picture.dispose()
    }
  }, [video, picture])

  // Entering and leaving the room — the only places the film is started,
  // stopped or sought.
  useEffect(() => {
    if (!active) return
    let left = false
    const play = () => {
      if (left) return
      video.muted = !audio.audible
      video.play().catch(() => {
        // Sound refused (no gesture yet): the picture still plays.
        if (left) return
        video.muted = true
        video.play().catch(() => undefined)
      })
    }
    const start = () => {
      if (left) return
      video.currentTime = START
      play()
    }
    // Past its end the film goes back to where the visit takes it up.
    const again = () => { if (!left) start() }
    video.addEventListener('ended', again)
    if (video.readyState >= 1) start()
    else {
      video.addEventListener('loadedmetadata', start, { once: true })
      video.load()
    }
    return () => {
      left = true
      video.removeEventListener('ended', again)
      video.removeEventListener('loadedmetadata', start)
      video.pause()
      if (video.readyState >= 1) video.currentTime = START
    }
  }, [active, video])

  /** Cover, never stretch: crop whichever side of the image overflows the panel. */
  const fit = (texture: Texture, image: number, panel: number) => {
    if (image > panel) {
      texture.repeat.set(panel / image, 1)
      texture.offset.set((1 - panel / image) / 2, 0)
    } else {
      texture.repeat.set(1, image / panel)
      texture.offset.set(0, (1 - image / panel) / 2)
    }
  }

  useFrame(() => {
    // The screen is part of the villa model, which arrives after this mounts.
    if (!screen.current) {
      lookups.current += 1
      if (lookups.current % 30 !== 1) return
      scene.traverse((child) => {
        if (screen.current || !(child instanceof Mesh)) return
        const material = (Array.isArray(child.material) ? child.material[0] : child.material) as MeshStandardMaterial
        if (material?.name !== 'KAYDAN_TV_SCREEN') return
        const size = new Box3().setFromObject(child).getSize(new Vector3())
        const aspect = Math.max(size.x, size.z) / size.y
        // Until the room is entered the screen holds the film's own frame.
        const image = poster.image as { width: number; height: number }
        poster.colorSpace = SRGBColorSpace
        poster.flipY = false
        fit(poster, image.width / image.height, aspect)
        poster.needsUpdate = true
        material.emissiveMap = poster
        material.emissive = new Color('#ffffff')
        material.needsUpdate = true
        screen.current = { material, aspect }
      })
      return
    }
    const { material, aspect } = screen.current
    // The film takes over the screen with its first decoded frame.
    if (material.emissiveMap !== picture && video.readyState >= 2 && video.videoWidth) {
      fit(picture, video.videoWidth / video.videoHeight, aspect)
      material.emissiveMap = picture
    }
    // A new frame is uploaded when the film has moved on. Done here, by the
    // film's own clock, rather than left to the browser's video-frame
    // callback, which does not fire for every browser or for a page that is
    // not on screen — and a television that stays black is worse than one
    // refreshed a frame late.
    if (!video.paused && video.readyState >= 2 && video.currentTime !== uploaded.current) {
      uploaded.current = video.currentTime
      picture.needsUpdate = true
    }
    // A lit panel in a lit room: bright enough to read, never a lamp. Dimmer
    // at night, as a screen is turned down in the evening.
    material.emissiveIntensity = night ? .62 : .82
    // The visitor turned the sound on or off while the film was running.
    if (!video.paused && video.muted === audio.audible) video.muted = !audio.audible
  })

  return null
}
