'use client';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  getMaxIndex,
  getNearestPageIndex,
  getPaginationCount,
  resolveNextIndex,
  resolveOptions,
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
    () => resolveOptions(options ?? {}, viewportWidth),
    [options, viewportWidth]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);
  const scrollElementRef = useRef<HTMLDivElement | null>(null);
  const movedListenersRef = useRef(new Set<(i: number) => void>());
  const [isLastChildVisible, setIsLastChildVisible] = useState(false);

  const registerScrollElement = useCallback((el: HTMLDivElement | null) => {
    scrollElementRef.current = el;
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
      const maxIndex = getMaxIndex(resolvedOptions, pageCount);
      const perMove = resolvedOptions.grid ? 1 : resolvedOptions.perMove ?? 1;
      const next = resolveNextIndex({ control, currentIndex: currentIndexRef.current, perMove });
      const clamped = Math.max(0, Math.min(next, maxIndex));
      if (clamped === currentIndexRef.current) {
        return;
      }
      const target = pageElements[clamped];
      if (!target) {
        return;
      }
      scrollElement.scrollTo({ behavior: 'smooth', left: target.offsetLeft - scrollElement.offsetLeft });
      emitMoved(clamped);
    },
    [emitMoved, pageCount, resolvedOptions]
  );

  const prev = useCallback(() => goTo(NavigationAction.Prev), [goTo]);
  const next = useCallback(() => goTo(NavigationAction.Next), [goTo]);

  // scroll-sync
  useEffect(() => {
    const scrollElement = scrollElementRef.current;
    if (!scrollElement) {
      return;
    }
    let frame = 0;
    const handle = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const pages = Array.from(
          scrollElement.querySelectorAll<HTMLElement>('[data-carousel-page="true"]')
        );
        const nearest = getNearestPageIndex(pages, scrollElement.scrollLeft);
        if (nearest === null || nearest === currentIndexRef.current) {
          return;
        }
        emitMoved(nearest);
      });
    };
    scrollElement.addEventListener('scroll', handle, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      scrollElement.removeEventListener('scroll', handle);
    };
  }, [emitMoved, pageCount]);

  // last-child visibility
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

  const maxIndex = getMaxIndex(resolvedOptions, pageCount);
  const paginationCount = getPaginationCount(resolvedOptions, pageCount);
  const perStep = resolvedOptions.grid ? 1 : resolvedOptions.perMove ?? 1;
  const currentPageIndex =
    currentIndex >= maxIndex ? Math.max(paginationCount - 1, 0) : Math.floor(currentIndex / perStep);

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
