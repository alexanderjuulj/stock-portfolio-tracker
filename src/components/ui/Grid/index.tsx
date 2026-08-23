import * as React from 'react'

import {
  buildResponsiveCss,
  extractLayoutProps,
  GRID_OWN_KEYS,
  hashStyles,
  type GapProps,
  type LayoutProps,
  type MarginProps,
  type Responsive,
} from '@/lib/layoutProps'
import { cn } from '@/lib/utils'

type GridAs = 'div' | 'span'
type GridDisplay = 'none' | 'inline-grid' | 'grid'
type GridFlow = 'row' | 'column' | 'dense' | 'row-dense' | 'column-dense'
type GridAlign = 'start' | 'center' | 'end' | 'baseline' | 'stretch'
type GridJustify = 'start' | 'center' | 'end' | 'between'
type GridAlignContent =
  | 'start'
  | 'center'
  | 'end'
  | 'baseline'
  | 'between'
  | 'around'
  | 'evenly'
  | 'stretch'
type GridJustifyItems = 'start' | 'center' | 'end' | 'baseline' | 'stretch'

export interface GridOwnProps {
  as?: GridAs
  display?: Responsive<GridDisplay>
  areas?: Responsive<string>
  /** Numeric strings ("1".."9") render as `repeat(N, minmax(0, 1fr))`. */
  columns?: Responsive<'1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | (string & {})>
  rows?: Responsive<'1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | (string & {})>
  flow?: Responsive<GridFlow>
  align?: Responsive<GridAlign>
  justify?: Responsive<GridJustify>
  alignContent?: Responsive<GridAlignContent>
  justifyItems?: Responsive<GridJustifyItems>
}

interface CommonGridProps extends MarginProps, LayoutProps, GapProps, GridOwnProps {
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
}

type GridDivProps = { as?: 'div' } & Omit<
  React.HTMLAttributes<HTMLDivElement>,
  keyof CommonGridProps
>
type GridSpanProps = { as: 'span' } & Omit<
  React.HTMLAttributes<HTMLSpanElement>,
  keyof CommonGridProps
>

export type GridProps = CommonGridProps & (GridDivProps | GridSpanProps)

const OWN_KEYS = new Set<string>(GRID_OWN_KEYS)

const Grid = React.forwardRef<HTMLElement, GridProps>(function Grid(props, forwardedRef) {
  const { as: Tag = 'div', className, style, children, ...rest } = props as GridProps & {
    as?: GridAs
  }

  const { rest: passthrough, baseStyle, responsiveStyles, hasResponsive } = extractLayoutProps(
    rest as Record<string, unknown>,
    OWN_KEYS,
  )

  // Default display: grid (unless caller overrode via display prop).
  const mergedStyle: React.CSSProperties = {
    display: 'grid',
    ...baseStyle,
    ...style,
  }

  let responsiveClass: string | undefined
  let css: string | undefined
  if (hasResponsive) {
    responsiveClass = `klq-grid-${hashStyles(responsiveStyles)}`
    css = buildResponsiveCss(responsiveClass, responsiveStyles)
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

export default Grid
