import { useEffect, useLayoutEffect, useState, type RefObject } from 'react'

/**
 * How the visit's text comes and goes.
 *
 * It used to be scrubbed by the scroll: opacity, the mask of each title line
 * and the wipe of each caption were functions of progress. Wherever the
 * visitor stopped scrolling inside an entrance, the text stayed as it was —
 * a title cut in half behind its mask, a caption clipped in the middle of a
 * word. Scroll now only decides *whether* a text is wanted; once it is, it
 * comes in whole, on its own clock, and leaves whole.
 *
 * `usePresence` is that staging. Given the key of the text wanted now (or
 * `null`), it returns the key to render and whether it is shown:
 * - a change of key first hides what is on screen, waits for its exit, and
 *   only then swaps the content — text is never replaced while visible;
 * - a key must have been wanted for `settle` ms before it enters, so a fast
 *   scroll across several rooms does not flash each room's title in passing.
 */
export function usePresence<T extends string>(wanted: T | null, exit: number, settle: number) {
  const [stage, setStage] = useState<{ key: T | null; shown: boolean }>({ key: null, shown: false })

  useEffect(() => {
    if (stage.key === wanted) {
      if (wanted === null || stage.shown) return
      const timer = window.setTimeout(() => setStage({ key: wanted, shown: true }), settle)
      return () => window.clearTimeout(timer)
    }
    if (stage.shown) {
      setStage({ key: stage.key, shown: false })
      return
    }
    const timer = window.setTimeout(() => setStage({ key: wanted, shown: false }), stage.key === null ? 0 : exit)
    return () => window.clearTimeout(timer)
  }, [wanted, stage, exit, settle])

  return stage
}

/**
 * Fits a display title to its column, so no line is ever clipped.
 *
 * The lines are set by the copy (`\n`), and on wide screens each must hold on
 * one line: the type is scaled down just enough for the longest to fit. Where
 * lines may wrap (phones), only the longest *word* has to fit — words are
 * inline blocks and never break. One measurement at full size gives the
 * factor, since width is linear in font size.
 */
export function useTitleFit(title: RefObject<HTMLElement | null>, key: string | null) {
  useLayoutEffect(() => {
    const element = title.current
    if (!element) return
    let width = -1
    const fit = () => {
      width = element.clientWidth
      element.style.setProperty('--kd-fit', '1')
      let widest = 0
      element.querySelectorAll<HTMLElement>('.copy-line').forEach((line) => {
        if (getComputedStyle(line).whiteSpace === 'nowrap') widest = Math.max(widest, line.firstElementChild?.scrollWidth ?? 0)
        else line.querySelectorAll<HTMLElement>('.copy-word').forEach((word) => { widest = Math.max(widest, word.offsetWidth) })
      })
      // A pixel of slack: sub-pixel glyph edges round up.
      element.style.setProperty('--kd-fit', widest > width ? Math.max(.45, (width - 1) / widest).toFixed(4) : '1')
    }
    fit()
    const observer = new ResizeObserver(() => { if (element.clientWidth !== width) fit() })
    observer.observe(element)
    // The display face may still be swapping in on a first visit.
    let live = true
    document.fonts?.ready.then(() => { if (live) fit() })
    return () => {
      live = false
      observer.disconnect()
    }
  }, [title, key])
}

const NBSP = ' '
const THIN_NBSP = ' '

/**
 * French spacing, so a line can neither end on an orphaned word nor start
 * with a punctuation mark: non-breaking spaces before `:`, `;`, `?`, `!` and
 * inside « », and between the last two words when the last is short.
 */
export function typeset(text: string) {
  return text
    .replace(/ :/g, `${NBSP}:`)
    .replace(/ ([;?!])/g, `${THIN_NBSP}$1`)
    .replace(/« /g, `«${NBSP}`)
    .replace(/ »/g, `${NBSP}»`)
    .replace(/ ([^ ]{1,9})$/, `${NBSP}$1`)
}
