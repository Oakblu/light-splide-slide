'use client';
import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
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
import { createSliderStore } from './slider-store';
import type { SliderApi, SliderContextValue, SliderControl, SliderOptions } from './types';

type UseSliderParams = {
  options: SliderOptions;
  onMounted?: (api: SliderApi) => void;
  onDestroy?: () => void;
};

export function useSlider({ options, onMounted, onDestroy }: UseSliderParams): SliderContextValue {
  const store = useMemo(() => createSliderStore(), []);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const { currentIndex, pageCount, reachableCount, isLastChildVisible } = state;

  const breakpointWidths = useMemo(
    () => Object.keys(options.breakpoints ?? {}).map(Number),
    [options.breakpoints]
  );
  const responsiveStore = useMemo(
    () => createResponsiveStore(breakpointWidths, options.mediaQuery),
    [breakpointWidths, options.mediaQuery]
  );
  const viewportWidth = useSyncExternalStore(
    responsiveStore.subscribe,
    responsiveStore.getSnapshot,
    responsiveStore.getServerSnapshot
  );
  const resolvedOptions = useMemo(
    () => resolveOptions(options, viewportWidth),
    [options, viewportWidth]
  );

  const currentIndexRef = useRef(0);
  const scrollElementRef = useRef<HTMLDivElement | null>(null);
  const listenersRef = useRef(new Set<(i: number) => void>());

  const setPageCount = useCallback(
    (count: number) => store.setState({ pageCount: count }),
    [store]
  );
  const setReachableCount = useCallback(
    (count: number | null) => store.setState({ reachableCount: count }),
    [store]
  );
  const setIsLastChildVisible = useCallback(
    (visible: boolean) => store.setState({ isLastChildVisible: visible }),
    [store]
  );

  const registerScrollElement = useCallback((el: HTMLDivElement | null) => {
    scrollElementRef.current = el;
  }, []);

  const emitMoved = useCallback(
    (index: number) => {
      currentIndexRef.current = index;
      store.setState({ currentIndex: index });
      for (const l of listenersRef.current) {
        l(index);
      }
    },
    [store]
  );

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
      const isLoop = resolvedOptions.type === 'loop';
      let targetIndex: number;
      let scrollBehavior: ScrollBehavior;

      if (isLoop && next < 0) {
        targetIndex = maxIndex;
        scrollBehavior = 'instant';
      } else if (isLoop && next > maxIndex) {
        targetIndex = 0;
        scrollBehavior = 'instant';
      } else {
        targetIndex = Math.max(0, Math.min(next, maxIndex));
        scrollBehavior = 'smooth';
      }

      if (targetIndex === currentIndexRef.current) {
        return;
      }
      // targetIndex is bounded by [0, maxIndex] so pages[targetIndex] always exists.
      const target = pages[targetIndex];
      const targetStart = target.offsetLeft - scrollElement.offsetLeft;
      // When navigating to the last reachable page, scroll flush to the end so any trailing
      // peeking slides are fully revealed rather than cut off at their snap point.
      const targetLeft =
        targetIndex >= maxIndex ? maxScrollLeft : Math.min(targetStart, maxScrollLeft);
      scrollElement.scrollTo({ behavior: scrollBehavior, left: targetLeft });
      emitMoved(targetIndex);
    },
    [emitMoved, resolvedOptions]
  );

  const prev = useCallback(() => goTo('<'), [goTo]);
  const next = useCallback(() => goTo('>'), [goTo]);

  useReachableCount(scrollElementRef, pageCount, resolvedOptions, setReachableCount);
  useScrollSync(scrollElementRef, currentIndexRef, emitMoved);
  useLastChildVisibility(scrollElementRef, pageCount, setIsLastChildVisible);
  useImperativeApi(currentIndexRef, listenersRef, goTo, onMounted, onDestroy);

  const perStep = resolvePerStep(resolvedOptions);
  const maxIndex =
    reachableCount !== null ? reachableCount - 1 : getMaxIndex(resolvedOptions, pageCount);
  // For perStep=1 (fixedWidth/peeking), use reachableCount directly — trailing
  // positions that share the same scroll end must not each get a dot.
  // For perStep>1 (perMove>1), reachableCount counts individual slides, not
  // page groups, so getPaginationCount(pageCount) gives the correct grouping.
  const paginationCount =
    reachableCount !== null && perStep <= 1
      ? Math.max(reachableCount, 1)
      : getPaginationCount(resolvedOptions, pageCount);
  const currentPageIndex =
    currentIndex >= maxIndex
      ? Math.max(paginationCount - 1, 0)
      : Math.floor(currentIndex / perStep);

  return {
    canGoNext:
      resolvedOptions.type === 'loop'
        ? maxIndex > 0
        : currentIndex < maxIndex && !isLastChildVisible,
    canGoPrev: resolvedOptions.type === 'loop' ? maxIndex > 0 : currentIndex > 0,
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
