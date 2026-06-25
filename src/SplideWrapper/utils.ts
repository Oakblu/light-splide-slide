import type { CarouselGrid, CarouselOptions, CarouselPadding } from '../carousel-context';
import { type CarouselControl, CarouselNavigationAction } from './types';

export function toCssUnit(value?: number | string) {
  if (value === undefined) {
    return undefined;
  }

  return typeof value === 'number' ? `${value}px` : value;
}

function mergePadding(
  basePadding?: CarouselPadding | number | string,
  overridePadding?: CarouselPadding | number | string
): CarouselPadding | undefined {
  const normalizedBasePadding =
    typeof basePadding === 'object' ? basePadding : { left: basePadding, right: basePadding };
  const normalizedOverridePadding =
    typeof overridePadding === 'object'
      ? overridePadding
      : { left: overridePadding, right: overridePadding };

  if (!basePadding && !overridePadding) {
    return undefined;
  }

  return {
    ...normalizedBasePadding,
    ...normalizedOverridePadding,
  };
}

function mergeGrid(baseGrid?: CarouselGrid, overrideGrid?: CarouselGrid): CarouselGrid | undefined {
  if (!baseGrid && !overrideGrid) {
    return undefined;
  }

  return {
    ...baseGrid,
    ...overrideGrid,
    gap: {
      ...baseGrid?.gap,
      ...overrideGrid?.gap,
    },
  };
}

function mergeOptions(
  baseOptions: CarouselOptions,
  overrideOptions?: Partial<CarouselOptions>
): CarouselOptions {
  if (!overrideOptions) {
    return baseOptions;
  }

  return {
    ...baseOptions,
    ...overrideOptions,
    breakpoints: baseOptions.breakpoints,
    gap: overrideOptions.gap ?? baseOptions.gap,
    grid: mergeGrid(baseOptions.grid, overrideOptions.grid),
    padding: mergePadding(baseOptions.padding, overrideOptions.padding),
  };
}

export function resolveOptions(
  options: CarouselOptions,
  viewportWidth: number | null
): CarouselOptions {
  // Centralize defaults here so every consumer reads from one resolved options object.
  const baseOptions: CarouselOptions = {
    arrows: true,
    drag: true,
    pagination: false,
    perMove: 1,
    perPage: 1,
    type: 'slide' as const,
    ...options,
  };

  const breakpoints = baseOptions.breakpoints;
  if (!breakpoints || viewportWidth === null) {
    return baseOptions;
  }

  const entries = Object.entries(breakpoints)
    .map(([width, value]) => [Number(width), value] as const)
    .sort(([left], [right]) => left - right);

  const mediaQuery = baseOptions.mediaQuery ?? 'max';

  // Apply breakpoint overrides in order, keeping nested padding/grid merges predictable.
  return entries.reduce<CarouselOptions>((resolved, [breakpointWidth, breakpointOptions]) => {
    const shouldApply =
      mediaQuery === 'min' ? viewportWidth >= breakpointWidth : viewportWidth <= breakpointWidth;

    return shouldApply ? mergeOptions(resolved, breakpointOptions) : resolved;
  }, baseOptions);
}

export function getGridDimensions(grid?: CarouselGrid) {
  const dimensions = grid?.dimensions;
  if (!dimensions?.length) {
    return null;
  }

  const columns = dimensions.reduce((sum, [, cols]) => sum + cols, 0);
  const rows = Math.max(...dimensions.map(([rowCount]) => rowCount));
  const itemsPerPage = dimensions.reduce(
    (sum, [rowCount, colCount]) => sum + rowCount * colCount,
    0
  );

  return {
    columns,
    itemsPerPage,
    rows,
  };
}

export function getPaginationCount(options: CarouselOptions, pageCount: number) {
  const gridDimensions = getGridDimensions(options.grid);
  if (gridDimensions) {
    return pageCount;
  }

  const perPage = options.perPage ?? 1;
  if (options.perMove && options.perMove > 1) {
    return Math.max(Math.ceil((pageCount - perPage) / options.perMove) + 1, 1);
  }

  return Math.max(pageCount - perPage + 1, 1);
}

export function getMaxIndex(options: CarouselOptions, pageCount: number) {
  const gridDimensions = getGridDimensions(options.grid);
  if (gridDimensions) {
    return Math.max(pageCount - 1, 0);
  }

  return Math.max(pageCount - (options.perPage ?? 1), 0);
}

export function resolveNextIndex({
  control,
  currentIndex,
  perMove,
}: {
  control: CarouselControl;
  currentIndex: number;
  perMove: number;
}) {
  if (typeof control === 'number') {
    return control;
  }

  if (control === CarouselNavigationAction.Next || control === '>') {
    return currentIndex + perMove;
  }

  if (control === CarouselNavigationAction.Prev || control === '<') {
    return currentIndex - perMove;
  }

  if (control.startsWith('+') || control.startsWith('-')) {
    return currentIndex + Number(control);
  }

  return Number(control);
}

export function getNearestPageIndex(pageElements: HTMLElement[], scrollLeft: number) {
  if (!pageElements.length) {
    return null;
  }

  return pageElements.reduce((bestIndex, element, index) => {
    const bestDistance = Math.abs(pageElements[bestIndex].offsetLeft - scrollLeft);
    const currentDistance = Math.abs(element.offsetLeft - scrollLeft);

    return currentDistance < bestDistance ? index : bestIndex;
  }, 0);
}
