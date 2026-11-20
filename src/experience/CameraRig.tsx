import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { MathUtils, PerspectiveCamera, Raycaster, Vector2, Vector3 } from 'three'
import { cameraStateAt } from './CameraPath'
import { insideAt } from './interior'

type CameraOverride = { position: Vector3; target: Vector3; fov: number }

function parseOverride(raw: string | null): CameraOverride | null {
  if (!raw) return null
  const values = raw.split(',').map(Number)
  if (values.length < 6 || values.some((value) => !Number.isFinite(value))) return null
  return {
    position: new Vector3(values[0], values[1], values[2]),
    target: new Vector3(values[3], values[4], values[5]),
    fov: values[6] ?? 50,
  }
}

/**
 * Dev-only framing probe. `?cam=x,y,z,tx,ty,tz[,fov]` pins the camera at load,
 * and `window.__setCam('x,y,z,tx,ty,tz,fov')` re-aims it without a reload so a
 * candidate keyframe can be rendered and inspected immediately.
 */
let liveOverride: CameraOverride | null = null
let snapRequested = false

function readCameraOverride() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null
  liveOverride = parseOverride(new URLSearchParams(window.location.search).get('cam'))
  const scope = window as typeof window & {
    __setCam?: (value: string | null) => string
    __snapCam?: () => string
  }
  scope.__setCam = (value) => {
    liveOverride = parseOverride(value)
    return liveOverride ? 'pinned' : 'released'
  }
  // Skips the damping for one frame so a QA scan reads the true keyframe framing.
  scope.__snapCam = () => { snapRequested = true; return 'snap' }
  return () => liveOverride
}

// Indoors the exposure eases to the ambience's interior value. It used to add
// a third of a stop on top of an interior already lit by the full sky probe,
// the floor bounce and the lamps: walls, bedding and marble burnt to a flat cream.
function exposureAt(progress: number, exposure: number, interior: number) {
  return MathUtils.lerp(1, interior, insideAt(progress)) * exposure
}

export function CameraRig({ progress, mobile, exposure = 1, interiorExposure = 1 }: { progress: number; mobile: boolean; exposure?: number; interiorExposure?: number }) {
  const { camera, pointer, gl, scene } = useThree()
  const raycaster = useMemo(() => new Raycaster(), [])
  const destination = useMemo(() => new Vector3(), [])
  const target = useMemo(() => new Vector3(), [])
  const readOverride = useMemo(readCameraOverride, [])
  const lookCamera = useRef(new PerspectiveCamera())
  const settled = useRef(false)

  if (import.meta.env.DEV && typeof window !== 'undefined') {
    /**
     * Screen-space ground probe. Placing landscaping from estimated world
     * coordinates and checking the render afterwards kept missing the patches
     * that actually show; this shoots a ray through a normalised screen point and
     * reports what is there, so planting can be aimed at the pixels that are bare.
     */
    ;(window as unknown as Record<string, unknown>).__probeAt = (nx: number, ny: number, depth = 1) => {
      raycaster.setFromCamera(new Vector2(nx, ny), camera)
      const hits = raycaster.intersectObjects(scene.children, true)
        .filter((item) => (item.object as { visible?: boolean }).visible !== false)
        .slice(0, depth)
        .map((hit) => {
          const material = (hit.object as unknown as { material?: { name?: string } | { name?: string }[] }).material
          const name = Array.isArray(material) ? material[0]?.name : material?.name
          return {
            object: hit.object.name,
            material: name ?? null,
            point: [+hit.point.x.toFixed(2), +hit.point.y.toFixed(2), +hit.point.z.toFixed(2)],
            distance: +hit.distance.toFixed(2),
          }
        })
      // One hit by default; `depth` > 1 lists what lies behind (through glazing).
      return depth > 1 ? hits : hits[0] ?? null
    }
  }

  useFrame(({ clock }, delta) => {
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__gl = gl
    const step = Math.min(delta, 1 / 30)
    let destinationFov: number

    const override = readOverride?.()
    if (override) {
      // A pinned QA frame is read at the exposure the visit would have settled on.
      gl.toneMappingExposure = exposureAt(progress, exposure, interiorExposure)
      destination.copy(override.position)
      target.copy(override.target)
      destinationFov = override.fov
      camera.position.copy(destination)
      lookCamera.current.position.copy(destination)
      lookCamera.current.up.copy(camera.up)
      lookCamera.current.lookAt(target)
      camera.quaternion.copy(lookCamera.current.quaternion)
      if (camera instanceof PerspectiveCamera && camera.fov !== destinationFov) {
        camera.fov = destinationFov
        camera.updateProjectionMatrix()
      }
      return
    }
    {
      const clamped = MathUtils.clamp(progress, 0, 1)
      destinationFov = cameraStateAt(clamped, destination, target, mobile)
      // A slow figure-of-eight sway keeps the frame alive without reading as drift.
      target.x += Math.sin(clock.elapsedTime * .27) * .018 + pointer.x * (mobile ? .05 : .11)
      target.y += Math.sin(clock.elapsedTime * .41) * .012 + pointer.y * (mobile ? .03 : .055)
    }

    if (!settled.current || snapRequested) {
      // Land on the first frame instead of flying in from the default camera position.
      camera.position.copy(destination)
      settled.current = true
    } else {
      // Tight enough to stay on the validated path through doorways and up the
      // stair: a loose lag cut the corners of the path into the walls.
      camera.position.lerp(destination, 1 - Math.exp(-step * 7))
    }

    lookCamera.current.position.copy(camera.position)
    lookCamera.current.up.copy(camera.up)
    lookCamera.current.lookAt(target)
    if (snapRequested) camera.quaternion.copy(lookCamera.current.quaternion)
    else camera.quaternion.slerp(lookCamera.current.quaternion, 1 - Math.exp(-step * 3.6))
    snapRequested = false

    if (camera instanceof PerspectiveCamera) {
      const nextFov = snapRequested ? destinationFov : MathUtils.lerp(camera.fov, destinationFov, 1 - Math.exp(-step * 2.4))
      if (Math.abs(nextFov - camera.fov) > .002) {
        camera.fov = nextFov
        camera.updateProjectionMatrix()
      }
    }

    gl.toneMappingExposure = MathUtils.lerp(gl.toneMappingExposure, exposureAt(progress, exposure, interiorExposure), 1 - Math.exp(-step * 1.8))
  })

  return null
}
