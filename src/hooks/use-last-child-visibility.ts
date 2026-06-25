'use client';
import { type RefObject, useEffect, useState } from 'react';

const FULL_VISIBILITY_TOLERANCE_PX = 1;

export function useLastChildVisibility(
  scrollElementRef: RefObject<HTMLDivElement | null>,
  pageCount: number
): boolean {
  const [isLastChildVisible, setIsLastChildVisible] = useState(false);

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
  }, [scrollElementRef, pageCount]);

  return isLastChildVisible;
}
