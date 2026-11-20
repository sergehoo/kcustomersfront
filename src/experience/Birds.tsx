import { useFrame, useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import { BufferAttribute, Color, DoubleSide, InstancedBufferAttribute, InstancedBufferGeometry, ShaderMaterial, Vector3 } from 'three'
import type { Fog } from 'three'
import type { Ambience } from './ambience'

/**
 * A few birds over the hillside, by day.
 *
 * An empty sky is the last thing that tells a render from a photograph. Nine
 * birds in all — two loose groups and two stragglers — wheel slowly around
 * the villa a little over a hundred metres out, so that most exterior views
 * catch three or four of them for a while and none has a flock crossing it.
 * At that distance each is fifteen pixels or so: wings that beat a few times,
 * then hold a glide. (At two hundred metres they were four pixels: there, but
 * nobody would have seen them.)
 *
 * One draw call. Path, heading and wing beat are computed in the vertex
 * shader from per-bird attributes; nothing is updated on the CPU but a clock.
 */
type Bird = { radius: number; height: number; phase: number; speed: number; span: number; beat: number }

/** Centre of the villa: the birds circle it, the camera never leaves its plot. */
const CENTRE = new Vector3(0, 0, 14)
/** Flattening of the circle the birds fly, north–south. */
const OVAL = .8

const flock = (count: number, radius: number, height: number, phase: number, speed: number, seed: number): Bird[] =>
  Array.from({ length: count }, (_, index) => {
    const a = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453
    const b = Math.sin(seed * 39.3468 + index * 11.135) * 24634.6345
    const r1 = a - Math.floor(a), r2 = b - Math.floor(b)
    return {
      radius: radius + (r1 - .5) * 34,
      height: height + (r2 - .5) * 12,
      // Strung out along the path, never abreast like a formation.
      phase: phase + index * .085 + (r2 - .5) * .06,
      speed: speed * (.94 + r1 * .12),
      span: 2.0 + r2 * .6,
      beat: 6.2 + r1 * 1.6,
    }
  })

export const BIRDS: Bird[] = [
  ...flock(4, 122, 46, .4, .058, 1),
  ...flock(3, 150, 58, 3.5, .05, 2),
  ...flock(1, 235, 82, 1.9, -.03, 3),
  ...flock(1, 210, 70, 5.2, -.034, 4),
]

/**
 * Where a bird is at a given time — the same path the vertex shader flies it
 * on, for whatever needs to know without reading the GPU (the sound design
 * lets a bird that crosses the frame be heard).
 */
export function birdPosition(bird: Bird, time: number, out: Vector3) {
  const angle = bird.phase + time * bird.speed
  return out.set(
    CENTRE.x + Math.cos(angle) * bird.radius,
    CENTRE.y + bird.height + Math.sin(time * .21 + bird.phase * 3) * 4,
    CENTRE.z + Math.sin(angle) * OVAL * bird.radius,
  )
}

function makeBirds() {
  // One bird, facing +z, wings along x; `span` is 1 from tip to tip.
  const positions = new Float32Array([
    // body
    0, 0, .2, .028, 0, 0, -.028, 0, 0,
    .028, 0, 0, 0, 0, -.24, -.028, 0, 0,
    // right wing: arm, then hand swept back to the tip
    .02, 0, .09, .25, 0, .05, .02, 0, -.07,
    .25, 0, .05, .24, 0, -.06, .02, 0, -.07,
    .25, 0, .05, .5, 0, -.09, .24, 0, -.06,
    // left wing
    -.02, 0, .09, -.02, 0, -.07, -.25, 0, .05,
    -.25, 0, .05, -.02, 0, -.07, -.24, 0, -.06,
    -.25, 0, .05, -.24, 0, -.06, -.5, 0, -.09,
  ])
  const geometry = new InstancedBufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('path', new InstancedBufferAttribute(new Float32Array(BIRDS.flatMap((bird) => [bird.radius, bird.height, bird.phase, bird.speed])), 4))
  geometry.setAttribute('trait', new InstancedBufferAttribute(new Float32Array(BIRDS.flatMap((bird) => [bird.span, bird.beat])), 2))
  geometry.instanceCount = BIRDS.length

  const material = new ShaderMaterial({
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
    uniforms: {
      time: { value: 0 },
      centre: { value: CENTRE },
      // Look-dev only: turns every bird round its path to bring them into a frame.
      turn: { value: 0 },
      tint: { value: new Color('#2a2724') },
      haze: { value: new Color('#c4ccd3') },
      strength: { value: 1 },
    },
    vertexShader: /* glsl */`
      attribute vec4 path;
      attribute vec2 trait;
      uniform float time;
      uniform vec3 centre;
      uniform float turn;
      varying float vDistance;
      void main() {
        float angle = path.z + turn + time * path.w;
        vec2 ring = vec2(cos(angle), sin(angle) * .8) * path.x;
        vec3 at = centre + vec3(ring.x, path.y + sin(time * .21 + path.z * 3.0) * 4.0, ring.y);
        vec2 heading = normalize(vec2(-sin(angle), cos(angle) * .8)) * sign(path.w);
        vec3 forward = vec3(heading.x, 0.0, heading.y);
        vec3 right = vec3(forward.z, 0.0, -forward.x);
        // A few beats, then a glide with the wings held just above level.
        float beat = time * trait.y + path.z * 7.0;
        float flapping = smoothstep(.2, .65, .5 + .5 * sin(beat * .11 + path.z * 1.7));
        float lift = sin(beat) * .5 * flapping + .14;
        vec3 p = position;
        float span = abs(p.x) * 2.0;
        // The hand lags the arm: the wing bends, it does not hinge like a board.
        p.y += span * lift * .5 - span * span * sin(beat - .9) * .12 * flapping;
        p *= trait.x;
        vec3 world = at + right * p.x + vec3(0.0, p.y, 0.0) + forward * p.z;
        vec4 view = viewMatrix * vec4(world, 1.0);
        vDistance = -view.z;
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 tint;
      uniform vec3 haze;
      uniform float strength;
      varying float vDistance;
      void main() {
        // The same aerial perspective as the hills they fly over.
        float far = smoothstep(70.0, 1150.0, vDistance);
        gl_FragColor = vec4(mix(tint, haze, far * .9), strength * (1.0 - far * .5));
      }
    `,
  })
  return { geometry, material }
}

export function Birds({ ambience }: { ambience: Ambience }) {
  const scene = useThree((state) => state.scene)
  const { geometry, material } = useMemo(makeBirds, [])

  useFrame((state) => {
    material.uniforms.time.value = state.clock.elapsedTime
    const fog = scene.fog as Fog | null
    if (fog) material.uniforms.haze.value.copy(fog.color)
  })

  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__birds = material.uniforms

  // Day only: at blue hour the sky is left to its own gradient.
  return <mesh geometry={geometry} material={material} visible={ambience.daySky} frustumCulled={false} renderOrder={-5} name="KD birds" />
}
