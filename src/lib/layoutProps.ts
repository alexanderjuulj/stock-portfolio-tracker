/**
 * Shared helpers for Box / Flex / Grid layout primitives.
 *
 * Implements Radix Themes-compatible responsive props without depending on
 * `@radix-ui/themes` or a Tailwind config file. Responsive values are emitted
 * as a single scoped `<style>` block per instance, keyed by a stable hash.
 */

import * as React from 'react'

export type Breakpoint = 'initial' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type Responsive<T> = T | Partial<Record<Breakpoint, T>>

export const BREAKPOINTS: Record<Exclude<Breakpoint, 'initial'>, string> = {
  xs: '520px',
  sm: '768px',
  md: '1024px',
  lg: '1280px',
  xl: '1640px',
}

export const BREAKPOINT_ORDER: Breakpoint[] = ['initial', 'xs', 'sm', 'md', 'lg', 'xl']

/**
 * Radix space scale → CSS length. Mirrors the values used in
 * `@radix-ui/themes`. Numeric strings like '1'..'9' (and their negatives)
 * map to the scale; anything else is treated as a raw CSS value.
 *
 * In rem rather than px (same lengths at the default 16px root) so spacing
 * scales with the root font size.
 */
const SPACE_SCALE: Record<string, string> = {
  '0': '0',
  '1': '0.25rem', // 4px
  '2': '0.5rem', //  8px
  '3': '0.75rem', // 12px
  '4': '1rem', //    16px
  '5': '1.5rem', //  24px
  '6': '2rem', //    32px
  '7': '2.5rem', //  40px
  '8': '3rem', //    48px
  '9': '4rem', //    64px
}

function spaceValue(v: string): string {
  if (v.startsWith('-')) {
    const inner = v.slice(1)
    if (SPACE_SCALE[inner]) return `-${SPACE_SCALE[inner]}`
    return v
  }
  return SPACE_SCALE[v] ?? v
}

/**
 * Convert the `columns`/`rows` value the same way Radix does.
 * A numeric string `"3"` becomes `repeat(3, minmax(0, 1fr))`.
 */
function gridTemplateValue(v: string): string {
  return /^\d+$/.test(v) ? `repeat(${v}, minmax(0, 1fr))` : v
}

function justifyValue(v: string): string {
  return v === 'between' ? 'space-between' : v
}

function alignContentValue(v: string): string {
  switch (v) {
    case 'between':
      return 'space-between'
    case 'around':
      return 'space-around'
    case 'evenly':
      return 'space-evenly'
    default:
      return v
  }
}

/**
 * A single rule describes one prop's mapping to one or more CSS declarations.
 * `transform` controls how the raw value is converted to a CSS value.
 */
type Transform = 'space' | 'identity' | 'grid-template' | 'justify' | 'align-content'

interface Rule {
  /** CSS properties to set (allows e.g. `mx` → margin-left + margin-right). */
  cssProps: string[]
  transform: Transform
}

export const RULES: Record<string, Rule> = {
  // Padding
  p: { cssProps: ['padding'], transform: 'space' },
  px: { cssProps: ['paddingLeft', 'paddingRight'], transform: 'space' },
  py: { cssProps: ['paddingTop', 'paddingBottom'], transform: 'space' },
  pt: { cssProps: ['paddingTop'], transform: 'space' },
  pr: { cssProps: ['paddingRight'], transform: 'space' },
  pb: { cssProps: ['paddingBottom'], transform: 'space' },
  pl: { cssProps: ['paddingLeft'], transform: 'space' },

  // Margin
  m: { cssProps: ['margin'], transform: 'space' },
  mx: { cssProps: ['marginLeft', 'marginRight'], transform: 'space' },
  my: { cssProps: ['marginTop', 'marginBottom'], transform: 'space' },
  mt: { cssProps: ['marginTop'], transform: 'space' },
  mr: { cssProps: ['marginRight'], transform: 'space' },
  mb: { cssProps: ['marginBottom'], transform: 'space' },
  ml: { cssProps: ['marginLeft'], transform: 'space' },

  // Width / height
  width: { cssProps: ['width'], transform: 'identity' },
  minWidth: { cssProps: ['minWidth'], transform: 'identity' },
  maxWidth: { cssProps: ['maxWidth'], transform: 'identity' },
  height: { cssProps: ['height'], transform: 'identity' },
  minHeight: { cssProps: ['minHeight'], transform: 'identity' },
  maxHeight: { cssProps: ['maxHeight'], transform: 'identity' },

  // Position
  position: { cssProps: ['position'], transform: 'identity' },
  inset: { cssProps: ['inset'], transform: 'space' },
  top: { cssProps: ['top'], transform: 'space' },
  right: { cssProps: ['right'], transform: 'space' },
  bottom: { cssProps: ['bottom'], transform: 'space' },
  left: { cssProps: ['left'], transform: 'space' },

  // Overflow
  overflow: { cssProps: ['overflow'], transform: 'identity' },
  overflowX: { cssProps: ['overflowX'], transform: 'identity' },
  overflowY: { cssProps: ['overflowY'], transform: 'identity' },

  // Flex item
  flexBasis: { cssProps: ['flexBasis'], transform: 'identity' },
  flexShrink: { cssProps: ['flexShrink'], transform: 'identity' },
  flexGrow: { cssProps: ['flexGrow'], transform: 'identity' },

  // Grid item
  gridArea: { cssProps: ['gridArea'], transform: 'identity' },
  gridColumn: { cssProps: ['gridColumn'], transform: 'identity' },
  gridColumnStart: { cssProps: ['gridColumnStart'], transform: 'identity' },
  gridColumnEnd: { cssProps: ['gridColumnEnd'], transform: 'identity' },
  gridRow: { cssProps: ['gridRow'], transform: 'identity' },
  gridRowStart: { cssProps: ['gridRowStart'], transform: 'identity' },
  gridRowEnd: { cssProps: ['gridRowEnd'], transform: 'identity' },
  alignSelf: { cssProps: ['alignSelf'], transform: 'identity' },
  justifySelf: { cssProps: ['justifySelf'], transform: 'identity' },

  // Box / Flex / Grid common
  display: { cssProps: ['display'], transform: 'identity' },

  // Flex container
  direction: { cssProps: ['flexDirection'], transform: 'identity' },
  align: { cssProps: ['alignItems'], transform: 'identity' },
  justify: { cssProps: ['justifyContent'], transform: 'justify' },
  wrap: { cssProps: ['flexWrap'], transform: 'identity' },

  // Grid container
  areas: { cssProps: ['gridTemplateAreas'], transform: 'identity' },
  columns: { cssProps: ['gridTemplateColumns'], transform: 'grid-template' },
  rows: { cssProps: ['gridTemplateRows'], transform: 'grid-template' },
  flow: { cssProps: ['gridAutoFlow'], transform: 'identity' },
  alignContent: { cssProps: ['alignContent'], transform: 'align-content' },
  justifyItems: { cssProps: ['justifyItems'], transform: 'identity' },

  // Gap (works for flex + grid)
  gap: { cssProps: ['gap'], transform: 'space' },
  gapX: { cssProps: ['columnGap'], transform: 'space' },
  gapY: { cssProps: ['rowGap'], transform: 'space' },
}

function applyTransform(rule: Rule, raw: string): string {
  switch (rule.transform) {
    case 'space':
      return spaceValue(raw)
    case 'grid-template':
      return gridTemplateValue(raw)
    case 'justify':
      return justifyValue(raw)
    case 'align-content':
      return alignContentValue(raw)
    default:
      return raw
  }
}

/** Camel-case → kebab-case (only for CSS property names we ourselves produce). */
function kebab(prop: string): string {
  return prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
}

function isResponsive(value: unknown): value is Partial<Record<Breakpoint, string>> {
  return typeof value === 'object' && value !== null
}

/**
 * Walks the provided props, separating layout props from passthrough props,
 * and returns an inline-style object plus optional per-breakpoint CSS.
 */
export function extractLayoutProps<P extends Record<string, unknown>>(
  props: P,
  ownPropKeys: ReadonlySet<string>,
): {
  rest: Record<string, unknown>
  baseStyle: React.CSSProperties
  /** Keyed by breakpoint; `initial` key holds base rules with no media query. */
  responsiveStyles: Partial<Record<Breakpoint, Record<string, string>>>
  hasResponsive: boolean
} {
  const rest: Record<string, unknown> = {}
  const baseStyle: Record<string, string> = {}
  const responsiveStyles: Partial<Record<Breakpoint, Record<string, string>>> = {}
  let hasResponsive = false

  for (const key in props) {
    const value = props[key]
    if (value === undefined || value === null) continue

    const rule = RULES[key]
    if (!rule || !ownPropKeys.has(key)) {
      rest[key] = value
      continue
    }

    if (isResponsive(value)) {
      const responsive = value as Partial<Record<Breakpoint, string>>
      // If any non-initial breakpoint is set, inline styles can't be overridden
      // by class-based media queries (specificity). Move the entire prop — including
      // the initial value — into the <style> block so the cascade works correctly.
      const hasBreakpoints = BREAKPOINT_ORDER.some(
        (bp) => bp !== 'initial' && responsive[bp] !== undefined,
      )

      if (hasBreakpoints) {
        hasResponsive = true
        for (const bp of BREAKPOINT_ORDER) {
          const v = responsive[bp]
          if (v === undefined) continue
          const cssValue = applyTransform(rule, v)
          const bucket = (responsiveStyles[bp] ??= {})
          for (const cssProp of rule.cssProps) bucket[kebab(cssProp)] = cssValue
        }
      } else {
        // Only `initial` — safe to use inline style.
        const v = responsive['initial']
        if (v !== undefined) {
          const cssValue = applyTransform(rule, v)
          for (const cssProp of rule.cssProps) baseStyle[cssProp] = cssValue
        }
      }
    } else if (typeof value === 'string') {
      const cssValue = applyTransform(rule, value)
      for (const cssProp of rule.cssProps) baseStyle[cssProp] = cssValue
    } else if (typeof value === 'number') {
      const cssValue = applyTransform(rule, String(value))
      for (const cssProp of rule.cssProps) baseStyle[cssProp] = cssValue
    }
  }

  return { rest, baseStyle: baseStyle as React.CSSProperties, responsiveStyles, hasResponsive }
}

/**
 * Deterministic hash of an object — used to generate a stable class name
 * so the same prop combination produces the same CSS on the server and
 * client (avoids hydration mismatches).
 */
export function hashStyles(input: unknown): string {
  const json = JSON.stringify(input)
  let hash = 5381
  for (let i = 0; i < json.length; i++) {
    hash = ((hash << 5) + hash) ^ json.charCodeAt(i)
  }
  // Force unsigned, base36.
  return (hash >>> 0).toString(36)
}

/**
 * Build the CSS text for a per-instance responsive style block.
 * The `initial` key (if present) renders as a bare rule with no media query,
 * so it can be overridden by the breakpoint rules that follow.
 */
export function buildResponsiveCss(
  className: string,
  responsiveStyles: Partial<Record<Breakpoint, Record<string, string>>>,
): string {
  const parts: string[] = []

  const initialDecls = responsiveStyles['initial']
  if (initialDecls) {
    const body = Object.entries(initialDecls).map(([k, v]) => `${k}:${v}`).join(';')
    if (body) parts.push(`.${className}{${body}}`)
  }

  for (const bp of ['xs', 'sm', 'md', 'lg', 'xl'] as const) {
    const decls = responsiveStyles[bp]
    if (!decls) continue
    const body = Object.entries(decls)
      .map(([k, v]) => `${k}:${v}`)
      .join(';')
    if (!body) continue
    parts.push(`@media (min-width: ${BREAKPOINTS[bp]}){.${className}{${body}}}`)
  }
  return parts.join('')
}

// Shared prop-key sets — declared here so each component imports the canonical list.

const MARGIN_KEYS = ['m', 'mx', 'my', 'mt', 'mr', 'mb', 'ml'] as const
const PADDING_KEYS = ['p', 'px', 'py', 'pt', 'pr', 'pb', 'pl'] as const
const WIDTH_KEYS = ['width', 'minWidth', 'maxWidth'] as const
const HEIGHT_KEYS = ['height', 'minHeight', 'maxHeight'] as const
const POSITION_KEYS = [
  'position',
  'inset',
  'top',
  'right',
  'bottom',
  'left',
  'overflow',
  'overflowX',
  'overflowY',
] as const
const FLEX_ITEM_KEYS = ['flexBasis', 'flexShrink', 'flexGrow'] as const
const GRID_ITEM_KEYS = [
  'gridArea',
  'gridColumn',
  'gridColumnStart',
  'gridColumnEnd',
  'gridRow',
  'gridRowStart',
  'gridRowEnd',
  'alignSelf',
  'justifySelf',
] as const

export const LAYOUT_KEYS = [
  ...MARGIN_KEYS,
  ...PADDING_KEYS,
  ...WIDTH_KEYS,
  ...HEIGHT_KEYS,
  ...POSITION_KEYS,
  ...FLEX_ITEM_KEYS,
  ...GRID_ITEM_KEYS,
] as const

export const BOX_OWN_KEYS = ['display', ...LAYOUT_KEYS] as const

export const FLEX_OWN_KEYS = [
  'display',
  'direction',
  'align',
  'justify',
  'wrap',
  'gap',
  'gapX',
  'gapY',
  ...LAYOUT_KEYS,
] as const

export const GRID_OWN_KEYS = [
  'display',
  'areas',
  'columns',
  'rows',
  'flow',
  'align',
  'justify',
  'alignContent',
  'justifyItems',
  'gap',
  'gapX',
  'gapY',
  ...LAYOUT_KEYS,
] as const

// Shared TypeScript prop types — exported for re-use in the components.

type ScaleNumber = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
type NegativeScale = '-1' | '-2' | '-3' | '-4' | '-5' | '-6' | '-7' | '-8' | '-9'

export type PaddingValue = ScaleNumber | (string & {})
export type MarginValue = ScaleNumber | NegativeScale | (string & {})
export type GapValue = ScaleNumber | (string & {})

export interface MarginProps {
  m?: Responsive<MarginValue>
  mx?: Responsive<MarginValue>
  my?: Responsive<MarginValue>
  mt?: Responsive<MarginValue>
  mr?: Responsive<MarginValue>
  mb?: Responsive<MarginValue>
  ml?: Responsive<MarginValue>
}

export interface PaddingProps {
  p?: Responsive<PaddingValue>
  px?: Responsive<PaddingValue>
  py?: Responsive<PaddingValue>
  pt?: Responsive<PaddingValue>
  pr?: Responsive<PaddingValue>
  pb?: Responsive<PaddingValue>
  pl?: Responsive<PaddingValue>
}

export interface WidthProps {
  width?: Responsive<string>
  minWidth?: Responsive<string>
  maxWidth?: Responsive<string>
}

export interface HeightProps {
  height?: Responsive<string>
  minHeight?: Responsive<string>
  maxHeight?: Responsive<string>
}

export interface PositionProps {
  position?: Responsive<'static' | 'relative' | 'absolute' | 'fixed' | 'sticky'>
  inset?: Responsive<MarginValue>
  top?: Responsive<MarginValue>
  right?: Responsive<MarginValue>
  bottom?: Responsive<MarginValue>
  left?: Responsive<MarginValue>
  overflow?: Responsive<'visible' | 'hidden' | 'clip' | 'scroll' | 'auto'>
  overflowX?: Responsive<'visible' | 'hidden' | 'clip' | 'scroll' | 'auto'>
  overflowY?: Responsive<'visible' | 'hidden' | 'clip' | 'scroll' | 'auto'>
}

export interface FlexItemProps {
  flexBasis?: Responsive<string>
  flexShrink?: Responsive<'0' | '1' | (string & {})>
  flexGrow?: Responsive<'0' | '1' | (string & {})>
}

export interface GridItemProps {
  gridArea?: Responsive<string>
  gridColumn?: Responsive<string>
  gridColumnStart?: Responsive<string>
  gridColumnEnd?: Responsive<string>
  gridRow?: Responsive<string>
  gridRowStart?: Responsive<string>
  gridRowEnd?: Responsive<string>
  alignSelf?: Responsive<'start' | 'center' | 'end' | 'baseline' | 'stretch'>
  justifySelf?: Responsive<'start' | 'center' | 'end' | 'baseline' | 'stretch'>
}

export interface LayoutProps
  extends MarginProps,
    PaddingProps,
    WidthProps,
    HeightProps,
    PositionProps,
    FlexItemProps,
    GridItemProps {}

export interface GapProps {
  gap?: Responsive<GapValue>
  gapX?: Responsive<GapValue>
  gapY?: Responsive<GapValue>
}
