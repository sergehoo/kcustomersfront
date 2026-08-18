import { Html, Line } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { Vector3 } from 'three'
import { CAMERA_POSITION_PATH, CAMERA_TARGET_PATH, cameraStateAt } from './CameraPath'
import { sectionAt } from './sections'

export function Debug3D({ progress, mobile }: { progress: number; mobile: boolean }) {
  const { camera } = useThree()
  const target = useMemo(() => new Vector3(), [])
  const unusedPosition = useMemo(() => new Vector3(), [])
  const elapsed = useRef(0)
  const smoothedFps = useRef(60)
  const [telemetry, setTelemetry] = useState({ position: '0, 0, 0', target: '0, 0, 0', fps: 60 })

  useFrame((_, delta) => {
    smoothedFps.current += ((1 / Math.max(delta, .001)) - smoothedFps.current) * .08
    elapsed.current += delta
    if (elapsed.current < .25) return
    elapsed.current = 0
    cameraStateAt(progress, unusedPosition, target, mobile)
    const print = (value: Vector3) => value.toArray().map((item) => item.toFixed(2)).join(', ')
    setTelemetry({ position: print(camera.position), target: print(target), fps: Math.round(smoothedFps.current) })
  })

  return <>
    <Line points={CAMERA_POSITION_PATH.getPoints(180)} color="#ffb347" lineWidth={2} depthTest={false} />
    <Line points={CAMERA_TARGET_PATH.getPoints(180)} color="#6ee7ff" lineWidth={1} depthTest={false} dashed dashSize={.12} gapSize={.08} />
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <output className="debug3d-panel">
        <b>DEBUG 3D</b>
        <span>progress {(progress * 100).toFixed(1)}%</span>
        <span>chapter {sectionAt(progress).label}</span>
        <span>camera {telemetry.position}</span>
        <span>target {telemetry.target}</span>
        <span>{telemetry.fps} FPS · {mobile ? 'mobile' : 'desktop'}</span>
      </output>
    </Html>
  </>
}

