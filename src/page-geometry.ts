import { getReachablePageCount } from './core';

export type PageGeometry = {
  pages: HTMLElement[];
  maxScrollLeft: number;
  reachableCount: number;
  maxIndex: number;
};

// Single source of truth for reading snap-page layout off the scroll container.
export function readPageGeometry(scrollElement: HTMLElement): PageGeometry {
  const pages = Array.from(
    scrollElement.querySelectorAll<HTMLElement>('[data-carousel-page="true"]')
  );
  const offsets = pages.map((page) => page.offsetLeft);
  const maxScrollLeft = scrollElement.scrollWidth - scrollElement.clientWidth;
  const reachableCount = getReachablePageCount(offsets, maxScrollLeft);
  return { pages, maxScrollLeft, reachableCount, maxIndex: reachableCount - 1 };
}
