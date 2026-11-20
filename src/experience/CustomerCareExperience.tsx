import { useProgress } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { ArrowDown, ArrowUpRight, ChevronDown } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { NeutralToneMapping } from 'three'
import { SiteHeader } from '../components/layout/SiteHeader'
import { ExperienceOutro } from './ExperienceOutro'
import { Scene } from './Scene'
import { EXPERIENCE_SECTIONS, OUTRO_PROGRESS, SECTION_COUNT, SECTION_TOTAL, type ExperienceSection, type ExperienceSectionId, type SectionAction } from './sections'
import { useExperienceScroll } from './useExperienceScroll'
import { useAmbienceControl } from './ambience'
import { AmbienceToggle } from './AmbienceToggle'
import { TOUR_SCROLL_VH, TOUR_STOPS } from './tour'
import { SHOT_CAPTIONS } from './captions'
import { KaydanLogo } from '../components/brand/KaydanLogo'
import { typeset, usePresence, useTitleFit } from './copy'
import { useSound } from './audio/sound'
import { SoundToggle } from './audio/SoundToggle'

const StaticFallback = lazy(() => import('./StaticFallback'))

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const HERO_HOLD_END = TOUR_STOPS.find((stop) => stop.shot !== null)!.leave

/** A page of the site, or a published site in a new tab. */
function ActionLink({ action, className, style, tabIndex, onClick, children }: {
  action: SectionAction
  className: string
  style?: CSSProperties
  tabIndex?: number
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void
  children: React.ReactNode
}) {
  if (action.external) return <a href={action.route} target="_blank" rel="noreferrer" className={className} style={style} tabIndex={tabIndex}>{children}</a>
  return <Link to={action.route} className={className} style={style} tabIndex={tabIndex} onClick={onClick}>{children}</Link>
}

function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')))
  } catch { return false }
}

/** Exit of a text block, in ms: matches the fade in styles.css. */
const COPY_EXIT = 380
/** How long a text must have been wanted before it enters (see copy.ts). */
const COPY_SETTLE = 140

/** A custom property for the stagger of one element. */
const delay = (seconds: number) => ({ '--kd-delay': `${seconds}s` }) as CSSProperties

/**
 * Whether a room's copy is wanted at this point of the scroll: from just
 * after the camera lands on the room's overview until it is on its way out.
 * Scroll decides that and nothing else — the motion itself is timed (copy.ts).
 */
function copyWanted(progress: number, section: ExperienceSection, index: number) {
  // The hero owns the very first screen: it leaves as the camera leaves the
  // hero shot, before the façade shot of the same room.
  if (index === 0) return progress <= HERO_HOLD_END + .004
  const nextProgress = EXPERIENCE_SECTIONS[index + 1]?.progress ?? 1
  const local = (progress - section.progress) / Math.max(.001, nextProgress - section.progress)
  return local >= .02 && local <= .86
}

function ExperienceCopy({ progress, section, index, moveTo, ready, onBegin }: {
  progress: number
  section: ExperienceSection
  index: number
  moveTo: (id: ExperienceSectionId) => void
  ready: boolean
  /** The visitor starts the visit: the moment the sound may come in. */
  onBegin: () => void
}) {
  const stage = usePresence(ready && copyWanted(progress, section, index) ? section.id : null, COPY_EXIT, COPY_SETTLE)
  const title = useRef<HTMLHeadingElement>(null)
  useTitleFit(title, stage.key)
  const shown = EXPERIENCE_SECTIONS.find((item) => item.id === stage.key)
  if (!shown) return null
  // The hero's call to action starts the visit — it used to open /rendez-vous
  // while reading "Commencer la visite". Its href stays a real deep link for
  // middle-click and no-JS; a plain click moves the camera instead.
  const startsVisit = shown.number === 1
  const nextRoom = EXPERIENCE_SECTIONS[1].id
  const focusable = stage.shown ? 0 : -1
  return <section
    className={`experience-copy${startsVisit ? ' experience-copy--hero' : ''}${stage.shown ? ' is-shown' : ''}`}
    aria-live="polite"
  >
    <p className="eyebrow copy-fade" style={delay(.02)}>{shown.eyebrow}</p>
    <h1 ref={title}>
      {shown.title.split('\n').map((line, lineIndex) => (
        // Per-line mask reveal: the type itself is never blurred or faded, so
        // an active title is pixel-sharp. Each word is its own box: a line may
        // wrap between words on a narrow screen, never inside one.
        <span className="copy-line" key={line} style={{ '--kd-line': lineIndex } as CSSProperties}>
          <i>{line.split(' ').map((word, wordIndex) => <span key={wordIndex}>{wordIndex > 0 && ' '}<span className="copy-word">{word}</span></span>)}</i>
        </span>
      ))}
    </h1>
    {shown.subtitle && <p className="copy-subtitle copy-fade" style={delay(.36)}>{typeset(shown.subtitle)}</p>}
    <p className="copy-body copy-fade" style={delay(shown.subtitle ? .46 : .4)}>{typeset(shown.description)}</p>
    {(shown.action || shown.secondary) && <div className="copy-actions copy-fade" style={delay(shown.subtitle ? .58 : .52)}>
      {shown.action && <ActionLink
        action={shown.action}
        className="primary-link"
        tabIndex={focusable}
        onClick={startsVisit ? (event) => { event.preventDefault(); onBegin(); moveTo(nextRoom) } : undefined}
      >
        {shown.action.label}{startsVisit ? <ArrowDown size={17} /> : <ArrowUpRight size={17} />}
      </ActionLink>}
      {shown.secondary && <ActionLink action={shown.secondary} className="ghost-link" tabIndex={focusable}>
        {shown.secondary.label}<ArrowUpRight size={16} />
      </ActionLink>}
    </div>}
  </section>
}

/**
 * A line on some focus shots, held with the shot: it comes in once the camera
 * has settled and is gone before it moves on, so it never travels over a room.
 */
function ShotCaption({ progress }: { progress: number }) {
  const stop = TOUR_STOPS.find((item) => item.shot && progress >= item.arrive && progress <= item.leave && SHOT_CAPTIONS[`${item.room}/${item.shot}`])
  const local = stop ? (progress - stop.arrive) / Math.max(1e-6, stop.leave - stop.arrive) : 0
  const stage = usePresence(stop && local >= .1 && local <= .86 ? `${stop.room}/${stop.shot}` : null, COPY_EXIT, COPY_SETTLE)
  const caption = stage.key ? SHOT_CAPTIONS[stage.key] : null
  if (!caption) return null
  return <aside className={`shot-caption${stage.shown ? ' is-shown' : ''}`} aria-live="polite">
    <span className="shot-caption-rule" aria-hidden="true" />
    {caption.eyebrow && <p className="shot-caption-eyebrow copy-fade" style={delay(.1)}>{caption.eyebrow}</p>}
    {caption.text && <p className="shot-caption-text copy-fade" style={delay(.18)}>{typeset(caption.text)}</p>}
    {caption.steps && <ol className="shot-caption-steps">{caption.steps.map((step, index) => <li key={step} className="copy-fade" style={delay(.18 + index * .1)}>{step}</li>)}</ol>}
  </aside>
}

function ExperienceOverlay({ progress, section, moveTo, moveToProgress, ready, onBegin }: {
  progress: number
  section: ExperienceSection
  moveTo: (id: ExperienceSectionId) => void
  moveToProgress: (value: number) => void
  onBegin: () => void
  /** The loader has lifted: the hero's text enters with the first frame, not behind the curtain. */
  ready: boolean
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

      <ExperienceCopy progress={progress} section={section} index={index} moveTo={moveTo} ready={ready} onBegin={onBegin} />
      <ShotCaption progress={progress} />

      <aside className="experience-spec" aria-label="Espace actuel">
        <span>L’EXPÉRIENCE MYKAYDAN</span>
        <div><strong>{section.label}</strong><small>{section.ordinal} / {SECTION_TOTAL}</small></div>
      </aside>

      <button
        className="scroll-cue"
        onClick={() => {
          // « Découvrir » under the hero starts the visit as the call to action does.
          if (index === 0) onBegin()
          if (index === SECTION_COUNT - 1) moveToProgress(1)
          else moveTo(nextSection.id)
        }}
        aria-label={index === SECTION_COUNT - 1 ? 'Aller à la fin de la visite' : `Aller à ${nextSection.label}`}
      >
        <ChevronDown size={20} /><span>{index === 0 ? 'Découvrir' : 'Continuer'}</span>
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
  const { ambience, mode: ambienceMode, automatic: ambienceAutomatic, toggle: toggleAmbience } = useAmbienceControl()
  const sound = useSound()
  // Set once every shader is compiled (Scene → Warmup), so the curtain never
  // lifts on a frame that is still building its programs.
  const [sceneReady, setSceneReady] = useState(false)
  const onSceneReady = useCallback(() => setSceneReady(true), [])

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
    if (!sceneReady || assetsLoading || total === 0 || loaded < total) return
    const timer = window.setTimeout(() => setDismissed(true), 260)
    return () => window.clearTimeout(timer)
  }, [assetsLoading, loaded, total, webgl, sceneReady])

  // The scroll length grows with the tour: every shot and every move has its share.
  return <div className="experience-page" style={{ '--kd-visit-length': `${TOUR_SCROLL_VH}vh` } as CSSProperties}>
    {!dismissed && <div className="experience-loader" role="status" aria-live="polite">
      <KaydanLogo />
      <i style={{ transform: `scaleX(${Math.max(.03, assetsProgress / 100)})` }} />
      <small>{assetsProgress < 100 ? `MYKAYDAN… ${Math.round(assetsProgress)}%` : 'MYKAYDAN…'}</small>
    </div>}

    <div className="experience-stage" aria-hidden="true">
      {webgl === true ? <Canvas
        shadows={mobile ? false : 'percentage'}
        // Capped on purpose. A higher ratio costs more than it shows once the
        // finishing pass sharpens the frame, and the performance monitor's only
        // answer to a slow frame is to fall back to 1 for good.
        dpr={mobile ? [1, 1.2] : [1, 1.25]}
        // `far` reaches the sea horizon; antialiasing is SMAA in PostEffects, so
        // the default framebuffer needs no MSAA of its own.
        camera={{ fov: mobile ? 58 : 52, near: .1, far: 2600, position: [5.6, 2.5, 30.2] }}
        gl={{ antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: import.meta.env.DEV }}
        // Tone mapping is applied once, at the end of PostEffects.
        onCreated={({ gl }) => { gl.toneMapping = NeutralToneMapping; gl.toneMappingExposure = 1 }}
      >
        <Scene progress={progress} mobile={mobile} debug3d={debug3d} onReady={onSceneReady} ambience={ambience} />
      </Canvas> : webgl === false ? <Suspense fallback={null}><StaticFallback /></Suspense> : null}
    </div>

    <ExperienceOverlay progress={progress} section={section} moveTo={moveTo} moveToProgress={moveToProgress} ready={dismissed} onBegin={sound.begin} />
    {webgl === true && <div className="experience-controls">
      <SoundToggle on={sound.on} onToggle={sound.toggle} />
      <AmbienceToggle mode={ambienceMode} automatic={ambienceAutomatic} onToggle={toggleAmbience} />
    </div>}
    <div ref={ref} className="experience-scroll" aria-hidden="true"><div /></div>
  </div>
}
