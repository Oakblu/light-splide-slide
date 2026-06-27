export type ResponsiveStore = {
  subscribe: (callback: () => void) => () => void;
  getSnapshot: () => number | null;
  getServerSnapshot: () => number | null;
};

export function createResponsiveStore(
  breakpointWidths: readonly number[] = [],
  mediaQuery: 'max' | 'min' = 'max'
): ResponsiveStore {
  let cachedWidth: number | null = null;
  const readWidth = (): number => window.innerWidth;

  return {
    subscribe(callback: () => void): () => void {
      if (typeof window === 'undefined') {
        return () => {};
      }
      cachedWidth = readWidth();
      const handler = () => {
        cachedWidth = readWidth();
        callback();
      };
      const dir = mediaQuery === 'min' ? 'min-width' : 'max-width';
      const mqls = breakpointWidths.map((w) => window.matchMedia(`(${dir}: ${w}px)`));
      for (const mql of mqls) {
        mql.addEventListener('change', handler);
      }
      return () => {
        for (const mql of mqls) {
          mql.removeEventListener('change', handler);
        }
      };
    },
    getSnapshot(): number | null {
      if (typeof window === 'undefined') {
        return null;
      }
      if (cachedWidth === null) {
        cachedWidth = readWidth();
      }
      return cachedWidth;
    },
    getServerSnapshot(): number | null {
      return null;
    },
  };
}
