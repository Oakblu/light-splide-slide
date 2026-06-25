'use client';
import { type ReactNode, useEffect, useRef } from 'react';
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

  // Measure the DOM after every render: register the scroll element and report the
  // current page count. Both are idempotent (registerScrollElement stores a ref;
  // setPageCount dedups in the store), so re-running on each render is safe and keeps
  // the count correct when children change.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const scroll = root.querySelector<HTMLDivElement>('[data-slider-scroll]');
    registerScrollElement(scroll);
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
