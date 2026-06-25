import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { CarouselOptions } from '../carousel-context';
import {
  type CarouselControl,
  CarouselNavigationAction,
  type SplideImperativeApi,
} from './types';
import { getMaxIndex, getNearestPageIndex, resolveNextIndex } from './utils';

const FULL_VISIBILITY_TOLERANCE_PX = 1;

type UseViewportWidthOptions = {
  enabled?: boolean;
};

export function useViewportWidth({ enabled = true }: UseViewportWidthOptions = {}) {
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [enabled]);

  return viewportWidth;
}

type UseCarouselControllerParams = {
  pageCount: number;
  resolvedOptions: CarouselOptions;
};

export function useCarouselController({ pageCount, resolvedOptions }: UseCarouselControllerParams) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement | null>(null);
  const currentIndexRef = useRef(0);
  const movedListenersRef = useRef(new Set<(newIndex: number) => void>());

  const registerScrollElement = useCallback((element: HTMLDivElement | null) => {
    scrollElementRef.current = element;
  }, []);

  const emitMoved = useCallback((index: number) => {
    currentIndexRef.current = index;
    setCurrentIndex(index);
    movedListenersRef.current.forEach((listener) => {
      listener(index);
    });
  }, []);

  const goTo = useCallback(
    (control: CarouselControl) => {
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
      const perMove = resolvedOptions.grid ? 1 : (resolvedOptions.perMove ?? 1);
      const nextIndex = resolveNextIndex({
        control,
        currentIndex: currentIndexRef.current,
        perMove,
      });
      const clampedIndex = Math.max(0, Math.min(nextIndex, maxIndex));

      if (clampedIndex === currentIndexRef.current) {
        return;
      }

      const targetElement = pageElements[clampedIndex];

      if (!targetElement) {
        return;
      }

      scrollElement.scrollTo({
        behavior: 'smooth',
        left: targetElement.offsetLeft - scrollElement.offsetLeft,
      });
    },
    [pageCount, resolvedOptions]
  );

  const prev = useCallback(() => goTo(CarouselNavigationAction.Prev), [goTo]);
  const next = useCallback(() => goTo(CarouselNavigationAction.Next), [goTo]);

  return {
    currentIndex,
    currentIndexRef,
    emitMoved,
    goTo,
    movedListenersRef,
    next,
    prev,
    registerScrollElement,
    scrollElementRef,
  };
}

type UseLastChildVisibilityParams = {
  pageCount: number;
  scrollElementRef: RefObject<HTMLDivElement | null>;
};

export function useCarouselLastChildVisibility({
  pageCount,
  scrollElementRef,
}: UseLastChildVisibilityParams) {
  const [isLastChildVisible, setIsLastChildVisible] = useState(false);

  useEffect(() => {
    const scrollElement = scrollElementRef.current;
    const lastChild = scrollElement?.lastElementChild;

    if (!scrollElement || !(lastChild instanceof HTMLElement)) {
      setIsLastChildVisible(false);
      return;
    }

    const updateLastChildVisibility = () => {
      const rootRect = scrollElement.getBoundingClientRect();
      const childRect = lastChild.getBoundingClientRect();

      setIsLastChildVisible(
        childRect.left >= rootRect.left - FULL_VISIBILITY_TOLERANCE_PX &&
          childRect.right <= rootRect.right + FULL_VISIBILITY_TOLERANCE_PX
      );
    };

    if (typeof IntersectionObserver === 'undefined') {
      updateLastChildVisibility();
      scrollElement.addEventListener('scroll', updateLastChildVisibility, { passive: true });
      window.addEventListener('resize', updateLastChildVisibility);

      return () => {
        scrollElement.removeEventListener('scroll', updateLastChildVisibility);
        window.removeEventListener('resize', updateLastChildVisibility);
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsLastChildVisible(entry.isIntersecting && entry.intersectionRatio >= 0.999);
      },
      {
        root: scrollElement,
        threshold: 1,
      }
    );

    updateLastChildVisibility();
    observer.observe(lastChild);
    scrollElement.addEventListener('scroll', updateLastChildVisibility, { passive: true });
    window.addEventListener('resize', updateLastChildVisibility);

    return () => {
      observer.disconnect();
      scrollElement.removeEventListener('scroll', updateLastChildVisibility);
      window.removeEventListener('resize', updateLastChildVisibility);
    };
  }, [pageCount, scrollElementRef]);

  return isLastChildVisible;
}

type UseScrollSyncParams = {
  emitMoved: (index: number) => void;
  pageCount: number;
  scrollElementRef: RefObject<HTMLDivElement | null>;
  currentIndexRef: RefObject<number>;
};

export function useCarouselScrollSync({
  emitMoved,
  pageCount,
  scrollElementRef,
  currentIndexRef,
}: UseScrollSyncParams) {
  useEffect(() => {
    const scrollElement = scrollElementRef.current;
    if (!scrollElement) {
      return;
    }

    let frameId = 0;

    const handleScroll = () => {
      cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const pageElements = Array.from(
          scrollElement.querySelectorAll<HTMLElement>('[data-carousel-page="true"]')
        );
        const nearestIndex = getNearestPageIndex(pageElements, scrollElement.scrollLeft);
        if (nearestIndex === null) {
          return;
        }

        if (nearestIndex === currentIndexRef.current) {
          return;
        }

        emitMoved(nearestIndex);
      });
    };

    scrollElement.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      cancelAnimationFrame(frameId);
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, [currentIndexRef, emitMoved, pageCount, scrollElementRef]);
}

type UseImperativeApiParams = {
  currentIndexRef: RefObject<number>;
  goTo: (control: CarouselControl) => void;
  movedListenersRef: RefObject<Set<(newIndex: number) => void>>;
  onDestroy?: () => void;
  onMounted?: (splide: SplideImperativeApi) => void;
};

export function useSplideImperativeApi({
  currentIndexRef,
  goTo,
  movedListenersRef,
  onDestroy,
  onMounted,
}: UseImperativeApiParams) {
  useEffect(() => {
    const api: SplideImperativeApi = {
      destroy: () => {
        movedListenersRef.current.clear();
      },
      get index() {
        return currentIndexRef.current;
      },
      go: goTo,
      on: (event: string, callback: (newIndex: number) => void) => {
        if (event !== 'moved') {
          return () => {};
        }

        movedListenersRef.current.add(callback);

        return () => {
          movedListenersRef.current.delete(callback);
        };
      },
    };

    onMounted?.(api);

    return () => {
      api.destroy();
      onDestroy?.();
    };
  }, [currentIndexRef, goTo, movedListenersRef, onDestroy, onMounted]);
}
