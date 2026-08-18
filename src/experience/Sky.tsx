import { Cloud, Clouds, Environment } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import { Color, MathUtils, MeshBasicMaterial, Vector3 } from 'three'
import type { Fog } from 'three'

/**
 * The sky is the photographic HDRI, not a procedural dome. Three's `Sky` shader
 * washes to near-white under ACES at the elevations an eye-level camera actually
 * looks at, and dropping the exposure far enough to recover a blue crushed the
 * villa with it. The probe already in the bundle carries a real horizon, real
 * cloud structure and light that matches what it lights.
 *
 * The visit runs across one morning: the environment is rotated and re-graded as
 * the scroll advances, so arrival is bright and the closing wide shot is amber —
 * continuous, never a day/night cut.
 */
type SkyStop = {
  at: number
  /** Radians of yaw applied to the HDRI, which walks the sun across the sky. */
  rotation: number
  skyIntensity: number
  envIntensity: number
  /** Sun elevation in degrees, kept in step with the probe for shadow direction. */
  elevation: number
  cloud: string
  fog: string
  fogNear: number
  fogFar: number
}

const STOPS: SkyStop[] = [
  { at: 0, rotation: -.35, skyIntensity: 1.02, envIntensity: .92, elevation: 30, cloud: '#ffffff', fog: '#b3c6d6', fogNear: 150, fogFar: 420 },
  { at: .30, rotation: -.12, skyIntensity: 1.06, envIntensity: .98, elevation: 36, cloud: '#fffdf8', fog: '#b8cad9', fogNear: 155, fogFar: 430 },
  { at: .62, rotation: .18, skyIntensity: .98, envIntensity: .90, elevation: 24, cloud: '#fff3e0', fog: '#bfc7cc', fogNear: 150, fogFar: 415 },
  { at: .84, rotation: .46, skyIntensity: .90, envIntensity: .80, elevation: 14, cloud: '#ffdfb8', fog: '#cbbdac', fogNear: 135, fogFar: 390 },
  { at: 1, rotation: .62, skyIntensity: .84, envIntensity: .72, elevation: 8, cloud: '#ffcd99', fog: '#d0b498', fogNear: 125, fogFar: 370 },
]

function stopAt(progress: number) {
  let index = 0
  while (index < STOPS.length - 2 && progress > STOPS[index + 1].at) index += 1
  const from = STOPS[index]
  const to = STOPS[index + 1]
  const t = MathUtils.smoothstep(MathUtils.clamp((progress - from.at) / Math.max(1e-6, to.at - from.at), 0, 1), 0, 1)
  return {
    rotation: MathUtils.lerp(from.rotation, to.rotation, t),
    skyIntensity: MathUtils.lerp(from.skyIntensity, to.skyIntensity, t),
    envIntensity: MathUtils.lerp(from.envIntensity, to.envIntensity, t),
    elevation: MathUtils.lerp(from.elevation, to.elevation, t),
    cloud: new Color(from.cloud).lerp(new Color(to.cloud), t),
    fog: new Color(from.fog).lerp(new Color(to.fog), t),
    fogNear: MathUtils.lerp(from.fogNear, to.fogNear, t),
    fogFar: MathUtils.lerp(from.fogFar, to.fogFar, t),
  }
}

/**
 * Shared by the key light so cast shadows always agree with the probe. The base
 * azimuth matches the HDRI's own sun; the stop rotation walks both together.
 */
const BASE_AZIMUTH = 288

export function sunVectorAt(progress: number, out = new Vector3()) {
  const { elevation, rotation } = stopAt(progress)
  const phi = MathUtils.degToRad(90 - elevation)
  const theta = MathUtils.degToRad(BASE_AZIMUTH) + rotation
  return out.setFromSphericalCoords(1, phi, theta)
}

/**
 * Cloud banks sit far out and high so they read as weather, not props: the camera
 * never approaches them and the parallax stays gentle.
 */
const BANKS = [
  { position: [-34, 22, -30] as const, bounds: [22, 3, 11] as const, volume: 9, opacity: .5, seed: 11, speed: .05 },
  { position: [26, 26, -44] as const, bounds: [26, 3.4, 13] as const, volume: 11, opacity: .42, seed: 27, speed: .04 },
  { position: [-6, 31, -66] as const, bounds: [36, 4.2, 15] as const, volume: 13, opacity: .34, seed: 43, speed: .03 },
  { position: [44, 19, 10] as const, bounds: [20, 2.6, 10] as const, volume: 8, opacity: .36, seed: 58, speed: .045 },
  { position: [-52, 17, 24] as const, bounds: [18, 2.4, 9] as const, volume: 7, opacity: .3, seed: 71, speed: .05 },
]

export function DaylightSky({ progress, mobile, degraded }: { progress: number; mobile: boolean; degraded: boolean }) {
  const scene = useThree((state) => state.scene)
  const sun = useMemo(() => new Vector3(), [])
  // Quantised so the cloud tint re-renders a handful of times across the whole
  // scroll rather than on every frame.
  const tintStep = Math.round(progress * 16)
  const cloudTint = useMemo(() => `#${stopAt(tintStep / 16).cloud.getHexString()}`, [tintStep])

  useFrame(() => {
    const stop = stopAt(progress)
    sunVectorAt(progress, sun)
    scene.backgroundIntensity = stop.skyIntensity
    scene.environmentIntensity = stop.envIntensity * (degraded ? .82 : 1)
    scene.backgroundRotation.y = stop.rotation
    scene.environmentRotation.y = stop.rotation
    const fog = scene.fog as Fog | null
    if (fog) {
      fog.color.copy(stop.fog)
      fog.near = stop.fogNear
      fog.far = stop.fogFar
    }
  })

  return <>
    {/* Pushed far past the villa: the previous 48→88 range flattened the hillside
        into the sky and erased the horizon entirely. */}
    <fog attach="fog" args={['#b3c6d6', 150, 420]} />
    <Environment
      files="/assets/hdr/blouberg-sunrise-1-1k.hdr"
      background
      backgroundBlurriness={.08}
    />
    <Clouds material={MeshBasicMaterial} limit={mobile ? 260 : 520} range={mobile ? 90 : 160} frustumCulled={false}>
      {BANKS.slice(0, mobile ? 3 : BANKS.length).map((bank, index) => <Cloud
        key={index}
        color={cloudTint}
        seed={bank.seed}
        position={bank.position}
        bounds={bank.bounds}
        volume={bank.volume}
        segments={mobile ? 18 : 34}
        opacity={bank.opacity}
        growth={5.5}
        speed={bank.speed}
        fade={220}
      />)}
    </Clouds>
  </>
}
