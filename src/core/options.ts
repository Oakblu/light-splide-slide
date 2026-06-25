import type { SliderGrid, SliderOptions, SliderPadding } from '../types';

export const DEFAULTS: SliderOptions = {
  arrows: true,
  drag: true,
  pagination: false,
  perMove: 1,
  perPage: 1,
  type: 'slide',
};

function mergePadding(
  base?: SliderPadding | number | string,
  override?: SliderPadding | number | string
): SliderPadding | undefined {
  if (base === undefined && override === undefined) {
    return undefined;
  }
  const nb = typeof base === 'object' ? base : { left: base, right: base };
  const no = typeof override === 'object' ? override : { left: override, right: override };
  // Override's specified sides win; unspecified sides fall back to base.
  return { ...nb, ...no };
}

function mergeGrid(base?: SliderGrid, override?: SliderGrid): SliderGrid | undefined {
  if (!base && !override) {
    return undefined;
  }
  return { ...base, ...override, gap: { ...base?.gap, ...override?.gap } };
}

export function mergeOptions(
  base: SliderOptions,
  override?: Partial<SliderOptions>
): SliderOptions {
  if (!override) {
    return base;
  }
  return {
    ...base,
    ...override,
    breakpoints: base.breakpoints,
    gap: override.gap ?? base.gap,
    grid: mergeGrid(base.grid, override.grid),
    padding: mergePadding(base.padding, override.padding),
  };
}

export function resolvePerStep(options: Pick<SliderOptions, 'grid' | 'perMove'>): number {
  return options.grid ? 1 : (options.perMove ?? 1);
}

export function resolveOptions(
  options: SliderOptions,
  viewportWidth: number | null
): SliderOptions {
  const base: SliderOptions = { ...DEFAULTS, ...options };
  const breakpoints = base.breakpoints;
  if (!breakpoints || viewportWidth === null) {
    return base;
  }
  const entries = Object.entries(breakpoints)
    .map(([w, v]) => [Number(w), v] as const)
    .sort(([a], [b]) => a - b);
  const mediaQuery = base.mediaQuery ?? 'max';
  return entries.reduce<SliderOptions>((resolved, [width, opts]) => {
    const apply = mediaQuery === 'min' ? viewportWidth >= width : viewportWidth <= width;
    return apply ? mergeOptions(resolved, opts) : resolved;
  }, base);
}
