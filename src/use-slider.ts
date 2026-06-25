'use client';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  getMaxIndex,
  getNearestPageIndex,
  getPaginationCount,
  getReachablePageCount,
  resolveNextIndex,
  resolveOptions,
  resolvePerStep,
} from './core';
import { createResponsiveStore } from './responsive-store';
import {
  NavigationAction,
  type SliderApi,
  type SliderContextValue,
  type SliderControl,
  type SliderOptions,
} from './types';

const FULL_VISIBILITY_TOLERANCE_PX = 1;
// Wait for scrolling to settle before emitting `moved`, so a smooth/drag scroll
// reports its final page once instead of bouncing through intermediate pages.
const SCROLL_SETTLE_MS = 120;

type UseSliderParams = {
  options: SliderOptions;
  pageCount: number;
  setPageCount: (n: number) => void;
  onMounted?: (api: SliderApi) => void;
  onDestroy?: () => void;
};

export function useSlider({
  options,
  pageCount,
  setPageCount,
  onMounted,
  onDestroy,
}: UseSliderParams): SliderContextValue {
  const store = useMemo(() => createResponsiveStore(), []);
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
  const movedListenersRef = useRef(new Set<(i: number) => void>());
  const [isLastChildVisible, setIsLastChildVisible] = useState(false);
  // Number of reachable snap positions, measured from layout (null until measured /
  // on the server). Pagination and bounds derive from this, not from perPage.
  const [reachableCount, setReachableCount] = useState<number | null>(null);

  const registerScrollElement = useCallback((el: HTMLDivElement | null) => {
    scrollElementRef.current = el;
  }, []);

  const measure = useCallback(() => {
    const scrollElement = scrollElementRef.current;
    const pages = scrollElement
      ? Array.from(scrollElement.querySelectorAll<HTMLElement>('[data-carousel-page="true"]'))
      : [];
    if (!scrollElement || !pages.length) {
      setReachableCount(null);
      return;
    }
    const offsets = pages.map((page) => page.offsetLeft);
    const maxScrollLeft = scrollElement.scrollWidth - scrollElement.clientWidth;
    setReachableCount(getReachablePageCount(offsets, maxScrollLeft));
  }, []);

  const emitMoved = useCallback((index: number) => {
    currentIndexRef.current = index;
    setCurrentIndex(index);
    for (const l of movedListenersRef.current) {
      l(index);
    }
  }, []);

  const goTo = useCallback(
    (control: SliderControl) => {
      const scrollElement = scrollElementRef.current;
      if (!scrollElement) {
        return;
      }
      const pageElements = Array.from(
        scrollElement.querySelectorAll<HTMLElement>('[data-carousel-page="true"]')
      );
      if (!pageElements.length) {
        return;
      }
      const maxScrollLeft = scrollElement.scrollWidth - scrollElement.clientWidth;
      const maxIndex =
        getReachablePageCount(
          pageElements.map((page) => page.offsetLeft),
          maxScrollLeft
        ) - 1;
      const perMove = resolvePerStep(resolvedOptions);
      const next = resolveNextIndex({ control, currentIndex: currentIndexRef.current, perMove });
      const clamped = Math.max(0, Math.min(next, maxIndex));
      if (clamped === currentIndexRef.current) {
        return;
      }
      // clamped is bounded by the reachable page count, so the target always exists.
      const target = pageElements[clamped];
      const targetStart = target.offsetLeft - scrollElement.offsetLeft;
      // The last reachable page scrolls flush to the end so trailing peeking
      // slides are fully revealed instead of being cut off at the snap point.
      const targetLeft = clamped >= maxIndex ? maxScrollLeft : Math.min(targetStart, maxScrollLeft);
      scrollElement.scrollTo({ behavior: 'smooth', left: targetLeft });
      emitMoved(clamped);
    },
    [emitMoved, resolvedOptions]
  );

  const prev = useCallback(() => goTo(NavigationAction.Prev), [goTo]);
  const next = useCallback(() => goTo(NavigationAction.Next), [goTo]);

  // Measure reachable snap positions on mount and whenever layout-affecting inputs
  // change (page count, options) or the container resizes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pageCount and resolvedOptions are re-measure triggers — the layout (and thus reachable count) changes when they change.
  useEffect(() => {
    measure();
    const scrollElement = scrollElementRef.current;
    if (!scrollElement || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(() => measure());
    observer.observe(scrollElement);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure, pageCount, resolvedOptions]);

  // scroll-sync: emit the settled page once scrolling stops (debounced), clamped to
  // the reachable range so trailing peeking slides map to the last reachable page.
  useEffect(() => {
    const scrollElement = scrollElementRef.current;
    if (!scrollElement) {
      return;
    }
    let settleTimer = 0;
    const handle = () => {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        const pages = Array.from(
          scrollElement.querySelectorAll<HTMLElement>('[data-carousel-page="true"]')
        );
        const nearest = getNearestPageIndex(pages, scrollElement.scrollLeft);
        if (nearest === null) {
          return;
        }
        const maxScrollLeft = scrollElement.scrollWidth - scrollElement.clientWidth;
        const maxIndex =
          getReachablePageCount(
            pages.map((page) => page.offsetLeft),
            maxScrollLeft
          ) - 1;
        const clamped = Math.min(nearest, Math.max(maxIndex, 0));
        if (clamped === currentIndexRef.current) {
          return;
        }
        emitMoved(clamped);
      }, SCROLL_SETTLE_MS);
    };
    scrollElement.addEventListener('scroll', handle, { passive: true });
    return () => {
      window.clearTimeout(settleTimer);
      scrollElement.removeEventListener('scroll', handle);
    };
  }, [emitMoved]);

  // last-child visibility
  // biome-ignore lint/correctness/useExhaustiveDependencies: pageCount is a re-run trigger — the last child element changes when the page count changes, so the effect must re-run to (re)observe it.
  useEffect(() => {
    const scrollElement = scrollElementRef.current;
    const lastChild = scrollElement?.lastElementChild;
    if (!scrollElement || !(lastChild instanceof HTMLElement)) {
      setIsLastChildVisible(false);
      return;
    }
    const update = () => {
      const root = scrollElement.getBoundingClientRect();
      const child = lastChild.getBoundingClientRect();
      setIsLastChildVisible(
        child.left >= root.left - FULL_VISIBILITY_TOLERANCE_PX &&
          child.right <= root.right + FULL_VISIBILITY_TOLERANCE_PX
      );
    };
    if (typeof IntersectionObserver === 'undefined') {
      update();
      scrollElement.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
      return () => {
        scrollElement.removeEventListener('scroll', update);
        window.removeEventListener('resize', update);
      };
    }
    const observer = new IntersectionObserver(
      ([entry]) => setIsLastChildVisible(entry.isIntersecting && entry.intersectionRatio >= 0.999),
      { root: scrollElement, threshold: 1 }
    );
    update();
    observer.observe(lastChild);
    return () => {
      observer.disconnect();
    };
  }, [pageCount]);

  // imperative api
  useEffect(() => {
    const listeners = movedListenersRef.current;
    const api: SliderApi = {
      destroy: () => listeners.clear(),
      get index() {
        return currentIndexRef.current;
      },
      go: goTo,
      on: (event, callback) => {
        if (event !== 'moved') {
          return () => {};
        }
        listeners.add(callback);
        return () => listeners.delete(callback);
      },
    };
    onMounted?.(api);
    return () => {
      api.destroy();
      onDestroy?.();
    };
  }, [goTo, onMounted, onDestroy]);

  const perStep = resolvePerStep(resolvedOptions);
  // Prefer measured reachable positions; fall back to option math before measurement / on the server.
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
