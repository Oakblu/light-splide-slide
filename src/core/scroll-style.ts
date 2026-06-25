import type { CSSProperties } from 'react';
import type { SliderOptions } from '../types';
import { toCssUnit } from './units';

export type ScrollStyleResult = {
  style: CSSProperties;
  cssVars: Record<`--${string}`, string>;
};

export function computeScrollStyle(options: SliderOptions): ScrollStyleResult {
  const gap = toCssUnit(options.gap) ?? '0px';
  const hasPadding = options.padding !== undefined;
  const pad =
    typeof options.padding === 'object'
      ? options.padding
      : { left: options.padding, right: options.padding };
  const paddingLeft = toCssUnit(pad?.left) ?? '0px';
  const paddingRight = toCssUnit(pad?.right) ?? '0px';

  const style: CSSProperties = {
    display: 'flex',
    scrollSnapType: 'x mandatory',
    overflowX: 'auto',
    overflowY: 'hidden',
    overscrollBehaviorX: 'contain',
    scrollbarWidth: 'none',
    scrollBehavior: 'smooth',
    gap,
    ...(hasPadding
      ? {
          paddingLeft,
          paddingRight,
          scrollPaddingLeft: paddingLeft,
          scrollPaddingRight: paddingRight,
        }
      : {}),
    ...(options.drag === false ? { touchAction: 'pan-y' } : {}),
  };

  const cssVars: Record<`--${string}`, string> = {
    '--slider-gap': gap,
    '--slider-padding-left': paddingLeft,
    '--slider-padding-right': paddingRight,
  };

  return { style, cssVars };
}
