'use client';
import { Children, cloneElement, isValidElement, type ReactNode, useEffect, useRef } from 'react';
import { computeScrollStyle } from '../core';
import { useIsomorphicLayoutEffect } from '../hooks/use-isomorphic-layout-effect';
import { SliderContext } from '../slider-context';
import type { SliderApi, SliderInjectedOptions, SliderOptions } from '../types';
import { useSlider } from '../use-slider';
import { SliderTrack } from './SliderTrack';

type SliderRuntimeProps = {
  options: SliderOptions;
  onMounted?: (api: SliderApi) => void;
  onDestroy?: () => void;
  children?: ReactNode;
};

export function SliderRuntime({ options, onMounted, onDestroy, children }: SliderRuntimeProps) {
  const ctx = useSlider({ options, onMounted, onDestroy });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { registerScrollElement, setPageCount } = ctx;
  const resolvedOptions = ctx.options;

  // Register the scroll element synchronously (layout phase) so that the event
  // listeners in useScrollSync / useReachableCount / useLastChildVisibility —
  // which fire in the subsequent effect phase — see a non-null scrollElementRef.
  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current;
    // v8 ignore next 3 -- ref is always set before layout effects run; guard is defensive for the unmount edge case
    if (!root) {
      return;
    }
    const scroll = root.querySelector<HTMLDivElement>('[data-slider-scroll]');
    registerScrollElement(scroll);
  }, [registerScrollElement]);

  // Measure the DOM after every render: report the current page count. This is
  // idempotent (setPageCount dedups in the store), so re-running on each render is
  // safe and keeps the count correct when children change.
  useEffect(() => {
    const root = rootRef.current;
    // v8 ignore next 3 -- ref is always set before effects run; guard is defensive for the unmount edge case
    if (!root) {
      return;
    }
    setPageCount(root.querySelectorAll('[data-carousel-page]').length);
  });

  // Responsive: when resolved options change across a breakpoint on the client, re-apply
  // the scroll container's style + custom properties (the server rendered base options).
  useEffect(() => {
    const root = rootRef.current;
    const scroll = root?.querySelector<HTMLDivElement>('[data-slider-scroll]');
    if (!scroll) {
      return;
    }
    const { style, cssVars } = computeScrollStyle(resolvedOptions);
    for (const [key, value] of Object.entries(style)) {
      scroll.style.setProperty(camelToKebab(key), String(value));
    }
    for (const [key, value] of Object.entries(cssVars)) {
      scroll.style.setProperty(key, value);
    }
  }, [resolvedOptions]);

  // Re-inject resolvedOptions into SliderTrack on every render so slides get the
  // correct perPage/gap/etc. when a breakpoint fires after the initial server render.
  // Slider injected base options (null viewport); this overrides them with the live ones.
  const injectedChildren = Children.map(children, (child) => {
    if (isValidElement<SliderInjectedOptions>(child) && child.type === SliderTrack) {
      return cloneElement(child, { __sliderOptions: resolvedOptions });
    }
    return child;
  });

  return (
    <SliderContext.Provider value={ctx}>
      <div ref={rootRef} data-slider-runtime="" style={{ display: 'contents' }}>
        {injectedChildren}
      </div>
    </SliderContext.Provider>
  );
}

function camelToKebab(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

export default SliderRuntime;
