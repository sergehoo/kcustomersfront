/**
 * The only brand artefact in the repository is `public/favicon.svg`: a gold house
 * glyph on an ink ground. There is no logo file and no brand guide, so the mark
 * is reproduced here as a component — same geometry, same two colours — and the
 * whole palette in `styles.css` is derived from it.
 */
export function KaydanMark({ size = 34, className }: { size?: number; className?: string }) {
  return <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    className={className}
    role="presentation"
    aria-hidden="true"
    focusable="false"
  >
    <rect width="64" height="64" rx="14" fill="var(--kd-mark-ground)" />
    <path d="M14 48V25L32 11l18 14v23H38V31H26v17z" fill="var(--kd-mark-glyph)" />
    <path d="M28 48V34h8v14" fill="var(--kd-mark-ground)" />
  </svg>
}

/** Mark plus wordmark, used in the header, the outro and the sub-page shell. */
export function KaydanLogo({ compact = false }: { compact?: boolean }) {
  return <span className={`kd-logo ${compact ? 'kd-logo--compact' : ''}`}>
    <KaydanMark size={compact ? 28 : 34} />
    <span className="kd-logo-type">
      <span className="kd-logo-name">KAYDAN</span>
      <span className="kd-logo-sub">Customer Care</span>
    </span>
  </span>
}
