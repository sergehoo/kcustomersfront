import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { MathUtils, PerspectiveCamera, Raycaster, Vector2, Vector3 } from 'three'
import { cameraStateAt } from './CameraPath'

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

export function CameraRig({ progress, mobile, exposure = 1 }: { progress: number; mobile: boolean; exposure?: number }) {
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
    ;(window as unknown as Record<string, unknown>).__probeAt = (nx: number, ny: number) => {
      raycaster.setFromCamera(new Vector2(nx, ny), camera)
      const hit = raycaster.intersectObjects(scene.children, true)
        .find((item) => (item.object as { visible?: boolean }).visible !== false)
      if (!hit) return null
      const material = (hit.object as unknown as { material?: { name?: string } | { name?: string }[] }).material
      const name = Array.isArray(material) ? material[0]?.name : material?.name
      return {
        object: hit.object.name,
        material: name ?? null,
        point: [+hit.point.x.toFixed(2), +hit.point.y.toFixed(2), +hit.point.z.toFixed(2)],
        distance: +hit.distance.toFixed(2),
      }
    }
  }

  useFrame(({ clock }, delta) => {
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__gl = gl
    const step = Math.min(delta, 1 / 30)
    let destinationFov: number

    const override = readOverride?.()
    if (override) {
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
      camera.position.lerp(destination, 1 - Math.exp(-step * 3.1))
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

    // Interiors are lit by the sky through the openings only, so they need about
    // a third of a stop more than the open hillside — as a photographer would.
    const inside = MathUtils.smoothstep(progress, .25, .32) * (1 - MathUtils.smoothstep(progress, .7, .77))
    const targetExposure = (1 + inside * .38) * exposure
    gl.toneMappingExposure = MathUtils.lerp(gl.toneMappingExposure, targetExposure, 1 - Math.exp(-step * 1.8))
  })

  return null
}
