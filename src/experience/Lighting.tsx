import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, MathUtils, Vector3 } from 'three'
import type { DirectionalLight, HemisphereLight } from 'three'
import { sunVectorAt } from './Sky'

/** Sun colour follows the same morning→golden-hour arc as the sky. */
const SUN_STOPS: { at: number; color: string; intensity: number }[] = [
  { at: 0, color: '#fff2dc', intensity: 3.1 },
  { at: .30, color: '#fff6e8', intensity: 3.3 },
  { at: .62, color: '#ffe6bd', intensity: 2.9 },
  { at: .84, color: '#ffc98a', intensity: 2.5 },
  { at: 1, color: '#ffb473', intensity: 2.0 },
]

function sunLook(progress: number) {
  let index = 0
  while (index < SUN_STOPS.length - 2 && progress > SUN_STOPS[index + 1].at) index += 1
  const from = SUN_STOPS[index]
  const to = SUN_STOPS[index + 1]
  const t = MathUtils.smoothstep(MathUtils.clamp((progress - from.at) / Math.max(1e-6, to.at - from.at), 0, 1), 0, 1)
  return {
    color: new Color(from.color).lerp(new Color(to.color), t),
    intensity: MathUtils.lerp(from.intensity, to.intensity, t),
  }
}

/**
 * Interior lamps are only worth their draw calls while the camera is inside.
 * `distance`/`decay` keep them local so they warm a room instead of washing the
 * whole villa.
 */
const LAMPS = [
  { position: [-5.2, 5.9, 14.2] as const, color: '#ffd8a4', intensity: 26, distance: 9 },
  { position: [-3.8, 6.35, 11.0] as const, color: '#ffcb8c', intensity: 30, distance: 10 },
  { position: [2.8, 6.25, 8.9] as const, color: '#ffd09a', intensity: 24, distance: 9 },
  { position: [-7.6, 5.7, 7.0] as const, color: '#f8c184', intensity: 18, distance: 7 },
  { position: [1.0, 6.6, 14.2] as const, color: '#ffd7a8', intensity: 16, distance: 8 },
  { position: [-1.0, 8.9, 11.5] as const, color: '#ffd2a0', intensity: 20, distance: 9 },
]

export function Lighting({ progress, mobile }: { progress: number; mobile: boolean }) {
  const key = useRef<DirectionalLight>(null)
  const sky = useRef<HemisphereLight>(null)
  const sun = useMemo(() => new Vector3(), [])

  useFrame(() => {
    const inside = MathUtils.smoothstep(progress, .26, .34) * (1 - MathUtils.smoothstep(progress, .64, .74))
    const look = sunLook(progress)
    if (key.current) {
      sunVectorAt(progress, sun)
      key.current.position.copy(sun).multiplyScalar(42)
      key.current.color.copy(look.color)
      // Pull the sun back indoors so the interior reads by its own lamps.
      key.current.intensity = look.intensity * (1 - inside * .3)
    }
    if (sky.current) sky.current.intensity = .3 - inside * .06
  })

  return <>
    <hemisphereLight ref={sky} args={['#cfe0f2', '#6b5a44', .3]} />
    <directionalLight
      ref={key}
      castShadow={!mobile}
      position={[-18, 26, 22]}
      color="#fff2dc"
      intensity={3.1}
      shadow-mapSize={mobile ? [512, 512] : [2048, 2048]}
      shadow-camera-far={110}
      shadow-camera-left={-34}
      shadow-camera-right={34}
      shadow-camera-top={34}
      shadow-camera-bottom={-34}
      shadow-bias={-.00012}
      shadow-normalBias={.028}
    />
    {/* Bounce from the pale travertine deck, which the HDRI alone under-reads. */}
    <directionalLight position={[6, 3, -8]} color="#e8dcc8" intensity={.42} />
    {LAMPS.slice(0, mobile ? 4 : LAMPS.length).map((lamp, index) => <pointLight
      key={index}
      position={lamp.position}
      color={lamp.color}
      intensity={lamp.intensity}
      distance={lamp.distance}
      decay={2}
    />)}
  </>
}
