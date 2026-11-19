import { PerformanceMonitor } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Suspense, useEffect, useState } from 'react'
import { HalfFloatType, WebGLRenderTarget } from 'three'
import { CameraRig } from './CameraRig'
import { Debug3D } from './Debug3D'
import { ExteriorVilla, villaModel } from './ExteriorVilla'
import { Lighting } from './Lighting'
import { PostEffects } from './PostEffects'
import { DaylightSky } from './Sky'
import { Surroundings } from './Surroundings'
import { Garden } from './Garden'
import { NightLights } from './NightLights'
import type { Ambience } from './ambience'

/**
 * Rendered last inside the Suspense boundary, so it mounts only once every
 * asset is in. Compiling all programs here, behind the loader, is what stops
 * the hero from stuttering for seconds while ~100 shaders build on screen.
 */
function Warmup({ onReady }: { onReady: () => void }) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    let cancelled = false
    // A frame later, so meshes a component attaches in a follow-up render
    // (the stair's riser glow) are in the scene too.
    const frame = requestAnimationFrame(() => {
      // Frames are drawn into the composer's linear buffer, not the canvas.
      // Compiling against the canvas built every program for sRGB output, so
      // each was built again on first use — and the night-only materials,
      // hidden by day, on the first switch to night.
      const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType })
      const previous = gl.getRenderTarget()
      gl.setRenderTarget(target)
      const compiling = gl.compileAsync(scene, camera)
      gl.setRenderTarget(previous)
      compiling.catch(() => undefined).then(() => {
        target.dispose()
        if (!cancelled) onReady()
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [gl, scene, camera, onReady])
  return null
}

export function Scene({ progress, mobile, debug3d, onReady, ambience }: { progress: number; mobile: boolean; debug3d: boolean; onReady: () => void; ambience: Ambience }) {
  const [degraded, setDegraded] = useState(false)
  const setDpr = useThree((state) => state.setDpr)
  return <Suspense fallback={null}>
    {/* `AdaptiveDpr` only reacted to `regress()`, which nothing called. The
        monitor now drops the pixel ratio for real — once, and for good:
        toggling back and forth reallocated every post-processing target and
        froze the frame for ~2 s on each flip. */}
    <PerformanceMonitor
      flipflops={1}
      onDecline={() => { if (!degraded) { setDegraded(true); setDpr(1) } }}
    />
    <DaylightSky progress={progress} mobile={mobile} degraded={degraded} ambience={ambience} />
    <CameraRig progress={progress} mobile={mobile} exposure={ambience.exposure} />
    <Lighting progress={progress} mobile={mobile} ambience={ambience} />
    <ExteriorVilla mobile={mobile} ambience={ambience} progress={progress} />
    <Surroundings model={villaModel(mobile)} />
    <Garden mobile={mobile} ambience={ambience} />
    <NightLights ambience={ambience} />
    <PostEffects mobile={mobile} progress={progress} bloom={ambience.bloom} />
    {debug3d && <Debug3D progress={progress} mobile={mobile} />}
    <Warmup onReady={onReady} />
  </Suspense>
}
