import {
  NavigationAction,
  type SliderControl,
  type SliderGrid,
  type SliderOptions,
} from '../types';

export function getGridDimensions(grid?: SliderGrid) {
  const dimensions = grid?.dimensions;
  if (!dimensions?.length) {
    return null;
  }
  const columns = dimensions.reduce((sum, [, cols]) => sum + cols, 0);
  const rows = Math.max(...dimensions.map(([rowCount]) => rowCount));
  const itemsPerPage = dimensions.reduce((sum, [r, c]) => sum + r * c, 0);
  return { columns, itemsPerPage, rows };
}

export function getPaginationCount(options: SliderOptions, pageCount: number) {
  if (getGridDimensions(options.grid)) {
    return pageCount;
  }
  const perPage = options.perPage ?? 1;
  if (options.perMove && options.perMove > 1) {
    return Math.max(Math.ceil((pageCount - perPage) / options.perMove) + 1, 1);
  }
  return Math.max(pageCount - perPage + 1, 1);
}

export function getMaxIndex(options: SliderOptions, pageCount: number) {
  if (getGridDimensions(options.grid)) {
    return Math.max(pageCount - 1, 0);
  }
  return Math.max(pageCount - (options.perPage ?? 1), 0);
}

export function resolveNextIndex({
  control,
  currentIndex,
  perMove,
}: {
  control: SliderControl;
  currentIndex: number;
  perMove: number;
}) {
  if (typeof control === 'number') {
    return control;
  }
  if (control === NavigationAction.Next || control === '>') {
    return currentIndex + perMove;
  }
  if (control === NavigationAction.Prev || control === '<') {
    return currentIndex - perMove;
  }
  if (control.startsWith('+') || control.startsWith('-')) {
    return currentIndex + Number(control);
  }
  return Number(control);
}

// How many snap positions can actually be scrolled to. A page is reachable when
// its offset (relative to the first page) is within the container's max scroll.
// With slides narrower than the viewport (fixedWidth / peeking), the trailing
// pages share the end position, so the reachable count is fewer than the page
// count — this is what pagination and bounds must be based on, not perPage.
export function getReachablePageCount(
  pageOffsets: readonly number[],
  maxScrollLeft: number,
  tolerancePx = 1
) {
  if (!pageOffsets.length) {
    return 1;
  }
  const first = pageOffsets[0];
  let count = 0;
  for (const offset of pageOffsets) {
    if (offset - first <= maxScrollLeft + tolerancePx) {
      count++;
    }
  }
  return Math.max(count, 1);
}

export function getNearestPageIndex(
  pageElements: readonly Pick<HTMLElement, 'offsetLeft'>[],
  scrollLeft: number
) {
  if (!pageElements.length) {
    return null;
  }
  return pageElements.reduce((best, el, index) => {
    const bestDist = Math.abs(pageElements[best].offsetLeft - scrollLeft);
    const dist = Math.abs(el.offsetLeft - scrollLeft);
    return dist < bestDist ? index : best;
  }, 0);
}
