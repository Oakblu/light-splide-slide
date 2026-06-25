'use client';
import { Children, cloneElement, isValidElement } from 'react';
import { resolveOptions } from '../core';
import type { SliderInjectedOptions, SliderOptions, SliderProps } from '../types';
import { SliderRuntime } from './SliderRuntime';
import { SliderTrack } from './SliderTrack';

function injectIntoTrack(children: SliderProps['children'], options: SliderOptions) {
  return Children.map(children, (child) => {
    if (isValidElement<SliderInjectedOptions>(child) && child.type === SliderTrack) {
      const injected: SliderInjectedOptions = { __sliderOptions: options };
      return cloneElement(child, injected);
    }
    return child;
  });
}

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
  const resolved = resolveOptions(options ?? {}, null);
  return (
    <section
      aria-label={ariaLabel}
      className={className}
      style={{ position: 'relative', ...style }}
      {...rest}
    >
      <SliderRuntime options={options ?? {}} onMounted={onMounted} onDestroy={onDestroy}>
        {injectIntoTrack(children, resolved)}
      </SliderRuntime>
    </section>
  );
}

export default Slider;
