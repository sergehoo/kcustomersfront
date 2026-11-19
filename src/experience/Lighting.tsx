import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Color, MathUtils, Object3D, Vector3 } from 'three'
import type { DirectionalLight, HemisphereLight, PointLight, SpotLight } from 'three'
import type { Ambience } from './ambience'
import { sunVectorAt } from './Sky'
import { insideAt } from './interior'
import { TOUR_MARKS } from './tour'

/**
 * The sun is the only daylight source besides the sky probe. The previous rig
 * added a hemisphere light and two shadowless fill directionals: each one
 * lifted the shadow side of every volume, which is exactly what made the villa
 * read as a lit maquette rather than a photographed building. Contrast between
 * sun and sky now comes from the scene, and ambient occlusion (PostEffects)
 * grounds what the sun does not reach.
 */
const SUN_STOPS: { at: number; color: string; intensity: number }[] = [
  { at: 0, color: '#ffeed6', intensity: 5.2 },
  { at: TOUR_MARKS.enter[1], color: '#ffe6c6', intensity: 4.8 },
  { at: TOUR_MARKS.exit[0], color: '#ffe6c6', intensity: 4.8 },
  { at: 1, color: '#ffdfb8', intensity: 5.0 },
]

function sunLook(progress: number) {
  let index = 0
  while (index < SUN_STOPS.length - 2 && progress > SUN_STOPS[index + 1].at) index += 1
  const from = SUN_STOPS[index]
  const to = SUN_STOPS[index + 1]
  const t = MathUtils.smoothstep(MathUtils.clamp((progress - from.at) / Math.max(1e-6, to.at - from.at), 0, 1), 0, 1)
  return { color: new Color(from.color).lerp(new Color(to.color), t), intensity: MathUtils.lerp(from.intensity, to.intensity, t) }
}

/** Warm interior fittings, kept local with distance/decay. */
const LAMPS = [
  { position: [-5.2, 5.9, 14.2] as const, color: '#ffd3a0', intensity: 14, distance: 8 },
  { position: [-3.8, 6.35, 11.0] as const, color: '#ffcb8c', intensity: 16, distance: 9 },
  { position: [2.8, 6.25, 8.9] as const, color: '#ffd09a', intensity: 12, distance: 8 },
  { position: [-7.6, 5.7, 7.0] as const, color: '#f8c184', intensity: 10, distance: 7 },
  { position: [1.0, 6.6, 14.2] as const, color: '#ffd7a8', intensity: 9, distance: 7 },
  { position: [-1.0, 8.9, 11.5] as const, color: '#ffd2a0', intensity: 12, distance: 8 },
]

/**
 * Architectural exterior lighting. Off by day, it is what sells the villa at
 * night: grazing light on the stone tower, washes up the white render, a
 * downlight on the entrance door under its canopy.
 */
const FACADE_LIGHTS = [
  { position: [1.1, 3.9, 17.9] as const, target: [1.0, 9.2, 17.3] as const, color: '#ffd7a4', intensity: 18, angle: .42, distance: 14 },
  // Downlight from the porch soffit onto the pivot door, on the axis.
  { position: [4.225, 6.72, 17.1] as const, target: [4.225, 3.8, 16.45] as const, color: '#ffdcb0', intensity: 16, angle: .62, distance: 9 },
  { position: [-1.2, 6.7, 17.7] as const, target: [-1.2, 3.8, 18.6] as const, color: '#ffd9a8', intensity: 10, angle: .7, distance: 8 },
  { position: [-6.2, 3.9, 17.4] as const, target: [-6.2, 9.0, 16.2] as const, color: '#ffd9a8', intensity: 16, angle: .48, distance: 14 },
  { position: [6.6, 3.9, 18.5] as const, target: [6.6, 8.2, 18.0] as const, color: '#ffd9a8', intensity: 12, angle: .4, distance: 10 },
]

/** Down the main stair, on its axis (x 4.225), with the LED strips under the nosings. */
const STEP_LIGHTS = [[4.225, 1.5, 24.7] as const, [4.225, 2.75, 22.46] as const, [4.225, 4.25, 18.8] as const]

/** Underwater pool light: turquoise bounce on the south terrace at night. */
const POOL_LIGHT = { position: [2.4, 3.1, .4] as const, color: '#58d2e4', intensity: 26, distance: 11 }

/** Centre of the area the shadow map has to cover: forecourt to terrace. */
const SHADOW_CENTRE = new Vector3(0, 3, 14)

export function Lighting({ progress, mobile, ambience }: { progress: number; mobile: boolean; ambience: Ambience }) {
  const key = useRef<DirectionalLight>(null)
  const bounce = useRef<HemisphereLight>(null)
  const nightFill = useRef<HemisphereLight>(null)
  const pool = useRef<PointLight>(null)
  const lamps = useRef<(PointLight | null)[]>([])
  const facade = useRef<(SpotLight | null)[]>([])
  const steps = useRef<(PointLight | null)[]>([])
  const sun = useMemo(() => new Vector3(), [])
  const target = useMemo(() => new Object3D(), [])

  useLayoutEffect(() => {
    target.position.copy(SHADOW_CENTRE)
    target.updateMatrixWorld()
    if (key.current) key.current.target = target
    // Spot targets are not in the scene graph, so their world matrix is never
    // refreshed on its own: without this every wash aimed at the origin.
    facade.current.forEach((light) => light?.target.updateMatrixWorld())
  }, [target])

  // Every light stays mounted for the whole visit and is faded by intensity
  // only. Mounting and unmounting them on the threshold changed the light count,
  // which recompiled every material in the villa and froze the frame ~0.5–0.8 s.
  useFrame(() => {
    const inside = insideAt(progress)
    // Façade lights accompany the arrival by day, until the front door.
    const arrival = 1 - MathUtils.smoothstep(progress, TOUR_MARKS.enter[0] - .02, TOUR_MARKS.enter[1])
    const look = sunLook(progress)
    const night = ambience.mode === 'night'
    if (key.current) {
      sunVectorAt(progress, sun)
      key.current.position.copy(SHADOW_CENTRE).addScaledVector(sun, 60)
      // By night the same light becomes a faint cool moon, so shadows keep their direction.
      if (night) key.current.color.set(ambience.key.color)
      else key.current.color.copy(look.color)
      key.current.intensity = look.intensity * ambience.key.intensity
    }
    if (nightFill.current) nightFill.current.intensity = ambience.nightFill
    if (pool.current) pool.current.intensity = POOL_LIGHT.intensity * ambience.pool
    // Indoors only: the light a pale stone floor throws back up at the
    // ceiling. Without it every ceiling went near-black under AO, the main
    // tell of a real-time interior.
    if (bounce.current) bounce.current.intensity = inside * (night ? .2 : .75)
    // Lamps are an accent in a daylight room, not its light source.
    // By night every lamp is on, seen from outside as much as from inside.
    lamps.current.forEach((light, index) => {
      if (light) light.intensity = LAMPS[index].intensity * (night ? ambience.lamps : .25 + inside * .35)
    })
    facade.current.forEach((light, index) => {
      if (light) light.intensity = FACADE_LIGHTS[index].intensity * ambience.facade * (night ? 1 : arrival)
    })
    steps.current.forEach((light) => {
      if (light) light.intensity = 1.6 * ambience.steps * (night ? 1 : arrival)
    })
  })

  return <>
    <primitive object={target} />
    <hemisphereLight ref={bounce} args={['#f3efe8', '#c9b393', 0]} />
    {/* Blue-hour sky light: keeps the white volumes reading against the dusk. */}
    <hemisphereLight ref={nightFill} args={['#4a6cc0', '#141824', 0]} />
    <directionalLight
      ref={key}
      castShadow={!mobile}
      color="#fff0dc"
      intensity={4.4}
      shadow-mapSize={mobile ? [512, 512] : [2048, 2048]}
      shadow-camera-near={10}
      shadow-camera-far={120}
      shadow-camera-left={-25}
      shadow-camera-right={25}
      shadow-camera-top={25}
      shadow-camera-bottom={-25}
      shadow-bias={-.00018}
      shadow-normalBias={.035}
      shadow-radius={2.5}
    />
    {!mobile && FACADE_LIGHTS.map((light, index) => <spotLight
      key={`facade-${index}`}
      ref={(node) => { facade.current[index] = node }}
      position={light.position}
      target-position={light.target}
      color={light.color}
      intensity={light.intensity}
      angle={light.angle}
      penumbra={.72}
      distance={light.distance}
      decay={2}
    />)}
    {!mobile && STEP_LIGHTS.map((position, index) => <pointLight
      key={`step-${index}`}
      ref={(node) => { steps.current[index] = node }}
      position={position}
      color="#ffcf9c"
      intensity={1.6}
      distance={4.2}
      decay={2}
    />)}
    {!mobile && <pointLight
      ref={pool}
      position={POOL_LIGHT.position}
      color={POOL_LIGHT.color}
      intensity={0}
      distance={POOL_LIGHT.distance}
      decay={2}
    />}
    {LAMPS.slice(0, mobile ? 3 : LAMPS.length).map((lamp, index) => <pointLight
      key={index}
      ref={(node) => { lamps.current[index] = node }}
      position={lamp.position}
      color={lamp.color}
      intensity={lamp.intensity}
      distance={lamp.distance}
      decay={2}
    />)}
  </>
}
