'use client';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { toCssUnit } from '../core';
import { useSliderContext } from '../slider-context';

export function SliderSlide({
  className,
  style,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
  const carousel = useSliderContext();
  if (!carousel) {
    return (
      <div className={className} style={style} {...rest}>
        {children}
      </div>
    );
  }
  const fixedWidth = toCssUnit(carousel.options.fixedWidth);
  const gap = toCssUnit(carousel.options.gap) ?? '0px';
  const perPage = carousel.options.perPage ?? 1;
  const width = fixedWidth
    ? fixedWidth
    : `calc((100% - (${gap} * ${Math.max(perPage - 1, 0)})) / ${perPage})`;
  const slideStyle: CSSProperties = {
    minWidth: 0,
    flexShrink: 0,
    scrollSnapAlign: 'start',
    width,
    ...style,
  };
  return (
    <div className={className} style={slideStyle} {...rest}>
      {children}
    </div>
  );
}

export default SliderSlide;
