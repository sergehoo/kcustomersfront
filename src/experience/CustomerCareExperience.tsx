import { useProgress } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { ArrowUpRight, ChevronDown } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ACESFilmicToneMapping } from 'three'
import { SiteHeader } from '../components/layout/SiteHeader'
import { Scene } from './Scene'
import { EXPERIENCE_SECTIONS, type ExperienceSectionId } from './sections'
import { useExperienceScroll } from './useExperienceScroll'

const StaticFallback = lazy(() => import('./StaticFallback'))

function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')))
  } catch { return false }
}

function ExperienceOverlay({ progress, section, moveTo }: { progress: number; section: (typeof EXPERIENCE_SECTIONS)[number]; moveTo: (id: ExperienceSectionId) => void }) {
  const index = EXPERIENCE_SECTIONS.findIndex((item) => item.id === section.id)
  const nextProgress = EXPERIENCE_SECTIONS[index + 1]?.progress ?? 1
  const local = (progress - section.progress) / Math.max(.001, nextProgress - section.progress)
  const enter = Math.min(1, Math.max(0, local / .14))
  const leave = Math.min(1, Math.max(0, (1 - local) / .18))
  const visibility = section.id === 'exterior' ? Math.min(1, Math.max(0, 1 - progress / .11)) : Math.min(enter, leave)
  return <div className="experience-ui">
    <div className="experience-frame" aria-hidden="true" />
    <div className="experience-grid" aria-hidden="true">{Array.from({ length: 5 }, (_, item) => <i key={item} />)}</div>
    <SiteHeader onExperienceNavigate={moveTo} activeScene={section.id} />
    <aside className="experience-progress" aria-label="Progression de la visite"><span>{String(index + 1).padStart(2, '0')}</span><i><b style={{ transform: `scaleY(${Math.max(.04, progress)})` }} /></i><small>{section.label}</small></aside>
    <section className={`experience-copy ${section.id === 'exterior' ? 'experience-copy--hero' : ''}`} aria-live="polite" key={section.id} style={{ opacity: visibility, transform: `translateY(${(1 - visibility) * 18}px)`, filter: `blur(${(1 - visibility) * 3}px)` }}>
      <p className="eyebrow">{section.eyebrow}</p>
      <h1>{section.title.split('\n').map((line) => <span key={line}>{line}</span>)}</h1>
      <p>{section.description}</p>
      <Link to={section.href} className="primary-link">{section.cta}<ArrowUpRight size={17} /></Link>
    </section>
    <aside className="experience-spec" aria-label="Espace actuel">
      <span>PARCOURS KAYDAN</span>
      <div><strong>{section.label}</strong><small>{String(index + 1).padStart(2, '0')} / {String(EXPERIENCE_SECTIONS.length).padStart(2, '0')}</small></div>
    </aside>
    <button className="scroll-cue" onClick={() => moveTo(EXPERIENCE_SECTIONS[Math.min(index + 1, EXPERIENCE_SECTIONS.length - 1)].id)} aria-label="Avancer dans la visite"><ChevronDown size={20} /><span>{index === 0 ? 'Visiter' : 'Continuer'}</span></button>
    <nav className="experience-dots" aria-label="Pièces de la visite">{EXPERIENCE_SECTIONS.map((item, itemIndex) => <button key={item.id} onClick={() => moveTo(item.id)} aria-label={`Aller à ${item.label}`} aria-current={item.id === section.id ? 'step' : undefined}><span className={itemIndex <= index ? 'done' : ''} /></button>)}</nav>
    {progress < .13 && <a className="asset-credit" href="https://sketchfab.com/3d-models/modern-coastal-hillside-villa-7aa1124e2f0a4013a16f61404deb8259" target="_blank" rel="noreferrer">Villa 3D — Visthétique · CC BY 4.0</a>}
  </div>
}

export function CustomerCareExperience() {
  const { ref, progress, section, moveTo } = useExperienceScroll()
  const [webgl, setWebgl] = useState<boolean | null>(null)
  const [mobile, setMobile] = useState(false)
  const [ready, setReady] = useState(false)
  const [debug3d] = useState(() => new URLSearchParams(window.location.search).get('debug3d') === 'true')
  const { active: assetsLoading, progress: assetsProgress } = useProgress()
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const updateQuality = () => setMobile(media.matches)
    setWebgl(isWebGLAvailable()); updateQuality(); media.addEventListener('change', updateQuality)
    const timer = window.setTimeout(() => setReady(true), 450)
    return () => { window.clearTimeout(timer); media.removeEventListener('change', updateQuality) }
  }, [])
  return <div className="experience-page">
    {(!ready || assetsLoading) && <div className="experience-loader" role="status"><span>KAYDAN</span><i style={{ transform: `scaleX(${Math.max(.04, assetsProgress / 100)})` }} /><small>ENTRÉE…</small></div>}
    <div className="experience-stage" aria-hidden="true">
      {webgl === true ? <Canvas shadows={mobile ? false : 'percentage'} dpr={mobile ? [1, 1.2] : [1, 1.6]} camera={{ fov: mobile ? 55 : 50, near: .1, far: 120, position: [4.8, 1.65, 31.5] }} gl={{ antialias: !mobile, alpha: false, powerPreference: 'high-performance' }} onCreated={({ gl }) => { gl.toneMapping = ACESFilmicToneMapping; gl.toneMappingExposure = .79 }}>
        <Scene progress={progress} mobile={mobile} debug3d={debug3d} />
      </Canvas> : webgl === false ? <Suspense fallback={null}><StaticFallback /></Suspense> : null}
    </div>
    <ExperienceOverlay progress={progress} section={section} moveTo={moveTo} />
    <div ref={ref} className="experience-scroll" aria-hidden="true"><div /></div>
  </div>
}
