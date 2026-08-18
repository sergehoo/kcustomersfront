import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei'
import { Suspense, useState } from 'react'
import { CameraRig } from './CameraRig'
import { Debug3D } from './Debug3D'
import { ExteriorVilla } from './ExteriorVilla'
import { Lighting } from './Lighting'
import { DaylightSky } from './Sky'

export function Scene({ progress, mobile, debug3d }: { progress: number; mobile: boolean; debug3d: boolean }) {
  const [degraded, setDegraded] = useState(false)
  return <Suspense fallback={null}>
    <PerformanceMonitor onDecline={() => setDegraded(true)} />
    <AdaptiveDpr pixelated />
    {/* No `<color attach="background">`: a solid clear colour painted over the sky
        dome, which is why every exterior shot read as a flat blue card. */}
    <DaylightSky progress={progress} mobile={mobile} degraded={degraded} />
    <CameraRig progress={progress} mobile={mobile} />
    <Lighting progress={progress} mobile={mobile} />
    <ExteriorVilla mobile={mobile} />
    {debug3d && <Debug3D progress={progress} mobile={mobile} />}
  </Suspense>
}
