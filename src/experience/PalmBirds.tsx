import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  BoxGeometry, BufferAttribute, Color, ConeGeometry, DoubleSide, InstancedBufferAttribute, InstancedMesh, MathUtils, Matrix4,
  MeshStandardMaterial, PlaneGeometry, Quaternion, SphereGeometry, Vector3, type BufferGeometry,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { audio } from './audio/sound'
import { cameraStateAt } from './CameraPath'
import { insideAt } from './interior'

/**
 * A few birds on the palms of the entrance front.
 *
 * They sit on the fronds while the visit rests on its opening frame. The
 * moment the camera actually leaves that frame — the call to action or the
 * first scroll, it is the camera's own position that is watched — they take
 * off: one after the other within a third of a second, up and away from the
 * camera, each on its own heading, speed and climb, wings beating fast at
 * first and settling as they gain height. Sixty metres out they are a couple
 * of pixels and are let go.
 *
 * They are back on their fronds once the visit has been indoors: nobody sees
 * them return. One instanced mesh; the wings beat and fold in the vertex
 * shader, and five matrices are written per frame while they fly.
 */
type Bird = {
  perch: Vector3
  yaw: number
  /** Seconds after the first bird leaves. */
  delay: number
  /** Heading, in degrees off the palm's own way out (see `flight`). */
  spread: number
  speed: number
  climb: number
  weave: number
  size: number
}

const FLIGHTS: Omit<Bird, 'perch'>[] = [
  { yaw: .6, delay: 0, spread: 8, speed: 8.6, climb: 4.6, weave: .9, size: 1.2 },
  { yaw: 2.4, delay: .08, spread: -20, speed: 7.4, climb: 4.2, weave: 2.3, size: 1.12 },
  { yaw: 4.1, delay: .17, spread: 26, speed: 9.2, climb: 5.0, weave: 4.0, size: 1.25 },
  { yaw: 1.3, delay: .26, spread: 14, speed: 7.9, climb: 4.4, weave: 5.2, size: 1.15 },
  { yaw: 5.2, delay: .34, spread: -22, speed: 8.2, climb: 4.8, weave: 1.6, size: 1.2 },
]

const UP = new Vector3(0, 1, 0)
const ORIGIN = new Vector3()
const FORWARD = new Vector3(0, 0, 1)
/** The stair's axis: the palms stand either side of it, and their birds leave outwards. */
const AXIS_X = 4.225

/** One bird, facing +z: body, head, beak, tail and two wings that the shader moves. */
function birdGeometry() {
  const back = new Color('#3b3d42'), belly = new Color('#8f8c86'), dark = new Color('#26272a'), bill = new Color('#b98a3a')
  const parts: BufferGeometry[] = []
  const add = (geometry: BufferGeometry, colour: (y: number) => Color, wing?: (index: number) => [number, number]) => {
    const position = geometry.getAttribute('position')
    const colours = new Float32Array(position.count * 3)
    const wings = new Float32Array(position.count * 2)
    for (let i = 0; i < position.count; i += 1) {
      const c = colour(position.getY(i))
      colours.set([c.r, c.g, c.b], i * 3)
      if (wing) wings.set(wing(i), i * 2)
    }
    geometry.setAttribute('color', new BufferAttribute(colours, 3))
    geometry.setAttribute('wing', new BufferAttribute(wings, 2))
    parts.push(geometry)
  }
  // Dark back, paler underside.
  const shaded = (scale: number) => (y: number) => back.clone().lerp(belly, MathUtils.clamp(.5 - y / scale, 0, 1))
  add(new SphereGeometry(1, 12, 9).scale(.05, .055, .12), shaded(.07))
  add(new SphereGeometry(.036, 10, 8).translate(0, .034, .112), shaded(.06))
  add(new ConeGeometry(.011, .036, 6).rotateX(Math.PI / 2).translate(0, .03, .16), () => bill)
  add(new BoxGeometry(.055, .007, .11).translate(0, -.004, -.165), () => dark)
  for (const side of [1, -1]) {
    const wing = new PlaneGeometry(1, 1, 4, 1)
    const position = wing.getAttribute('position')
    const normal = wing.getAttribute('normal')
    const spans: number[] = []
    for (let i = 0; i < position.count; i += 1) {
      const t = position.getX(i) + .5
      const chord = .115 * (1 - t * .62)
      spans.push(t)
      position.setXYZ(i, side * (.035 + t * .27), .02, .03 - t * .07 + position.getY(i) * chord)
      normal.setXYZ(i, 0, 1, 0)
    }
    add(wing, () => dark.clone().lerp(back, .6), (index) => [side, spans[index]])
  }
  const geometry = mergeGeometries(parts)
  parts.forEach((part) => part.dispose())
  return geometry
}

function birdMaterial() {
  const material = new MeshStandardMaterial({ name: 'KD_PALM_BIRD', vertexColors: true, roughness: .82, metalness: 0, side: DoubleSide, envMapIntensity: .7 })
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = `attribute vec2 wing;\nattribute vec2 pose;\n${shader.vertexShader}`.replace('#include <begin_vertex>', /* glsl */`
      vec3 transformed = vec3(position);
      if (wing.x != 0.0) {
        // Open: the wing turns about the body's long axis, the hand further than the arm.
        vec3 kdShoulder = vec3(wing.x * .035, .02, position.z);
        vec3 kdArm = position - kdShoulder;
        float kdAngle = pose.x * (.4 + .6 * wing.y) * wing.x;
        float kdC = cos(kdAngle), kdS = sin(kdAngle);
        vec3 kdOpen = kdShoulder + vec3(kdArm.x * kdC - kdArm.y * kdS, kdArm.x * kdS + kdArm.y * kdC, kdArm.z);
        // Folded: laid back along the flank, tips crossing over the tail.
        vec3 kdFolded = vec3(wing.x * (.047 - wing.y * .016), .027 - wing.y * .03, .045 - wing.y * .2 + (position.z - .03 + wing.y * .07) * .3);
        transformed = mix(kdOpen, kdFolded, pose.y);
      }`)
  }
  material.customProgramCacheKey = () => 'kd-palm-bird'
  return material
}

export function PalmBirds({ perches, mobile, progress, visible }: { perches: Vector3[]; mobile: boolean; progress: number; visible: boolean }) {
  const birds = useMemo<Bird[]>(() => perches.slice(0, FLIGHTS.length).map((perch, index) => ({ perch, ...FLIGHTS[index] })), [perches])

  const mesh = useMemo(() => {
    const geometry = birdGeometry()
    geometry.setAttribute('pose', new InstancedBufferAttribute(new Float32Array(birds.length * 2).fill(0), 2))
    const instanced = new InstancedMesh(geometry, birdMaterial(), birds.length)
    instanced.name = 'KD palm birds'
    instanced.frustumCulled = false
    instanced.castShadow = false
    instanced.receiveShadow = false
    return instanced
  }, [birds])
  useEffect(() => () => { mesh.geometry.dispose(); (mesh.material as MeshStandardMaterial).dispose() }, [mesh])

  /** The camera of the opening frame: leaving it is what sends the birds off. */
  const home = useMemo(() => {
    const position = new Vector3()
    cameraStateAt(0, position, new Vector3(), mobile)
    return position
  }, [mobile])

  const state = useRef({ status: 'perched' as 'perched' | 'fleeing' | 'gone', armed: false, launched: 0, away: new Vector3(), phases: birds.map(() => 0) })
  const scratch = useMemo(() => ({ matrix: new Matrix4(), position: new Vector3(), next: new Vector3(), heading: new Vector3(), side: new Vector3(), look: new Matrix4(), turn: new Quaternion(), tilt: new Quaternion(), scale: new Vector3() }), [])

  useFrame(({ camera, clock }, delta) => {
    const s = state.current
    const now = clock.elapsedTime
    const offset = camera.position.distanceTo(home)
    const pose = mesh.geometry.getAttribute('pose') as InstancedBufferAttribute

    if (s.status === 'perched') {
      // Armed once the camera has come to rest on the opening frame; a visit
      // that only passes near it (the garden shots) does not flush them.
      if (offset < .05) s.armed = true
      else if (s.armed && offset > .2) {
        s.status = 'fleeing'
        s.armed = false
        s.launched = now
        s.away.subVectors(birds[0].perch, camera.position).setY(0).normalize()
        audio.flutter()
      }
    } else if (s.status === 'gone' && insideAt(progress) > .9) {
      // Out of sight, indoors: they have come back by the time the garden is seen again.
      s.status = 'perched'
    }

    /** Where bird `index` is, `t` seconds after it left its frond. */
    const flight = (bird: Bird, t: number, out: Vector3) => {
      // Out to the side of their own palm and a little away from the camera,
      // climbing hard: straight away from the lens would take them through
      // the upper floor, which stands six metres behind the palms.
      scratch.heading.set(Math.sign(bird.perch.x - AXIS_X) * .9, 0, 0).addScaledVector(s.away, .38).normalize()
        .applyAxisAngle(UP, MathUtils.degToRad(bird.spread))
      scratch.side.set(-scratch.heading.z, 0, scratch.heading.x)
      const run = bird.speed * (t - .45 * (1 - Math.exp(-t / .45)))
      const rise = bird.climb * (t - .3 * (1 - Math.exp(-t / .3))) + .55 * (1 - Math.exp(-t / .15))
      const drift = Math.sin(t * 2.1 + bird.weave) * .55 * Math.min(1, t)
      return out.copy(bird.perch).addScaledVector(scratch.heading, run).addScaledVector(UP, rise).addScaledVector(scratch.side, drift)
    }

    let farthest = 0
    birds.forEach((bird, index) => {
      const t = s.status === 'fleeing' ? now - s.launched - bird.delay : -1
      let fold = 1
      let beat = 0
      let size = bird.size
      if (s.status === 'gone') size = 0
      else if (t <= 0) {
        // On the frond: head up, a slow look around, the faintest bob.
        const look = bird.yaw + Math.sin(now * .6 + index * 2.1) * .14 + (t > -.4 && s.status === 'fleeing' ? .3 : 0)
        scratch.position.copy(bird.perch).addScaledVector(UP, .05 + Math.sin(now * 1.9 + index) * .003)
        scratch.turn.setFromAxisAngle(UP, look)
        scratch.tilt.setFromAxisAngle(scratch.side.set(1, 0, 0), -.32)
        scratch.turn.multiply(scratch.tilt)
      } else {
        flight(bird, t, scratch.position)
        flight(bird, t + .05, scratch.next)
        scratch.heading.subVectors(scratch.next, scratch.position).normalize()
        scratch.turn.setFromRotationMatrix(scratch.look.lookAt(scratch.heading, ORIGIN, UP))
        // Leaning into the weave.
        scratch.tilt.setFromAxisAngle(FORWARD, Math.cos(t * 2.1 + bird.weave) * .28 * Math.min(1, t))
        scratch.turn.multiply(scratch.tilt)
        // Eleven beats a second off the frond, six and a half once it is flying.
        const settle = 1 - Math.exp(-t / 1.2)
        s.phases[index] += delta * Math.PI * 2 * (11 - 4.5 * settle)
        beat = Math.sin(s.phases[index]) * (1.05 - .3 * settle) + .18
        fold = Math.max(0, 1 - t / .12)
        const distance = scratch.position.distanceTo(bird.perch)
        size *= 1 - MathUtils.smoothstep(distance, 48, 64)
        farthest = Math.max(farthest, t > 0 ? distance : 0)
      }
      scratch.matrix.compose(scratch.position, scratch.turn, scratch.scale.setScalar(size))
      mesh.setMatrixAt(index, scratch.matrix)
      pose.setXY(index, beat, fold)
    })
    mesh.instanceMatrix.needsUpdate = true
    pose.needsUpdate = true
    if (s.status === 'fleeing' && farthest > 64 && birds.every((bird) => flight(bird, now - s.launched - bird.delay, scratch.next).distanceTo(bird.perch) > 64)) s.status = 'gone'
  })

  return <primitive object={mesh} visible={visible} />
}
