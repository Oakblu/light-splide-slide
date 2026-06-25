'use client';
import { type ReactNode, useEffect, useLayoutEffect, useRef } from 'react';
import { SliderContext } from '../slider-context';
import type { SliderApi, SliderOptions } from '../types';
import { useSlider } from '../use-slider';

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

  // Register the scroll element synchronously (layout phase) so that the event
  // listeners in useScrollSync / useReachableCount / useLastChildVisibility —
  // which fire in the subsequent effect phase — see a non-null scrollElementRef.
  useLayoutEffect(() => {
    const root = rootRef.current;
    // v8 ignore next 3 -- ref is always set before layout effects run; guard is defensive for the unmount edge case
    if (!root) {
      return;
    }
    const scroll = root.querySelector<HTMLDivElement>('[data-slider-scroll]');
    registerScrollElement(scroll);
  });

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

  return (
    <SliderContext.Provider value={ctx}>
      <div ref={rootRef} data-slider-runtime="" style={{ display: 'contents' }}>
        {children}
      </div>
    </SliderContext.Provider>
  );
}

export default SliderRuntime;
