import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { DirectionalLight } from 'three'

export function Lighting({ progress, mobile }: { progress: number; mobile: boolean }) {
  const key = useRef<DirectionalLight>(null)
  useFrame(() => {
    if (!key.current) return
    const interior = Math.max(0, Math.min(1, (progress - .12) / .2)) * (1 - Math.max(0, Math.min(1, (progress - .82) / .16)))
    key.current.intensity = 2.15 - interior * .48
  })
  return <>
    <hemisphereLight args={['#b7ccdc', '#554535', .7]} />
    <directionalLight ref={key} castShadow={!mobile} position={[-12, 18, 16]} color="#ffe2b5" intensity={2.15} shadow-mapSize={mobile ? [512, 512] : [2048, 2048]} shadow-camera-far={62} shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={24} shadow-camera-bottom={-24} shadow-bias={-.00012} shadow-normalBias={.028} />
    <pointLight position={[2.2,5.65,12.2]} color="#ffd39a" intensity={22} distance={9} decay={2} />
    <pointLight position={[-4.5,5.8,9]} color="#ffc77d" intensity={18} distance={8} decay={2} />
    <pointLight position={[-5.8,5.6,6]} color="#f7bd75" intensity={14} distance={7} decay={2} />
    <pointLight position={[3.8,5.5,3.2]} color="#ffd18a" intensity={13} distance={8} decay={2} />
  </>
}
