import { useCallback, useEffect, useRef, useState } from 'react'
import { EXPERIENCE_SECTIONS, sectionAt, type ExperienceSectionId } from './sections'

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
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (frame) cancelAnimationFrame(frame) }
  }, [])

  const moveTo = useCallback((id: ExperienceSectionId) => {
    const target = EXPERIENCE_SECTIONS.find((section) => section.id === id) ?? EXPERIENCE_SECTIONS[0]
    const element = ref.current
    if (!element) return
    const top = element.getBoundingClientRect().top + window.scrollY
    const distance = element.offsetHeight - window.innerHeight
    window.scrollTo({ top: top + target.progress * distance, behavior: 'smooth' })
  }, [])

  return { ref, progress, section: sectionAt(progress), moveTo }
}
