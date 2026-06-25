'use client';
import { type RefObject, useEffect } from 'react';
import { getNearestPageIndex } from '../core';
import { readPageGeometry } from '../page-geometry';

// Wait for scrolling to settle before emitting `moved`, so a smooth/drag scroll
// reports its final page once instead of bouncing through intermediate pages.
const SCROLL_SETTLE_MS = 120;

export function useScrollSync(
  scrollElementRef: RefObject<HTMLDivElement | null>,
  currentIndexRef: RefObject<number>,
  emitMoved: (index: number) => void
): void {
  useEffect(() => {
    const scrollElement = scrollElementRef.current;
    if (!scrollElement) {
      return;
    }
    let settleTimer = 0;
    const handle = () => {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        const { pages, maxIndex } = readPageGeometry(scrollElement);
        const nearest = getNearestPageIndex(pages, scrollElement.scrollLeft);
        if (nearest === null) {
          return;
        }
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
  }, [scrollElementRef, currentIndexRef, emitMoved]);
}
