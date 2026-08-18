import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { MathUtils, PerspectiveCamera, Vector3 } from 'three'
import { cameraStateAt } from './CameraPath'

export function CameraRig({ progress, mobile }: { progress: number; mobile: boolean }) {
  const { camera, pointer, gl } = useThree()
  const destination = useMemo(() => new Vector3(), [])
  const target = useMemo(() => new Vector3(), [])
  const lookCamera = useRef(new PerspectiveCamera())

  useFrame(({ clock }, delta) => {
    const cinematicProgress = Math.min(1, Math.max(0, progress))
    const destinationFov = cameraStateAt(cinematicProgress, destination, target, mobile)
    const sway = Math.sin(clock.elapsedTime * .48) * .012
    target.x += pointer.x * (mobile ? .06 : .13)
    target.y += pointer.y * (mobile ? .035 : .065) + sway
    const positionDamping = 1 - Math.exp(-delta * 2.05)
    camera.position.lerp(destination, positionDamping)
    lookCamera.current.position.copy(camera.position)
    lookCamera.current.up.copy(camera.up)
    lookCamera.current.lookAt(target)
    camera.quaternion.slerp(lookCamera.current.quaternion, 1 - Math.exp(-delta * 2.7))
    if (camera instanceof PerspectiveCamera) {
      const nextFov = MathUtils.lerp(camera.fov, destinationFov, 1 - Math.exp(-delta * 2.1))
      if (Math.abs(nextFov - camera.fov) > .001) { camera.fov = nextFov; camera.updateProjectionMatrix() }
    }
    const interior = MathUtils.smoothstep(cinematicProgress, .12, .3) * (1 - MathUtils.smoothstep(cinematicProgress, .8, .96))
    gl.toneMappingExposure = MathUtils.lerp(gl.toneMappingExposure, .79 + interior * .16, 1 - Math.exp(-delta * 1.8))
  })
  return null
}
