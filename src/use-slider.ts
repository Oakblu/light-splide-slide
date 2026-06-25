'use client';
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  getMaxIndex,
  getPaginationCount,
  resolveNextIndex,
  resolveOptions,
  resolvePerStep,
} from './core';
import { useImperativeApi } from './hooks/use-imperative-api';
import { useLastChildVisibility } from './hooks/use-last-child-visibility';
import { useReachableCount } from './hooks/use-reachable-count';
import { useScrollSync } from './hooks/use-scroll-sync';
import { readPageGeometry } from './page-geometry';
import { createResponsiveStore } from './responsive-store';
import type { SliderApi, SliderContextValue, SliderControl, SliderOptions } from './types';

type UseSliderParams = {
  options: SliderOptions;
  onMounted?: (api: SliderApi) => void;
  onDestroy?: () => void;
};

export function useSlider({ options, onMounted, onDestroy }: UseSliderParams): SliderContextValue {
  const [pageCount, setPageCount] = useState(0);
  const breakpointWidths = useMemo(
    () => Object.keys(options.breakpoints ?? {}).map(Number),
    [options.breakpoints]
  );
  const store = useMemo(
    () => createResponsiveStore(breakpointWidths, options.mediaQuery),
    [breakpointWidths, options.mediaQuery]
  );
  const viewportWidth = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );
  const resolvedOptions = useMemo(
    () => resolveOptions(options, viewportWidth),
    [options, viewportWidth]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);
  const scrollElementRef = useRef<HTMLDivElement | null>(null);
  const listenersRef = useRef(new Set<(i: number) => void>());

  const registerScrollElement = useCallback((el: HTMLDivElement | null) => {
    scrollElementRef.current = el;
  }, []);

  const emitMoved = useCallback((index: number) => {
    currentIndexRef.current = index;
    setCurrentIndex(index);
    for (const l of listenersRef.current) {
      l(index);
    }
  }, []);

  const goTo = useCallback(
    (control: SliderControl) => {
      const scrollElement = scrollElementRef.current;
      if (!scrollElement) {
        return;
      }
      const { pages, maxScrollLeft, maxIndex } = readPageGeometry(scrollElement);
      if (!pages.length) {
        return;
      }
      const perMove = resolvePerStep(resolvedOptions);
      const next = resolveNextIndex({ control, currentIndex: currentIndexRef.current, perMove });
      const clamped = Math.max(0, Math.min(next, maxIndex));
      if (clamped === currentIndexRef.current) {
        return;
      }
      // `clamped` is bounded by maxIndex (the last reachable page), so pages[clamped] always exists.
      const target = pages[clamped];
      const targetStart = target.offsetLeft - scrollElement.offsetLeft;
      // When navigating to the last reachable page, scroll flush to the end so any trailing
      // peeking slides are fully revealed rather than cut off at their snap point.
      const targetLeft = clamped >= maxIndex ? maxScrollLeft : Math.min(targetStart, maxScrollLeft);
      scrollElement.scrollTo({ behavior: 'smooth', left: targetLeft });
      emitMoved(clamped);
    },
    [emitMoved, resolvedOptions]
  );

  const prev = useCallback(() => goTo('<'), [goTo]);
  const next = useCallback(() => goTo('>'), [goTo]);

  const reachableCount = useReachableCount(scrollElementRef, pageCount, resolvedOptions);
  useScrollSync(scrollElementRef, currentIndexRef, emitMoved);
  const isLastChildVisible = useLastChildVisibility(scrollElementRef, pageCount);
  useImperativeApi(currentIndexRef, listenersRef, goTo, onMounted, onDestroy);

  const perStep = resolvePerStep(resolvedOptions);
  const maxIndex =
    reachableCount !== null ? reachableCount - 1 : getMaxIndex(resolvedOptions, pageCount);
  const paginationCount =
    reachableCount !== null
      ? Math.max(Math.ceil(reachableCount / perStep), 1)
      : getPaginationCount(resolvedOptions, pageCount);
  const currentPageIndex =
    currentIndex >= maxIndex
      ? Math.max(paginationCount - 1, 0)
      : Math.floor(currentIndex / perStep);

  return {
    canGoNext: currentIndex < maxIndex && !isLastChildVisible,
    canGoPrev: currentIndex > 0,
    currentIndex,
    currentPageIndex,
    goTo,
    next,
    options: resolvedOptions,
    pageCount,
    paginationCount,
    prev,
    registerScrollElement,
    setPageCount,
  };
}
