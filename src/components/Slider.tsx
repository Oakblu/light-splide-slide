'use client';
import { useState } from 'react';
import { SliderContext } from '../slider-context';
import type { SliderProps } from '../types';
import { useSlider } from '../use-slider';

export function Slider({
  options,
  className,
  style,
  'aria-label': ariaLabel,
  children,
  onMounted,
  onDestroy,
  ...rest
}: SliderProps) {
  const [pageCount, setPageCount] = useState(0);
  const ctx = useSlider({
    options: options ?? {},
    pageCount,
    setPageCount,
    onMounted,
    onDestroy,
  });
  return (
    <SliderContext.Provider value={ctx}>
      <section
        aria-label={ariaLabel}
        className={className}
        style={{ position: 'relative', ...style }}
        {...rest}
      >
        {children}
      </section>
    </SliderContext.Provider>
  );
}

export default Slider;
