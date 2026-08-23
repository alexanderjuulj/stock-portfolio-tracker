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

export type TextSize = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
export type TextWeight = 'light' | 'regular' | 'medium' | 'bold'
export type TextAlign = 'left' | 'center' | 'right'
export type TextWrap = 'wrap' | 'nowrap' | 'pretty' | 'balance'
export type TextTrim = 'normal' | 'start' | 'end' | 'both'

// In rem (same sizes at the default 16px root) so type scales with the root
// font size.
const SIZE_SCALE: Record<TextSize, [fontSize: string, lineHeight: string, letterSpacing: string]> = {
  '1': ['0.75rem',   '1rem',      '0.0025em'],  // 12 / 16
  '2': ['0.875rem',  '1.25rem',   '0em'],       // 14 / 20
  '3': ['1rem',      '1.5rem',    '0em'],       // 16 / 24
  '4': ['1.125rem',  '1.75rem',   '-0.0025em'], // 18 / 28
  '5': ['1.25rem',   '1.875rem',  '-0.005em'],  // 20 / 30
  '6': ['1.5rem',    '2.125rem',  '-0.00625em'],// 24 / 34
  '7': ['1.75rem',   '2.5rem',    '-0.0075em'], // 28 / 40
  '8': ['2.1875rem', '2.875rem',  '-0.01em'],   // 35 / 46
  '9': ['3.75rem',   '4.25rem',   '-0.025em'],  // 60 / 68
}

const WEIGHT_MAP: Record<TextWeight, string> = {
  light: '300',
  regular: '400',
  medium: '500',
  bold: '700',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function kebabToCamel(s: string): string {
  return s.replace(/-([a-z])/g, (_, l: string) => l.toUpperCase())
}

// Returns kebab-case declarations — used both for inline style (converted to camelCase)
// and for the responsive <style> block (stays kebab).
function textPropDecls(
  prop: 'size' | 'weight' | 'align' | 'wrap' | 'trim',
  value: string,
): Record<string, string> {
  switch (prop) {
    case 'size': {
      const [fs, lh, ls] = SIZE_SCALE[value as TextSize]
      return { 'font-size': fs, 'line-height': lh, 'letter-spacing': ls }
    }
    case 'weight':
      return { 'font-weight': WEIGHT_MAP[value as TextWeight] ?? value }
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

// ─── Props ────────────────────────────────────────────────────────────────────

type TextAs = 'span' | 'div' | 'p' | 'label'

interface TextBaseProps extends LayoutProps {
  size?: Responsive<TextSize>
  weight?: Responsive<TextWeight>
  align?: Responsive<TextAlign>
  wrap?: Responsive<TextWrap>
  /** Vertical trim à la Figma: cuts leading above cap height / below baseline. */
  trim?: Responsive<TextTrim>
  truncate?: boolean
  /** Raw CSS color or design token, e.g. `"var(--accent)"`. */
  color?: string
  /** When true and no `color` prop, sets color to `var(--fg)`. */
  highContrast?: boolean
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
}

type TextSpanProps  = { as?: 'span'  } & Omit<React.HTMLAttributes<HTMLSpanElement>,      keyof TextBaseProps>
type TextDivProps   = { as:  'div'   } & Omit<React.HTMLAttributes<HTMLDivElement>,        keyof TextBaseProps>
type TextPProps     = { as:  'p'     } & Omit<React.HTMLAttributes<HTMLParagraphElement>,  keyof TextBaseProps>
type TextLabelProps = { as:  'label' } & Omit<React.LabelHTMLAttributes<HTMLLabelElement>, keyof TextBaseProps>

export type TextProps = TextBaseProps & (TextSpanProps | TextDivProps | TextPProps | TextLabelProps)

// ─── Component ───────────────────────────────────────────────────────────────

const LAYOUT_KEYS_SET = new Set<string>(LAYOUT_KEYS)

const Text = React.forwardRef<HTMLElement, TextProps>(function Text(props, forwardedRef) {
  const {
    as: Tag = 'span',
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
  } = props as TextProps & { as?: TextAs }

  // Generic layout props (margin, padding, flex-item, grid-item, etc.)
  const {
    rest: passthrough,
    baseStyle,
    responsiveStyles: layoutResponsive,
    hasResponsive: hasLayoutResponsive,
  } = extractLayoutProps(rest as Record<string, unknown>, LAYOUT_KEYS_SET)

  // ── Text-specific props ──────────────────────────────────────────────────

  const textBaseStyle: Record<string, string> = {}
  const textResponsive: Partial<Record<Breakpoint, Record<string, string>>> = {}
  let hasTextResponsive = false

  function applyProp(prop: 'size' | 'weight' | 'align' | 'wrap' | 'trim', value: Responsive<string> | undefined) {
    if (value === undefined) return

    if (typeof value === 'string') {
      const decls = textPropDecls(prop, value)
      for (const [k, v] of Object.entries(decls)) {
        textBaseStyle[kebabToCamel(k)] = v
      }
      return
    }

    // Responsive object
    const responsive = value as Partial<Record<Breakpoint, string>>
    const hasBreakpoints = BREAKPOINT_ORDER.some((bp) => bp !== 'initial' && responsive[bp] !== undefined)

    if (hasBreakpoints) {
      hasTextResponsive = true
      for (const bp of BREAKPOINT_ORDER) {
        const v = responsive[bp]
        if (v === undefined) continue
        const decls = textPropDecls(prop, v)
        const bucket = (textResponsive[bp] ??= {})
        Object.assign(bucket, decls)
      }
    } else {
      const v = responsive['initial']
      if (v !== undefined) {
        const decls = textPropDecls(prop, v)
        for (const [k, dv] of Object.entries(decls)) {
          textBaseStyle[kebabToCamel(k)] = dv
        }
      }
    }
  }

  applyProp('size',   size)
  applyProp('weight', weight)
  applyProp('align',  align)
  applyProp('wrap',   wrap)
  applyProp('trim',   trim)

  if (truncate) {
    textBaseStyle.overflow = 'hidden'
    textBaseStyle.whiteSpace = 'nowrap'
    textBaseStyle.textOverflow = 'ellipsis'
  }

  if (color) {
    textBaseStyle.color = color
  } else if (highContrast) {
    textBaseStyle.color = 'var(--fg)'
  }

  // ── Merge responsive style maps ──────────────────────────────────────────

  const allResponsive: Partial<Record<Breakpoint, Record<string, string>>> = { ...layoutResponsive }
  for (const bp of Object.keys(textResponsive) as Breakpoint[]) {
    allResponsive[bp] = { ...(allResponsive[bp] ?? {}), ...textResponsive[bp] }
  }

  const hasResponsive = hasLayoutResponsive || hasTextResponsive

  let responsiveClass: string | undefined
  let css: string | undefined
  if (hasResponsive) {
    responsiveClass = `klq-text-${hashStyles(allResponsive)}`
    css = buildResponsiveCss(responsiveClass, allResponsive)
  }

  const mergedStyle: React.CSSProperties = {
    ...baseStyle,
    ...(textBaseStyle as React.CSSProperties),
    ...styleProp,
  }

  const Comp = Tag as React.ElementType

  return (
    <Comp
      ref={forwardedRef}
      className={cn(responsiveClass, className)}
      style={mergedStyle}
      {...passthrough}
    >
      {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
      {children}
    </Comp>
  )
})

export default Text
