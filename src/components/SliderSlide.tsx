// src/components/SliderSlide.tsx
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { toCssUnit } from '../core';
import type { SliderInjectedOptions } from '../types';

type SliderSlideProps = HTMLAttributes<HTMLDivElement> &
  SliderInjectedOptions & { children?: ReactNode };

export function SliderSlide({
  className,
  style,
  children,
  __sliderOptions,
  ...rest
}: SliderSlideProps) {
  if (!__sliderOptions) {
    return (
      <div className={className} style={style} {...rest}>
        {children}
      </div>
    );
  }
  const fixedWidth = toCssUnit(__sliderOptions.fixedWidth);
  const gap = toCssUnit(__sliderOptions.gap) ?? '0px';
  // v8 ignore next -- perPage is always set by resolveOptions defaults; `?? 1` is unreachable
  const perPage = __sliderOptions.perPage ?? 1;
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
