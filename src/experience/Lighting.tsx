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
/**
 * Outside, the sun is held a fifth lower than it was. At 5.2 every sunlit
 * face of the off-white render landed at 240–247 out of 255 — a seventh of
 * the hero frame with no tone left in it, the plaster's grain and the panel
 * joints gone. At 3.9, with the day's exposure and the render's albedo each
 * eased a few percent, a lit wall sits around 220: still plainly the
 * brightest thing after the clouds, but with a surface. Indoors it keeps its strength:
 * there the sun only reaches the floors as patches.
 */
const SUN_STOPS: { at: number; color: string; intensity: number }[] = [
  { at: 0, color: '#ffecd2', intensity: 3.9 },
  { at: TOUR_MARKS.enter[0], color: '#ffecd2', intensity: 3.9 },
  { at: TOUR_MARKS.enter[1], color: '#ffe6c6', intensity: 4.8 },
  { at: TOUR_MARKS.exit[0], color: '#ffe6c6', intensity: 4.8 },
  { at: TOUR_MARKS.exit[1], color: '#ffe4c2', intensity: 3.9 },
  { at: 1, color: '#ffdfb8', intensity: 3.9 },
]

function sunLook(progress: number) {
  let index = 0
  while (index < SUN_STOPS.length - 2 && progress > SUN_STOPS[index + 1].at) index += 1
  const from = SUN_STOPS[index]
  const to = SUN_STOPS[index + 1]
  const t = MathUtils.smoothstep(MathUtils.clamp((progress - from.at) / Math.max(1e-6, to.at - from.at), 0, 1), 0, 1)
  return { color: new Color(from.color).lerp(new Color(to.color), t), intensity: MathUtils.lerp(from.intensity, to.intensity, t) }
}

/**
 * Warm interior fittings, kept local with distance/decay.
 *
 * `down` marks the ground-floor pendants and ceiling fittings. None of these
 * lights casts a shadow, so as point lights they shone straight through the
 * slab above them: the foot of every upstairs wall glowed orange and the
 * bathtub was lit from underneath. A wide cone pointing down sends nothing
 * above its own horizon.
 */
const LAMPS = [
  { position: [-5.2, 5.9, 14.2] as const, color: '#ffd3a0', intensity: 14, distance: 8, down: true },
  { position: [-3.8, 6.35, 11.0] as const, color: '#ffcb8c', intensity: 16, distance: 9, down: true },
  { position: [2.8, 6.25, 8.9] as const, color: '#ffd09a', intensity: 12, distance: 8, down: true },
  { position: [-7.6, 5.7, 7.0] as const, color: '#f8c184', intensity: 10, distance: 7, down: true },
  // Foot of the stair: kept soft, it sits two metres from the climbing camera.
  { position: [1.0, 6.6, 14.2] as const, color: '#ffd7a8', intensity: 6, distance: 7, down: true },
  { position: [-1.0, 8.9, 11.5] as const, color: '#ffd2a0', intensity: 12, distance: 8, down: false },
  // Hall, over the console: the only room no other fitting reached.
  { position: [4.6, 6.4, 14.0] as const, color: '#ffd3a0', intensity: 7, distance: 6, down: true },
  // Master bathroom, over the tub: it has no window of its own, and used to
  // be lit by the kitchen pendant through the floor.
  { position: [-5.4, 9.25, 14.3] as const, color: '#ffe4c8', intensity: 5, distance: 6.5, down: false, day: 1.5 },
  // Bedroom 2: the upper floor no longer borrows light from the rooms below.
  // Hung in the middle of the room, not at the bedside lamp — that close to
  // the pillows and the headboard it burnt them out.
  { position: [3.2, 9.05, 10.2] as const, color: '#ffd2a0', intensity: 4, distance: 6, down: false },
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

/** Interior bounce: pale stone by day, the lamps' warm spill by night. */
const BOUNCE = {
  day: { sky: new Color('#f3efe8'), ground: new Color('#c9b393') },
  night: { sky: new Color('#ffd8ac'), ground: new Color('#a8845a') },
}

/** Underwater pool light: turquoise bounce on the south terrace at night. */
const POOL_LIGHT = { position: [2.4, 3.1, .4] as const, color: '#58d2e4', intensity: 26, distance: 11 }

/** Centre of the area the shadow map has to cover: forecourt to terrace. */
const SHADOW_CENTRE = new Vector3(0, 3, 14)

export function Lighting({ progress, mobile, ambience }: { progress: number; mobile: boolean; ambience: Ambience }) {
  const key = useRef<DirectionalLight>(null)
  const bounce = useRef<HemisphereLight>(null)
  const nightFill = useRef<HemisphereLight>(null)
  const pool = useRef<PointLight>(null)
  const lamps = useRef<(PointLight | SpotLight | null)[]>([])
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
    lamps.current.forEach((light) => { if (light && 'target' in light) light.target.updateMatrixWorld() })
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
    // The blue-hour sky light is an exterior fill: indoors it greyed every wall.
    if (nightFill.current) nightFill.current.intensity = ambience.nightFill * (1 - inside * (mobile ? 1 : .8))
    if (pool.current) pool.current.intensity = POOL_LIGHT.intensity * ambience.pool
    // Indoors only: the light a pale stone floor throws back up at the
    // ceiling. Without it every ceiling went near-black under AO, the main
    // tell of a real-time interior.
    // By night it turns warm, as if thrown back from the lamps. Phones mount only
    // the first three lamps, so there it carries the rooms those never reach
    // (hall, stair, upper floor) instead of leaving them black.
    if (bounce.current) {
      bounce.current.intensity = inside * (night ? (mobile ? .8 : .14) : .4)
      bounce.current.color.copy(night ? BOUNCE.night.sky : BOUNCE.day.sky)
      bounce.current.groundColor.copy(night ? BOUNCE.night.ground : BOUNCE.day.ground)
    }
    // Lamps are an accent in a daylight room, not its light source.
    // By night every lamp is on, seen from outside as much as from inside.
    lamps.current.forEach((light, index) => {
      if (!light) return
      const lamp: { intensity: number; day?: number } = LAMPS[index]
      // A windowless room keeps its fitting on by day (`day`); elsewhere the
      // lamps are an accent in a daylight room, not its light source.
      light.intensity = lamp.intensity * (night ? ambience.lamps : lamp.day ? lamp.day * inside : .2 + inside * .2)
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
      // 4096 over a 50 m frustum: ~1.2 cm a texel, so a mullion or a chair leg
      // draws its own edge on the floor instead of a soft smear.
      shadow-mapSize={mobile ? [512, 512] : [4096, 4096]}
      shadow-camera-near={10}
      shadow-camera-far={120}
      shadow-camera-left={-25}
      shadow-camera-right={25}
      shadow-camera-top={25}
      shadow-camera-bottom={-25}
      shadow-bias={-.00018}
      shadow-normalBias={.035}
      shadow-radius={2.2}
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
    {LAMPS.slice(0, mobile ? 3 : LAMPS.length).map((lamp, index) => lamp.down
      ? <spotLight
        key={index}
        ref={(node) => { lamps.current[index] = node }}
        position={lamp.position}
        target-position={[lamp.position[0], lamp.position[1] - 1, lamp.position[2]]}
        color={lamp.color}
        intensity={lamp.intensity}
        distance={lamp.distance}
        angle={1.3}
        penumbra={.55}
        decay={2}
      />
      : <pointLight
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
