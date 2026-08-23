import * as React from 'react'

import {
  BOX_OWN_KEYS,
  buildResponsiveCss,
  extractLayoutProps,
  hashStyles,
  type LayoutProps,
  type MarginProps,
} from '@/lib/layoutProps'
import { cn } from '@/lib/utils'

import type { Responsive } from '@/lib/layoutProps'

type BoxAs = 'div' | 'span'
type BoxDisplay = 'none' | 'inline' | 'inline-block' | 'block' | 'contents'

export interface BoxOwnProps {
  as?: BoxAs
  display?: Responsive<BoxDisplay>
}

interface CommonBoxProps extends MarginProps, LayoutProps, BoxOwnProps {
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
}

type BoxDivProps = { as?: 'div' } & Omit<React.HTMLAttributes<HTMLDivElement>, keyof CommonBoxProps>
type BoxSpanProps = { as: 'span' } & Omit<React.HTMLAttributes<HTMLSpanElement>, keyof CommonBoxProps>

export type BoxProps = CommonBoxProps & (BoxDivProps | BoxSpanProps)

const OWN_KEYS = new Set<string>(BOX_OWN_KEYS)

const Box = React.forwardRef<HTMLElement, BoxProps>(function Box(props, forwardedRef) {
  const { as: Tag = 'div', className, style, children, ...rest } = props as BoxProps & {
    as?: BoxAs
  }

  const { rest: passthrough, baseStyle, responsiveStyles, hasResponsive } = extractLayoutProps(
    rest as Record<string, unknown>,
    OWN_KEYS,
  )

  const mergedStyle: React.CSSProperties = { ...baseStyle, ...style }

  let responsiveClass: string | undefined
  let css: string | undefined
  if (hasResponsive) {
    responsiveClass = `klq-box-${hashStyles(responsiveStyles)}`
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

export default Box
