import { Environment, useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo } from 'react'
import { BackSide, Color, EquirectangularReflectionMapping, MathUtils, ShaderMaterial, SRGBColorSpace, Vector3 } from 'three'
import type { Fog, Texture } from 'three'
import type { Ambience } from './ambience'
import { TOUR_MARKS, TOUR_STOPS } from './tour'

/**
 * Photographic sky, split in two on purpose:
 *
 * - lighting comes from the Poly Haven "kloofendal 38d" pure sky with its solar
 *   disc clamped out (`npm run prepare:sky`). The sun itself is the shadow-casting
 *   key light in `Lighting.tsx`; leaving it in the probe as well lit every room
 *   from the sun's direction straight through the walls;
 * - what the camera sees is the same sky as a 4K photograph, so clouds and
 *   horizon stay sharp instead of a blurred 1K probe.
 *
 * Both are rotated together across the visit so each room gets a sun that
 * models its main façade: raking across the entrance front on arrival, round to
 * the south terrace at the end.
 */
const SKY_LIGHTING = '/assets/hdr/kloofendal-38d-sunless-1k.hdr'
const SKY_BACKGROUND = { desktop: '/assets/hdr/kloofendal-38d-sky-4k.webp', mobile: '/assets/hdr/kloofendal-38d-sky-2k.webp' }

/** Sun azimuth inside the HDRI, in Three's equirect convention (`scripts/prepareSky.mjs`; elevation .66 rad). */
const SUN_AZIMUTH_LOCAL = .6289

type SkyStop = {
  at: number
  /** World azimuth the sun comes from: atan2(z, x), in degrees. */
  sunAzimuth: number
  /**
   * Elevation of the key light, in degrees. The solar disc is never in frame,
   * so the shadow-casting sun can sit lower than the probe's 38° where a longer
   * light sells the space better — notably indoors, where a 38° sun stops at
   * the edge of the terrace overhang and never reaches a floor.
   */
  sunElevation: number
  skyIntensity: number
  envIntensity: number
  fog: string
}

/**
 * 105° puts the sun behind the hero camera's left shoulder: the entrance front
 * is lit, the east flank falls into shadow, and every step and ledge throws a
 * shadow towards the lens. Around −76° it stands over the pool, lighting the
 * south terrace and reaching into the rooms through the south glazing.
 */
/**
 * The garden shots look back at the entrance front from the north-west. With
 * the sun left over the pool, that front was a flat grey wall under a bright
 * sky. The sun comes back round to the entrance side while the camera walks
 * from the pool to the garden, and returns south for the closing aerial.
 */
const GARDEN = (() => {
  const shots = TOUR_STOPS.filter((stop) => stop.room === 'garden' && stop.shot !== null)
  const first = TOUR_STOPS.indexOf(TOUR_STOPS.find((stop) => stop.room === 'garden')!)
  const closing = TOUR_STOPS.find((stop) => stop.room === 'finale' && stop.shot !== null)!
  return { from: TOUR_STOPS[first - 1].leave, arrive: shots[0].arrive, leave: shots[shots.length - 1].leave, closing: closing.arrive }
})()

const STOPS: SkyStop[] = [
  { at: 0, sunAzimuth: 105, sunElevation: 33, skyIntensity: 1, envIntensity: .72, fog: '#c4ccd3' },
  { at: TOUR_MARKS.enter[0], sunAzimuth: 100, sunElevation: 33, skyIntensity: 1, envIntensity: .72, fog: '#c4ccd3' },
  // Swung round while the camera goes through the front door, so that indoors a
  // low afternoon sun comes through the south bay and lays real patches on the floors.
  // The probe has no notion of walls: indoors it lit every surface as if under
  // the open sky, which flattened the rooms. Turned down, the sun patches and
  // the openings model the space again.
  { at: TOUR_MARKS.enter[1], sunAzimuth: -76, sunElevation: 17, skyIntensity: 1, envIntensity: .55, fog: '#c4ccd3' },
  { at: TOUR_MARKS.exit[0], sunAzimuth: -80, sunElevation: 17, skyIntensity: 1, envIntensity: .55, fog: '#c7cdd2' },
  { at: TOUR_MARKS.exit[1], sunAzimuth: -70, sunElevation: 26, skyIntensity: 1, envIntensity: .72, fog: '#c9cdd0' },
  { at: GARDEN.from, sunAzimuth: -70, sunElevation: 26, skyIntensity: 1, envIntensity: .72, fog: '#c9cdd0' },
  { at: GARDEN.arrive, sunAzimuth: 110, sunElevation: 31, skyIntensity: 1, envIntensity: .76, fog: '#c6ccd2' },
  { at: GARDEN.leave, sunAzimuth: 110, sunElevation: 31, skyIntensity: 1, envIntensity: .76, fog: '#c6ccd2' },
  { at: GARDEN.closing, sunAzimuth: -72, sunElevation: 24, skyIntensity: 1, envIntensity: .72, fog: '#cbcdcd' },
  { at: 1, sunAzimuth: -72, sunElevation: 24, skyIntensity: 1, envIntensity: .72, fog: '#cbcdcd' },
]

function stopAt(progress: number) {
  let index = 0
  while (index < STOPS.length - 2 && progress > STOPS[index + 1].at) index += 1
  const from = STOPS[index]
  const to = STOPS[index + 1]
  const t = MathUtils.smoothstep(MathUtils.clamp((progress - from.at) / Math.max(1e-6, to.at - from.at), 0, 1), 0, 1)
  const azimuth = MathUtils.degToRad(MathUtils.lerp(from.sunAzimuth, to.sunAzimuth, t))
  return {
    azimuth,
    elevation: MathUtils.degToRad(MathUtils.lerp(from.sunElevation, to.sunElevation, t)),
    // world = R_y(θ) · local  ⇒  azimuth_world = azimuth_local − θ
    rotation: SUN_AZIMUTH_LOCAL - azimuth,
    skyIntensity: MathUtils.lerp(from.skyIntensity, to.skyIntensity, t),
    envIntensity: MathUtils.lerp(from.envIntensity, to.envIntensity, t),
    fog: new Color(from.fog).lerp(new Color(to.fog), t),
  }
}

/** Direction *towards* the sun, shared with the key light so shadows match the sky. */
export function sunVectorAt(progress: number, out = new Vector3()) {
  const { azimuth, elevation } = stopAt(progress)
  const flat = Math.cos(elevation)
  return out.set(Math.cos(azimuth) * flat, Math.sin(elevation), Math.sin(azimuth) * flat)
}

/**
 * Blue hour, as in premium night photography of a villa: a deep cobalt zenith
 * falling to a lighter band on the horizon, with the day sky's own clouds
 * re-read as soft dark-blue shapes so the dome never looks like a flat fill.
 * Not a black night sky: architecture photographers shoot the 20 minutes when
 * the sky still separates the roofline from the background.
 */
function makeNightDome(clouds: Texture) {
  return new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      clouds: { value: clouds },
      rotation: { value: 0 },
      zenith: { value: new Color('#0a2784') },
      mid: { value: new Color('#1443b4') },
      horizon: { value: new Color('#3d6ec6') },
      glow: { value: new Color('#7aa0d8') },
    },
    vertexShader: /* glsl */`
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w;
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D clouds;
      uniform float rotation;
      uniform vec3 zenith;
      uniform vec3 mid;
      uniform vec3 horizon;
      uniform vec3 glow;
      varying vec3 vDirection;
      void main() {
        vec3 d = normalize(vDirection);
        float c = cos(rotation), s = sin(rotation);
        vec3 r = vec3(c * d.x + s * d.z, d.y, -s * d.x + c * d.z);
        float h = clamp(d.y, -1.0, 1.0);
        vec3 sky = mix(horizon, mid, smoothstep(0.0, .22, h));
        sky = mix(sky, zenith, smoothstep(.22, .85, h));
        sky += glow * pow(1.0 - abs(h), 14.0) * .35;
        vec2 uv = vec2(atan(r.z, r.x) * .1591549 + .5, asin(clamp(r.y, -1.0, 1.0)) * .3183099 + .5);
        float cloud = dot(texture2D(clouds, uv).rgb, vec3(.2126, .7152, .0722));
        float mask = smoothstep(.45, .95, cloud) * smoothstep(.02, .18, h);
        sky = mix(sky, sky * .55 + vec3(.012, .02, .045), mask * .75);
        // Below the horizon the sea takes over; keep the dome dark there.
        sky = mix(sky, mid * .35, smoothstep(0.0, -.08, h));
        gl_FragColor = vec4(sky * .85, 1.0);
      }
    `,
  })
}

export function DaylightSky({ progress, mobile, degraded, ambience }: { progress: number; mobile: boolean; degraded: boolean; ambience: Ambience }) {
  const scene = useThree((state) => state.scene)
  const background = useTexture(mobile ? SKY_BACKGROUND.mobile : SKY_BACKGROUND.desktop)
  const nightDome = useMemo(() => makeNightDome(background), [background])
  const day = ambience.daySky

  useLayoutEffect(() => {
    background.mapping = EquirectangularReflectionMapping
    background.colorSpace = SRGBColorSpace
    background.needsUpdate = true
    const previous = scene.background
    scene.background = day ? background : new Color('#03091d')
    return () => { scene.background = previous }
  }, [background, scene, day])

  useFrame(() => {
    const stop = stopAt(progress)
    scene.backgroundIntensity = stop.skyIntensity
    scene.environmentIntensity = stop.envIntensity * ambience.environment * (degraded ? .9 : 1)
    scene.backgroundRotation.y = stop.rotation
    scene.environmentRotation.y = stop.rotation
    nightDome.uniforms.rotation.value = stop.rotation
    const fog = scene.fog as Fog | null
    if (fog) {
      if (day) fog.color.copy(stop.fog)
      else fog.color.set('#0a1838').multiplyScalar(.22)
    }
  })

  return <>
    {/* Aerial perspective: nothing on the plot (under 70 m), a third of the
        way to the sky colour on the hills across the valley, the horizon
        dissolved. It is what sets the villa in front of its landscape. */}
    <fog attach="fog" args={['#c4ccd3', 70, 1150]} />
    <Environment files={SKY_LIGHTING} />
    <mesh material={nightDome} visible={!day} renderOrder={-10} frustumCulled={false} name="KD night dome">
      <sphereGeometry args={[2000, 48, 24]} />
    </mesh>
  </>
}
