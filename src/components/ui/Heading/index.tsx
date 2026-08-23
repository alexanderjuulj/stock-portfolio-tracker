import * as React from 'react'

import {
  BREAKPOINT_ORDER,
  LAYOUT_KEYS,
  buildResponsiveCss,
  extractLayoutProps,
  hashStyles,
  type Breakpoint,
  type LayoutProps,
  type Responsive,
} from '@/lib/layoutProps'
import { cn } from '@/lib/utils'

// ─── Type scale ──────────────────────────────────────────────────────────────

export type HeadingSize = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
export type HeadingWeight = 'regular' | 'medium' | 'semibold' | 'bold'
export type HeadingAlign = 'left' | 'center' | 'right'
export type HeadingWrap = 'wrap' | 'nowrap' | 'pretty' | 'balance'
export type HeadingTrim = 'normal' | 'start' | 'end' | 'both'

const SIZE_SCALE: Record<HeadingSize, [fontSize: string, lineHeight: string, letterSpacing: string]> = {
  // In rem (same sizes at the default 16px root) so type scales with the root
  // font size.
  '1': ['0.875rem', '1.25rem',  '0em'],       // 14 / 20
  '2': ['1rem',     '1.375rem', '0em'],       // 16 / 22
  '3': ['1.125rem', '1.625rem', '-0.005em'],  // 18 / 26
  '4': ['1.375rem', '1.875rem', '-0.015em'],  // 22 / 30
  '5': ['1.75rem',  '2.125rem', '-0.02em'],   // 28 / 34
  '6': ['2.125rem', '2.375rem', '-0.02em'],   // 34 / 38
  '7': ['2.75rem',  '3rem',     '-0.025em'],  // 44 / 48
  '8': ['4rem',     '4.25rem',  '-0.03em'],   // 64 / 68
  '9': ['6rem',     '6.25rem',  '-0.035em'],  // 96 / 100
}

const WEIGHT_MAP: Record<HeadingWeight, string> = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function kebabToCamel(s: string): string {
  return s.replace(/-([a-z])/g, (_, l: string) => l.toUpperCase())
}

function headingPropDecls(
  prop: 'size' | 'weight' | 'align' | 'wrap' | 'trim',
  value: string,
): Record<string, string> {
  switch (prop) {
    case 'size': {
      const [fs, lh, ls] = SIZE_SCALE[value as HeadingSize]
      return { 'font-size': fs, 'line-height': lh, 'letter-spacing': ls }
    }
    case 'weight':
      return { 'font-weight': WEIGHT_MAP[value as HeadingWeight] ?? value }
    case 'align':
      return { 'text-align': value }
    case 'wrap':
      return { 'text-wrap': value }
    case 'trim':
      // Figma-style vertical trim (cap height → alphabetic baseline).
      // No-op in browsers without text-box support (pre-Chromium 133).
      return { 'text-box': value === 'normal' ? 'normal' : `trim-${value} cap alphabetic` }
  }
}

// ─── Editorial <em> accent — stable rule applied to every Heading ────────────

const EM_CLASS = 'klq-heading-em'
const EM_RULE = `.${EM_CLASS} em{font-style:italic;font-family:var(--font-italic,var(--font-body));color:var(--accent);font-weight:400}`

// ─── Props ────────────────────────────────────────────────────────────────────

type HeadingAs = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

interface HeadingBaseProps extends LayoutProps {
  as?: HeadingAs
  size?: Responsive<HeadingSize>
  weight?: Responsive<HeadingWeight>
  align?: Responsive<HeadingAlign>
  wrap?: Responsive<HeadingWrap>
  /** Vertical trim à la Figma: cuts leading above cap height / below baseline. */
  trim?: Responsive<HeadingTrim>
  truncate?: boolean
  /** Raw CSS color or design token, e.g. `"var(--accent)"`. */
  color?: string
  /** When true and no `color` prop, sets color to `var(--fg)`. */
  highContrast?: boolean
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
}

type HeadingH1Props = { as?: 'h1' } & Omit<React.HTMLAttributes<HTMLHeadingElement>, keyof HeadingBaseProps>
type HeadingH2Props = { as: 'h2' } & Omit<React.HTMLAttributes<HTMLHeadingElement>, keyof HeadingBaseProps>
type HeadingH3Props = { as: 'h3' } & Omit<React.HTMLAttributes<HTMLHeadingElement>, keyof HeadingBaseProps>
type HeadingH4Props = { as: 'h4' } & Omit<React.HTMLAttributes<HTMLHeadingElement>, keyof HeadingBaseProps>
type HeadingH5Props = { as: 'h5' } & Omit<React.HTMLAttributes<HTMLHeadingElement>, keyof HeadingBaseProps>
type HeadingH6Props = { as: 'h6' } & Omit<React.HTMLAttributes<HTMLHeadingElement>, keyof HeadingBaseProps>

export type HeadingProps = HeadingBaseProps &
  (
    | HeadingH1Props
    | HeadingH2Props
    | HeadingH3Props
    | HeadingH4Props
    | HeadingH5Props
    | HeadingH6Props
  )

// ─── Component ───────────────────────────────────────────────────────────────

const LAYOUT_KEYS_SET = new Set<string>(LAYOUT_KEYS)

const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(function Heading(
  props,
  forwardedRef,
) {
  const {
    as: Tag = 'h2',
    // No size/weight defaults: type props apply inline styles, which beat any
    // class — a Heading styled via CSS module must be able to omit them.
    size,
    weight,
    align,
    wrap,
    trim,
    truncate,
    color,
    highContrast,
    className,
    style: styleProp,
    children,
    ...rest
  } = props as HeadingProps & { as?: HeadingAs }

  // Generic layout props (margin, padding, flex-item, grid-item, etc.)
  const {
    rest: passthrough,
    baseStyle,
    responsiveStyles: layoutResponsive,
    hasResponsive: hasLayoutResponsive,
  } = extractLayoutProps(rest as Record<string, unknown>, LAYOUT_KEYS_SET)

  // ── Heading-specific props ───────────────────────────────────────────────

  const headingBaseStyle: Record<string, string> = {
    // Defaults — applied first so explicit props / style override them.
    fontFamily: 'var(--font-display)',
    // No inline color default: it would beat class styles (and --fg is not a
    // token in this project). Color comes from inheritance, the `color` prop,
    // or the consumer's CSS module.
    margin: '0',
  }
  const headingResponsive: Partial<Record<Breakpoint, Record<string, string>>> = {}
  let hasHeadingResponsive = false

  function applyProp(
    prop: 'size' | 'weight' | 'align' | 'wrap' | 'trim',
    value: Responsive<string> | undefined,
  ) {
    if (value === undefined) return

    if (typeof value === 'string') {
      const decls = headingPropDecls(prop, value)
      for (const [k, v] of Object.entries(decls)) {
        headingBaseStyle[kebabToCamel(k)] = v
      }
      return
    }

    const responsive = value as Partial<Record<Breakpoint, string>>
    const hasBreakpoints = BREAKPOINT_ORDER.some(
      (bp) => bp !== 'initial' && responsive[bp] !== undefined,
    )

    if (hasBreakpoints) {
      hasHeadingResponsive = true
      for (const bp of BREAKPOINT_ORDER) {
        const v = responsive[bp]
        if (v === undefined) continue
        const decls = headingPropDecls(prop, v)
        const bucket = (headingResponsive[bp] ??= {})
        Object.assign(bucket, decls)
      }
    } else {
      const v = responsive['initial']
      if (v !== undefined) {
        const decls = headingPropDecls(prop, v)
        for (const [k, dv] of Object.entries(decls)) {
          headingBaseStyle[kebabToCamel(k)] = dv
        }
      }
    }
  }

  applyProp('size', size)
  applyProp('weight', weight)
  applyProp('align', align)
  applyProp('wrap', wrap)
  applyProp('trim', trim)

  if (truncate) {
    headingBaseStyle.overflow = 'hidden'
    headingBaseStyle.whiteSpace = 'nowrap'
    headingBaseStyle.textOverflow = 'ellipsis'
  }

  if (color) {
    headingBaseStyle.color = color
  } else if (highContrast) {
    headingBaseStyle.color = 'var(--fg)'
  }

  // ── Merge responsive style maps ──────────────────────────────────────────

  const allResponsive: Partial<Record<Breakpoint, Record<string, string>>> = { ...layoutResponsive }
  for (const bp of Object.keys(headingResponsive) as Breakpoint[]) {
    allResponsive[bp] = { ...(allResponsive[bp] ?? {}), ...headingResponsive[bp] }
  }

  const hasResponsive = hasLayoutResponsive || hasHeadingResponsive

  let responsiveClass: string | undefined
  let responsiveCss = ''
  if (hasResponsive) {
    responsiveClass = `klq-heading-${hashStyles(allResponsive)}`
    responsiveCss = buildResponsiveCss(responsiveClass, allResponsive)
  }

  // Always emit the editorial <em> accent rule, scoped to the stable EM_CLASS
  // on the root element so it never leaks to consumer DOM.
  const css = responsiveCss + EM_RULE

  const mergedStyle: React.CSSProperties = {
    ...baseStyle,
    ...(headingBaseStyle as React.CSSProperties),
    ...styleProp,
  }

  const Comp = Tag as React.ElementType

  return (
    <Comp
      ref={forwardedRef}
      className={cn(EM_CLASS, responsiveClass, className)}
      style={mergedStyle}
      {...passthrough}
    >
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {children}
    </Comp>
  )
})

export default Heading
