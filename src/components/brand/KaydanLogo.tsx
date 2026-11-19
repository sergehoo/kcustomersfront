/**
 * The official KAYDAN GROUPE logo, served as extracted from the brand file
 * (KG.pdf → public/brand/*.svg, paths untouched — only the artboard is
 * cropped to the drawing). It is never redrawn in markup.
 *
 * - `kaydan-groupe-light.svg`: ivory type, official orange mark — dark grounds;
 * - `kaydan-groupe.svg`: the original anthracite and orange — light grounds;
 * - `kaydan-groupe-mono-light.svg`: all white, where colour would clash.
 *
 * MyKaydan is a product label set beside the logo, not part of it.
 */
type Variant = 'light' | 'dark' | 'mono'

const SOURCES: Record<Variant, string> = {
  light: '/brand/kaydan-groupe-light.svg',
  dark: '/brand/kaydan-groupe.svg',
  mono: '/brand/kaydan-groupe-mono-light.svg',
}

export function KaydanLogo({ variant = 'light', product = false, compact = false }: {
  variant?: Variant
  /** Adds the « MYKAYDAN » product label beside the logo. */
  product?: boolean
  compact?: boolean
}) {
  return <span className={`kd-brand ${compact ? 'kd-brand--compact' : ''}`}>
    <img className="kd-brand-logo" src={SOURCES[variant]} alt="Kaydan Groupe" width={582} height={228} decoding="async" />
    {product && <span className="kd-brand-product" aria-label="MyKaydan">MYKAYDAN</span>}
  </span>
}
