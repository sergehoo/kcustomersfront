import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, MathUtils, Vector3 } from 'three'
import type { DirectionalLight, HemisphereLight } from 'three'
import { sunVectorAt } from './Sky'

/** Sun colour follows the same morning→golden-hour arc as the sky. */
const SUN_STOPS: { at: number; color: string; intensity: number }[] = [
  { at: 0, color: '#ffbe86', intensity: 1.85 },
  { at: .30, color: '#ffe0b4', intensity: 2.4 },
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

/**
 * Uplights on the stone pier, wall washers on the entrance and grazing light
 * under the soffit. Aimed with an explicit target so the cone lands on a surface.
 */
const FACADE_LIGHTS = [
  { position: [1.3, 3.9, 17.0] as const, target: [1.6, 9.2, 15.6] as const, color: '#ffd9a8', intensity: 34, angle: .42, distance: 16 },
  { position: [3.0, 3.9, 17.0] as const, target: [3.0, 9.4, 15.6] as const, color: '#ffd9a8', intensity: 34, angle: .42, distance: 16 },
  // Entrance wash, so the door reads as the focal point.
  { position: [2.2, 6.4, 15.4] as const, target: [2.2, 4.0, 13.9] as const, color: '#ffdcb4', intensity: 26, angle: .62, distance: 10 },
]

/** Recessed lights in the stair cheeks, matching the emissive lenses. */
const STEP_LIGHTS = [
  [0.35, 1.7, 24.2] as const, [3.95, 2.6, 22.0] as const, [2.15, 3.6, 19.8] as const,
]

export function Lighting({ progress, mobile }: { progress: number; mobile: boolean }) {
  const duskBoost = 1 - MathUtils.smoothstep(progress, 0, .3)
  // Mounted only for the arrival scenes: these fittings are invisible from
  // indoors yet still added a light to every material's shader.
  const outside = progress < .26
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
    // Dusk needs the lamps to carry the frame, so they rise as the sun drops.
    const dusk = 1 - MathUtils.smoothstep(progress, 0, .3)
    if (sky.current) sky.current.intensity = (.3 - inside * .06) * (1 - dusk * .55)
  })

  return <>
    <hemisphereLight ref={sky} args={['#cfe0f2', '#6b5a44', .3]} />
    <directionalLight
      ref={key}
      castShadow={!mobile}
      position={[-18, 26, 22]}
      color="#fff2dc"
      intensity={3.1}
      shadow-mapSize={mobile ? [512, 512] : [1536, 1536]}
      // Tightened from ±34 / far 110: the wider frustum pulled the whole site
      // into the shadow pass and spent most of the map on empty hillside.
      shadow-camera-far={78}
      shadow-camera-left={-22}
      shadow-camera-right={22}
      shadow-camera-top={22}
      shadow-camera-bottom={-22}
      shadow-bias={-.00012}
      shadow-normalBias={.028}
    />
    {/* Bounce from the pale travertine deck, which the HDRI alone under-reads. */}
    {/* Dusk fill on the entrance façade: at low sun the concrete volumes went
        almost black and the architecture stopped reading. */}
    <directionalLight position={[10, 8, 34]} color="#cfd8e6" intensity={.35 + duskBoost * .75} />
    <directionalLight position={[6, 3, -8]} color="#e8dcc8" intensity={.42} />
    {/* Architectural exterior lighting. The fittings were emissive meshes only —
        they looked lit but cast nothing, so no surface was ever washed. These
        fade in with dusk and are dropped entirely on mobile. */}
    {!mobile && outside && FACADE_LIGHTS.map((light, index) => <spotLight
      key={`facade-${index}`}
      position={light.position}
      target-position={light.target}
      color={light.color}
      intensity={light.intensity * duskBoost}
      angle={light.angle}
      penumbra={.72}
      distance={light.distance}
      decay={2}
    />)}
    {!mobile && outside && STEP_LIGHTS.map((position, index) => <pointLight
      key={`step-${index}`}
      position={position}
      color="#ffcf9c"
      intensity={3.1 * duskBoost}
      distance={3.4}
      decay={2}
    />)}
    {LAMPS.slice(0, mobile ? 3 : outside ? 4 : LAMPS.length).map((lamp, index) => <pointLight
      key={index}
      position={lamp.position}
      color={lamp.color}
      intensity={lamp.intensity * (1 + duskBoost * 1.5)}
      distance={lamp.distance}
      decay={2}
    />)}
  </>
}
