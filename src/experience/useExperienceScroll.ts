import { useCallback, useEffect, useRef, useState } from 'react'
import { SCENE_QUERY_KEY } from '../components/layout/SiteHeader'
import { EXPERIENCE_SECTIONS, landingProgressOf, sectionAt, type ExperienceSectionId } from './sections'

const clamp = (value: number) => Math.min(1, Math.max(0, value))

export function useExperienceScroll() {
  const ref = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const element = ref.current
      if (!element) return
      const rect = element.getBoundingClientRect()
      const distance = Math.max(1, element.offsetHeight - window.innerHeight)
      setProgress(clamp(-rect.top / distance))
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  const moveToProgress = useCallback((value: number) => {
    const element = ref.current
    if (!element) return
    const top = element.getBoundingClientRect().top + window.scrollY
    const distance = element.offsetHeight - window.innerHeight
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: top + clamp(value) * distance, behavior: reduced ? 'auto' : 'smooth' })
  }, [])

  const moveTo = useCallback((id: ExperienceSectionId) => {
    moveToProgress(landingProgressOf(id))
  }, [moveToProgress])

  // Deep link from a sub-page: `/?scene=visitor` opens the visit on that room.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get(SCENE_QUERY_KEY)
    if (!requested || !EXPERIENCE_SECTIONS.some((section) => section.id === requested)) return
    const frame = requestAnimationFrame(() => {
      moveToProgress(landingProgressOf(requested as ExperienceSectionId))
      const url = new URL(window.location.href)
      url.searchParams.delete(SCENE_QUERY_KEY)
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    })
    return () => cancelAnimationFrame(frame)
  }, [moveToProgress])

  return { ref, progress, section: sectionAt(progress), moveTo, moveToProgress }
}
