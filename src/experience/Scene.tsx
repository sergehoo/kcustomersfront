import { AdaptiveDpr, Environment, PerformanceMonitor, Sky } from '@react-three/drei'
import { Suspense, useState } from 'react'
import { CameraRig } from './CameraRig'
import { Debug3D } from './Debug3D'
import { ExteriorVilla } from './ExteriorVilla'
import { Lighting } from './Lighting'

export function Scene({ progress, mobile, debug3d }: { progress: number; mobile: boolean; debug3d: boolean }) {
  const [degraded, setDegraded] = useState(false)
  const exterior = progress < .15 || progress > .84
  return <Suspense fallback={null}>
    <PerformanceMonitor onDecline={() => setDegraded(true)} />
    <AdaptiveDpr pixelated />
    <color attach="background" args={[exterior ? '#8799a5' : '#a8b7bd']} />
    <fog attach="fog" args={[exterior ? '#8799a5' : '#a8b7bd', 48, 88]} />
    <Sky distance={450000} sunPosition={[-70, 16, 30]} turbidity={6.5} rayleigh={1.15} />
    <Environment files="/assets/hdr/blouberg-sunrise-1-1k.hdr" environmentIntensity={degraded ? .58 : .72} />
    <CameraRig progress={progress} mobile={mobile} />
    <Lighting progress={progress} mobile={mobile} />
    <ExteriorVilla mobile={mobile} />
    {debug3d && <Debug3D progress={progress} mobile={mobile} />}
  </Suspense>
}
