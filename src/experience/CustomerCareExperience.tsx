import { useProgress } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { ArrowUpRight, ChevronDown } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ACESFilmicToneMapping } from 'three'
import { SiteHeader } from '../components/layout/SiteHeader'
import { ExperienceOutro } from './ExperienceOutro'
import { Scene } from './Scene'
import { EXPERIENCE_SECTIONS, OUTRO_PROGRESS, SECTION_COUNT, SECTION_TOTAL, type ExperienceSection, type ExperienceSectionId } from './sections'
import { useExperienceScroll } from './useExperienceScroll'

const StaticFallback = lazy(() => import('./StaticFallback'))

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')))
  } catch { return false }
}

/**
 * Entirely scroll-driven: `enter` and `leave` are pure functions of progress, so
 * every frame is authoritative and nothing is left behind by a finished CSS
 * animation. The previous `animation: editorial-in … both` rule outranked these
 * inline styles in the cascade and pinned every title at opacity 1.
 */
function sectionVisibility(progress: number, section: ExperienceSection, index: number) {
  const nextProgress = EXPERIENCE_SECTIONS[index + 1]?.progress ?? 1
  const span = Math.max(.001, nextProgress - section.progress)
  const local = clamp01((progress - section.progress) / span)
  const enter = clamp01(local / .1)
  const leave = clamp01((1 - local) / .18)
  // The hero owns the very first screen, so it fades on its own schedule.
  const visible = index === 0 ? clamp01(1 - progress / .105) : Math.min(enter, leave)
  return { enter: index === 0 ? 1 : enter, visible }
}

function ExperienceCopy({ progress, section, index }: { progress: number; section: ExperienceSection; index: number }) {
  const { enter, visible } = sectionVisibility(progress, section, index)
  const lines = section.title.split('\n')
  return <section
    className={`experience-copy ${index === 0 ? 'experience-copy--hero' : ''}`}
    aria-live="polite"
    style={{ opacity: visible, transform: `translateY(${(1 - visible) * 14}px)`, pointerEvents: visible > .5 ? 'auto' : 'none' }}
  >
    <p className="eyebrow" style={{ opacity: clamp01((enter - .1) / .5) }}>{section.eyebrow}</p>
    <h1>
      {lines.map((line, lineIndex) => {
        // Per-line mask reveal: the type itself is never blurred, so an active title is pixel-sharp.
        const lineEnter = clamp01((enter - lineIndex * .16) / (1 - lineIndex * .16))
        return <span className="copy-line" key={line}>
          <i style={{ transform: `translateY(${(1 - lineEnter) * 135}%)` }}>{line}</i>
        </span>
      })}
    </h1>
    <p className="copy-body" style={{ opacity: clamp01((enter - .3) / .6) }}>{section.description}</p>
    <Link to={section.route} className="primary-link" style={{ opacity: clamp01((enter - .42) / .5) }} tabIndex={visible > .5 ? 0 : -1}>
      {section.cta}<ArrowUpRight size={17} />
    </Link>
  </section>
}

function ExperienceOverlay({ progress, section, moveTo, moveToProgress }: {
  progress: number
  section: ExperienceSection
  moveTo: (id: ExperienceSectionId) => void
  moveToProgress: (value: number) => void
}) {
  const index = EXPERIENCE_SECTIONS.findIndex((item) => item.id === section.id)
  const outroReveal = clamp01((progress - OUTRO_PROGRESS) / (1 - OUTRO_PROGRESS - .015))
  const chromeFade = 1 - outroReveal
  const nextSection = EXPERIENCE_SECTIONS[Math.min(index + 1, SECTION_COUNT - 1)]

  return <div className="experience-ui">
    <div className="experience-frame" aria-hidden="true" />
    <div className="experience-grid" aria-hidden="true">{Array.from({ length: 5 }, (_, item) => <i key={item} />)}</div>
    <SiteHeader onExperienceNavigate={moveTo} activeScene={section.id} />

    {/* `visibility` (not `pointer-events`) is what actually removes the faded chrome
        from hit-testing and from the tab order once the outro owns the frame. */}
    <div className="experience-chrome" style={{ opacity: chromeFade, visibility: chromeFade > .04 ? 'visible' : 'hidden' }}>
      <aside className="experience-progress" aria-label="Progression de la visite">
        <span>{section.ordinal}</span>
        <i><b style={{ transform: `scaleY(${Math.max(.04, progress)})` }} /></i>
        <small>{section.label}</small>
      </aside>

      <ExperienceCopy progress={progress} section={section} index={index} />

      <aside className="experience-spec" aria-label="Espace actuel">
        <span>PARCOURS KAYDAN</span>
        <div><strong>{section.label}</strong><small>{section.ordinal} / {SECTION_TOTAL}</small></div>
      </aside>

      <button
        className="scroll-cue"
        onClick={() => (index === SECTION_COUNT - 1 ? moveToProgress(1) : moveTo(nextSection.id))}
        aria-label={index === SECTION_COUNT - 1 ? 'Aller à la fin de la visite' : `Aller à ${nextSection.label}`}
      >
        <ChevronDown size={20} /><span>{index === 0 ? 'Visiter' : 'Continuer'}</span>
      </button>

      <nav className="experience-dots" aria-label="Pièces de la visite">
        {EXPERIENCE_SECTIONS.map((item, itemIndex) => <button
          key={item.id}
          onClick={() => moveTo(item.id)}
          aria-label={`Aller à ${item.label}`}
          aria-current={item.id === section.id ? 'step' : undefined}
        ><span className={itemIndex <= index ? 'done' : ''} /></button>)}
      </nav>
    </div>

    <ExperienceOutro reveal={outroReveal} onRestart={() => moveToProgress(0)} />

    {progress < .12 && <a
      className="asset-credit"
      style={{ opacity: chromeFade }}
      href="https://sketchfab.com/3d-models/modern-coastal-hillside-villa-7aa1124e2f0a4013a16f61404deb8259"
      target="_blank"
      rel="noreferrer"
    >Villa 3D — Visthétique · CC BY 4.0</a>}
  </div>
}

export function CustomerCareExperience() {
  const { ref, progress, section, moveTo, moveToProgress } = useExperienceScroll()
  const [webgl, setWebgl] = useState<boolean | null>(null)
  const [mobile, setMobile] = useState(false)
  const [debug3d] = useState(() => new URLSearchParams(window.location.search).get('debug3d') === 'true')
  const { active: assetsLoading, progress: assetsProgress, loaded, total } = useProgress()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const updateQuality = () => setMobile(media.matches)
    setWebgl(isWebGLAvailable())
    updateQuality()
    media.addEventListener('change', updateQuality)
    return () => media.removeEventListener('change', updateQuality)
  }, [])

  // Hold the curtain until the villa is actually on screen, then fade it out.
  useEffect(() => {
    if (webgl === false) { setDismissed(true); return }
    if (assetsLoading || total === 0 || loaded < total) return
    const timer = window.setTimeout(() => setDismissed(true), 420)
    return () => window.clearTimeout(timer)
  }, [assetsLoading, loaded, total, webgl])

  return <div className="experience-page">
    {!dismissed && <div className="experience-loader" role="status" aria-live="polite">
      <span>KAYDAN</span>
      <i style={{ transform: `scaleX(${Math.max(.03, assetsProgress / 100)})` }} />
      <small>{assetsProgress < 100 ? `ENTRÉE… ${Math.round(assetsProgress)}%` : 'ENTRÉE…'}</small>
    </div>}

    <div className="experience-stage" aria-hidden="true">
      {webgl === true ? <Canvas
        shadows={mobile ? false : 'percentage'}
        dpr={mobile ? [1, 1.2] : [1, 1.6]}
        camera={{ fov: mobile ? 58 : 52, near: .1, far: 140, position: [5.6, 2.5, 30.2] }}
        gl={{ antialias: !mobile, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: import.meta.env.DEV }}
        onCreated={({ gl }) => { gl.toneMapping = ACESFilmicToneMapping; gl.toneMappingExposure = .79 }}
      >
        <Scene progress={progress} mobile={mobile} debug3d={debug3d} />
      </Canvas> : webgl === false ? <Suspense fallback={null}><StaticFallback /></Suspense> : null}
    </div>

    <ExperienceOverlay progress={progress} section={section} moveTo={moveTo} moveToProgress={moveToProgress} />
    <div ref={ref} className="experience-scroll" aria-hidden="true"><div /></div>
  </div>
}
