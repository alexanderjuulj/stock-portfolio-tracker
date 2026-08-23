import * as React from 'react'

import {
  buildResponsiveCss,
  extractLayoutProps,
  FLEX_OWN_KEYS,
  hashStyles,
  type GapProps,
  type LayoutProps,
  type MarginProps,
  type Responsive,
} from '@/lib/layoutProps'
import { cn } from '@/lib/utils'

type FlexAs = 'div' | 'span'
type FlexDisplay = 'none' | 'inline-flex' | 'flex'
type FlexDirection = 'row' | 'column' | 'row-reverse' | 'column-reverse'
type FlexAlign = 'start' | 'center' | 'end' | 'baseline' | 'stretch'
type FlexJustify = 'start' | 'center' | 'end' | 'between'
type FlexWrap = 'nowrap' | 'wrap' | 'wrap-reverse'

export interface FlexOwnProps {
  as?: FlexAs
  display?: Responsive<FlexDisplay>
  direction?: Responsive<FlexDirection>
  align?: Responsive<FlexAlign>
  justify?: Responsive<FlexJustify>
  wrap?: Responsive<FlexWrap>
}

interface CommonFlexProps extends MarginProps, LayoutProps, GapProps, FlexOwnProps {
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
}

type FlexDivProps = { as?: 'div' } & Omit<
  React.HTMLAttributes<HTMLDivElement>,
  keyof CommonFlexProps
>
type FlexSpanProps = { as: 'span' } & Omit<
  React.HTMLAttributes<HTMLSpanElement>,
  keyof CommonFlexProps
>

export type FlexProps = CommonFlexProps & (FlexDivProps | FlexSpanProps)

const OWN_KEYS = new Set<string>(FLEX_OWN_KEYS)

const Flex = React.forwardRef<HTMLElement, FlexProps>(function Flex(props, forwardedRef) {
  const { as: Tag = 'div', className, style, children, ...rest } = props as FlexProps & {
    as?: FlexAs
  }

  const { rest: passthrough, baseStyle, responsiveStyles, hasResponsive } = extractLayoutProps(
    rest as Record<string, unknown>,
    OWN_KEYS,
  )

  // Don't set inline display:flex when display is a responsive prop — it would
  // override the scoped <style> block since inline styles win the cascade.
  const responsiveHasDisplay =
    hasResponsive &&
    Object.values(responsiveStyles).some((bucket) => bucket && 'display' in bucket)

  const mergedStyle: React.CSSProperties = {
    ...(responsiveHasDisplay ? {} : { display: 'flex' }),
    ...baseStyle,
    ...style,
  }

  let responsiveClass: string | undefined
  let css: string | undefined
  if (hasResponsive) {
    responsiveClass = `klq-flex-${hashStyles(responsiveStyles)}`
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

export default Flex
