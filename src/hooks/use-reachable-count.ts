'use client';
import { type RefObject, useCallback, useEffect } from 'react';
import { readPageGeometry } from '../page-geometry';
import type { SliderOptions } from '../types';

export function useReachableCount(
  scrollElementRef: RefObject<HTMLDivElement | null>,
  pageCount: number,
  resolvedOptions: SliderOptions,
  setReachableCount: (count: number | null) => void
): void {
  const measure = useCallback(() => {
    const scrollElement = scrollElementRef.current;
    if (!scrollElement) {
      setReachableCount(null);
      return;
    }
    const { pages, reachableCount: count } = readPageGeometry(scrollElement);
    setReachableCount(pages.length ? count : null);
  }, [scrollElementRef, setReachableCount]);

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
}
