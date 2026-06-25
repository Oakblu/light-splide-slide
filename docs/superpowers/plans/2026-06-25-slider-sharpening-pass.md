# Slider Sharpening Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `light-splide-slide` lighter, more maintainable, easier to use, and faster to render by decomposing the controller, switching resize tracking to `matchMedia`, tightening the public API, adding a bundle-size gate, and making the `drag` option real — without changing its headless, SSR-safe, native-scroll-snap nature.

**Architecture:** Strict dependency direction stays `core (pure) → controller (use-slider) → components`. Phase B extracts a single DOM geometry reader and four focused effect-hooks out of the 272-line `use-slider.ts`. Phase A replaces the raw-`innerWidth` store with a `matchMedia`-backed store that only notifies on breakpoint crossings. Phase C removes leaked params and dead options. Phase D adds `size-limit`. Phase E wires `touch-action`.

**Tech Stack:** React 19, TypeScript, Vitest (node + browser/Chromium projects), Biome, tsup, size-limit.

## Global Constraints

- **TDD-first:** failing test → run-fail → minimal impl → run-pass → commit. No exceptions.
- **No `any`, no `unknown`, no type assertions (`as`, `<T>x`), no non-null `!`** — in source AND tests. `as const` is the only allowed assertion. Use type annotations, user-defined type guards, `satisfies`, ISP-narrowed parameter types, and the typed `querySelector<T>()` form. Biome errors on `noExplicitAny`/`noNonNullAssertion`.
- **Coverage ≥99%** (lines/statements/functions/branches) — enforced in `vitest.config.ts`. Must stay green at every commit.
- **SSR:** never read `window`/`document` during render.
- **Test placement:** pure logic → `src/**/*.test.ts` (node project). DOM/geometry/matchMedia → `src/**/*.browser.test.tsx` (browser project, Chromium).
- **No hard-coded colors; never require a styling system.**
- **Lint command:** use `./node_modules/.bin/biome check .` directly (the `pnpm lint` script may be hijacked by an RTK proxy locally). CI uses the real script.
- **Coverage exclude list** in `vitest.config.ts` currently excludes `src/index.ts`. New non-barrel source files are NOT excluded and must be covered.

---

## File Structure

**Phase B (decompose):**
- Create `src/page-geometry.ts` — `readPageGeometry(scrollEl)`: the single DOM geometry reader.
- Create `src/page-geometry.browser.test.tsx`.
- Create `src/hooks/use-reachable-count.ts`, `use-scroll-sync.ts`, `use-last-child-visibility.ts`, `use-imperative-api.ts`.
- Modify `src/core/options.ts` — add `resolvePerStep`.
- Modify `src/core/options.test.ts` — test `resolvePerStep`.
- Modify `src/use-slider.ts` — becomes thin composer.

**Phase A (perf):**
- Modify `src/responsive-store.ts` — `matchMedia`-backed.
- Modify `src/responsive-store.test.ts` — extend.
- Modify `src/use-slider.ts` — wire breakpoint widths into the store.

**Phase C (API):**
- Modify `src/types.ts` — `SliderEventMap`, typed `on`, remove `keyboard`.
- Modify `src/use-slider.ts` — internal `pageCount` state.
- Modify `src/components/Slider.tsx` — drop its `useState`.
- Modify `src/use-slider.browser.test.tsx` — update harnesses to new signature.
- Modify `README.md` — `useSlider` params, remove `keyboard`.

**Phase D (size):**
- Create `.size-limit.json`.
- Modify `package.json` — devDeps + `size` script.
- Modify `.github/workflows/ci.yml` — size step.

**Phase E (drag):**
- Modify `src/components/SliderTrack.tsx` — `touch-action`.
- Modify `src/components/SliderTrack.browser.test.tsx` — assert `touch-action`.
- Modify `README.md` — `drag` row.

---

# PHASE B — Decompose `use-slider.ts`

## Task B1: Extract `resolvePerStep` into core

Removes the `grid ? 1 : perMove` ternary duplicated twice in `use-slider.ts` (each carrying a `// v8 ignore next` coverage-fudge comment).

**Files:**
- Modify: `src/core/options.ts`
- Test: `src/core/options.test.ts`
- Modify: `src/use-slider.ts` (call sites at ~line 105 and ~line 245)

**Interfaces:**
- Produces: `resolvePerStep(options: Pick<SliderOptions, 'grid' | 'perMove'>): number` — returns `1` when `options.grid` is truthy, else `options.perMove ?? 1`. (Preserves existing behavior exactly: it checks `grid` truthiness, not grid dimensions.)

- [ ] **Step 1: Write the failing test**

Add to `src/core/options.test.ts`:

```ts
import { resolvePerStep } from './options';

describe('resolvePerStep', () => {
  it('returns 1 when a grid is configured', () => {
    expect(resolvePerStep({ grid: { dimensions: [[1, 2]] } })).toBe(1);
  });
  it('returns perMove when no grid', () => {
    expect(resolvePerStep({ perMove: 3 })).toBe(3);
  });
  it('defaults to 1 with no grid and no perMove', () => {
    expect(resolvePerStep({})).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project node src/core/options.test.ts`
Expected: FAIL — `resolvePerStep is not a function` / not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/core/options.ts`:

```ts
export function resolvePerStep(options: Pick<SliderOptions, 'grid' | 'perMove'>): number {
  return options.grid ? 1 : (options.perMove ?? 1);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project node src/core/options.test.ts`
Expected: PASS.

- [ ] **Step 5: Refactor `use-slider.ts` call sites**

In `src/use-slider.ts`, add `resolvePerStep` to the import from `./core`. Replace the two ternaries (and delete the two `// v8 ignore next -- branch coverage for grid ternary ...` comment lines directly above them):

At the `goTo` site, replace:
```ts
      // v8 ignore next -- branch coverage for grid ternary is unreliably tracked in vitest multi-project setup
      const perMove = resolvedOptions.grid ? 1 : (resolvedOptions.perMove ?? 1);
```
with:
```ts
      const perMove = resolvePerStep(resolvedOptions);
```

At the derived-state site near the bottom, replace:
```ts
  // v8 ignore next -- branch coverage for grid ternary is unreliably tracked in vitest multi-project setup
  const perStep = resolvedOptions.grid ? 1 : (resolvedOptions.perMove ?? 1);
```
with:
```ts
  const perStep = resolvePerStep(resolvedOptions);
```

- [ ] **Step 6: Run the full suite + coverage**

Run: `pnpm test:cov`
Expected: PASS, coverage ≥99% (the two `v8 ignore` comments are gone and the branch is now covered by the node tests).

- [ ] **Step 7: Lint**

Run: `./node_modules/.bin/biome check .`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/core/options.ts src/core/options.test.ts src/use-slider.ts
git commit -m "refactor(core): extract resolvePerStep, drop duplicated grid ternary"
```

---

## Task B2: Extract `readPageGeometry` DOM reader

Removes the `querySelectorAll('[data-carousel-page="true"]') + scrollWidth-clientWidth + getReachablePageCount` block duplicated in three places (`measure`, `goTo`, scroll-sync).

**Files:**
- Create: `src/page-geometry.ts`
- Test: `src/page-geometry.browser.test.tsx`
- Modify: `src/use-slider.ts` (3 call sites)

**Interfaces:**
- Consumes: `getReachablePageCount` from `./core`.
- Produces:
  ```ts
  type PageGeometry = {
    pages: HTMLElement[];
    offsets: number[];
    maxScrollLeft: number;
    reachableCount: number;
    maxIndex: number;
  };
  function readPageGeometry(scrollElement: HTMLElement): PageGeometry;
  ```
  `reachableCount` is `getReachablePageCount(offsets, maxScrollLeft)` (min 1, even with zero pages); `maxIndex = reachableCount - 1`. Callers that need "no pages → null" semantics must check `pages.length` themselves.

- [ ] **Step 1: Write the failing test**

Create `src/page-geometry.browser.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { readPageGeometry } from './page-geometry';

it('reads pages, offsets, reachable count and maxIndex', () => {
  const { container } = render(
    <div style={{ display: 'flex', width: 200, overflowX: 'auto' }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          data-carousel-page="true"
          style={{ flex: '0 0 200px', width: 200, height: 50 }}
        >
          {i}
        </div>
      ))}
    </div>
  );
  const el = container.firstElementChild;
  if (!(el instanceof HTMLElement)) {
    throw new Error('expected a scroll element');
  }
  const geo = readPageGeometry(el);
  expect(geo.pages.length).toBe(3);
  expect(geo.offsets.length).toBe(3);
  expect(geo.reachableCount).toBeGreaterThanOrEqual(1);
  expect(geo.maxIndex).toBe(geo.reachableCount - 1);
});

it('returns empty pages and reachableCount 1 when there are no page elements', () => {
  const { container } = render(<div style={{ width: 200 }} />);
  const el = container.firstElementChild;
  if (!(el instanceof HTMLElement)) {
    throw new Error('expected an element');
  }
  const geo = readPageGeometry(el);
  expect(geo.pages.length).toBe(0);
  expect(geo.reachableCount).toBe(1);
  expect(geo.maxIndex).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project browser src/page-geometry.browser.test.tsx`
Expected: FAIL — cannot resolve `./page-geometry`.

- [ ] **Step 3: Write minimal implementation**

Create `src/page-geometry.ts`:

```ts
import { getReachablePageCount } from './core';

export type PageGeometry = {
  pages: HTMLElement[];
  offsets: number[];
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
  return { pages, offsets, maxScrollLeft, reachableCount, maxIndex: reachableCount - 1 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project browser src/page-geometry.browser.test.tsx`
Expected: PASS.

- [ ] **Step 5: Refactor the three `use-slider.ts` call sites**

Add `import { readPageGeometry } from './page-geometry';` to `src/use-slider.ts`.

**`measure`** becomes:
```ts
  const measure = useCallback(() => {
    const scrollElement = scrollElementRef.current;
    if (!scrollElement) {
      setReachableCount(null);
      return;
    }
    const { pages, reachableCount } = readPageGeometry(scrollElement);
    setReachableCount(pages.length ? reachableCount : null);
  }, []);
```

**`goTo`** inner body becomes (replacing the manual querySelectorAll/maxScrollLeft/maxIndex block):
```ts
      const scrollElement = scrollElementRef.current;
      if (!scrollElement) {
        return;
      }
      const { pages, maxScrollLeft, maxIndex } = readPageGeometry(scrollElement);
      if (!pages.length) {
        return;
      }
      const perMove = resolvePerStep(resolvedOptions);
      const next = resolveNextIndex({ control, currentIndex: currentIndexRef.current, perMove });
      const clamped = Math.max(0, Math.min(next, maxIndex));
      if (clamped === currentIndexRef.current) {
        return;
      }
      const target = pages[clamped];
      const targetStart = target.offsetLeft - scrollElement.offsetLeft;
      const targetLeft = clamped >= maxIndex ? maxScrollLeft : Math.min(targetStart, maxScrollLeft);
      scrollElement.scrollTo({ behavior: 'smooth', left: targetLeft });
      emitMoved(clamped);
```

**scroll-sync** settle callback becomes:
```ts
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
```

Remove now-unused imports from `./core` (`getReachablePageCount` is no longer referenced directly in `use-slider.ts`; keep `getMaxIndex`, `getNearestPageIndex`, `getPaginationCount`, `resolveNextIndex`, `resolveOptions`, `resolvePerStep`).

- [ ] **Step 6: Run the full suite + coverage**

Run: `pnpm test:cov`
Expected: PASS, coverage ≥99%. The existing `use-slider.browser.test.tsx` is the behavioral oracle — all its cases must stay green unmodified.

- [ ] **Step 7: Lint + typecheck**

Run: `./node_modules/.bin/biome check . && pnpm typecheck`
Expected: no errors (watch for unused-import errors from removed `getReachablePageCount`).

- [ ] **Step 8: Commit**

```bash
git add src/page-geometry.ts src/page-geometry.browser.test.tsx src/use-slider.ts
git commit -m "refactor: extract readPageGeometry, dedupe geometry reads in use-slider"
```

---

## Task B3: Extract the four effects into focused hooks

Pure relocation — no behavior change. The existing `use-slider.browser.test.tsx` is the oracle; coverage gate proves the relocated lines stay exercised.

**Files:**
- Create: `src/hooks/use-reachable-count.ts`
- Create: `src/hooks/use-scroll-sync.ts`
- Create: `src/hooks/use-last-child-visibility.ts`
- Create: `src/hooks/use-imperative-api.ts`
- Modify: `src/use-slider.ts` (compose)

**Interfaces (Produces):**
- `useReachableCount(scrollElementRef: RefObject<HTMLDivElement | null>, pageCount: number, resolvedOptions: SliderOptions): number | null`
- `useScrollSync(scrollElementRef: RefObject<HTMLDivElement | null>, currentIndexRef: RefObject<number>, emitMoved: (index: number) => void): void`
- `useLastChildVisibility(scrollElementRef: RefObject<HTMLDivElement | null>, pageCount: number): boolean`
- `useImperativeApi(currentIndexRef: RefObject<number>, listenersRef: RefObject<Set<(i: number) => void>>, goTo: (control: SliderControl) => void, onMounted?: (api: SliderApi) => void, onDestroy?: () => void): void`

- [ ] **Step 1: Establish the oracle is green before refactor**

Run: `pnpm test:cov`
Expected: PASS (baseline). This whole task is a refactor; the same command must pass at the end.

- [ ] **Step 2: Create `src/hooks/use-reachable-count.ts`**

```ts
'use client';
import { type RefObject, useCallback, useEffect, useState } from 'react';
import { readPageGeometry } from '../page-geometry';
import type { SliderOptions } from '../types';

export function useReachableCount(
  scrollElementRef: RefObject<HTMLDivElement | null>,
  pageCount: number,
  resolvedOptions: SliderOptions
): number | null {
  const [reachableCount, setReachableCount] = useState<number | null>(null);

  const measure = useCallback(() => {
    const scrollElement = scrollElementRef.current;
    if (!scrollElement) {
      setReachableCount(null);
      return;
    }
    const { pages, reachableCount: count } = readPageGeometry(scrollElement);
    setReachableCount(pages.length ? count : null);
  }, [scrollElementRef]);

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

  return reachableCount;
}
```

- [ ] **Step 3: Create `src/hooks/use-scroll-sync.ts`**

```ts
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
```

- [ ] **Step 4: Create `src/hooks/use-last-child-visibility.ts`**

```ts
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
```

- [ ] **Step 5: Create `src/hooks/use-imperative-api.ts`**

```ts
'use client';
import { type RefObject, useEffect } from 'react';
import type { SliderApi, SliderControl } from '../types';

export function useImperativeApi(
  currentIndexRef: RefObject<number>,
  listenersRef: RefObject<Set<(i: number) => void>>,
  goTo: (control: SliderControl) => void,
  onMounted?: (api: SliderApi) => void,
  onDestroy?: () => void
): void {
  useEffect(() => {
    const listeners = listenersRef.current;
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
  }, [currentIndexRef, listenersRef, goTo, onMounted, onDestroy]);
}
```

- [ ] **Step 6: Rewrite `src/use-slider.ts` as a thin composer**

Replace the entire file body with the composed version (the four effects are now imported hooks; `measure`/`reachableCount`/`isLastChildVisible` come from the hooks):

```ts
'use client';
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  getMaxIndex,
  getPaginationCount,
  resolveNextIndex,
  resolveOptions,
  resolvePerStep,
} from './core';
import { useImperativeApi } from './hooks/use-imperative-api';
import { useLastChildVisibility } from './hooks/use-last-child-visibility';
import { useReachableCount } from './hooks/use-reachable-count';
import { useScrollSync } from './hooks/use-scroll-sync';
import { readPageGeometry } from './page-geometry';
import { createResponsiveStore } from './responsive-store';
import {
  type SliderApi,
  type SliderContextValue,
  type SliderControl,
  type SliderOptions,
} from './types';

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
    () => resolveOptions(options, viewportWidth),
    [options, viewportWidth]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);
  const scrollElementRef = useRef<HTMLDivElement | null>(null);
  const listenersRef = useRef(new Set<(i: number) => void>());

  const registerScrollElement = useCallback((el: HTMLDivElement | null) => {
    scrollElementRef.current = el;
  }, []);

  const emitMoved = useCallback((index: number) => {
    currentIndexRef.current = index;
    setCurrentIndex(index);
    for (const l of listenersRef.current) {
      l(index);
    }
  }, []);

  const goTo = useCallback(
    (control: SliderControl) => {
      const scrollElement = scrollElementRef.current;
      if (!scrollElement) {
        return;
      }
      const { pages, maxScrollLeft, maxIndex } = readPageGeometry(scrollElement);
      if (!pages.length) {
        return;
      }
      const perMove = resolvePerStep(resolvedOptions);
      const next = resolveNextIndex({ control, currentIndex: currentIndexRef.current, perMove });
      const clamped = Math.max(0, Math.min(next, maxIndex));
      if (clamped === currentIndexRef.current) {
        return;
      }
      const target = pages[clamped];
      const targetStart = target.offsetLeft - scrollElement.offsetLeft;
      const targetLeft = clamped >= maxIndex ? maxScrollLeft : Math.min(targetStart, maxScrollLeft);
      scrollElement.scrollTo({ behavior: 'smooth', left: targetLeft });
      emitMoved(clamped);
    },
    [emitMoved, resolvedOptions]
  );

  const prev = useCallback(() => goTo('<'), [goTo]);
  const next = useCallback(() => goTo('>'), [goTo]);

  const reachableCount = useReachableCount(scrollElementRef, pageCount, resolvedOptions);
  useScrollSync(scrollElementRef, currentIndexRef, emitMoved);
  const isLastChildVisible = useLastChildVisibility(scrollElementRef, pageCount);
  useImperativeApi(currentIndexRef, listenersRef, goTo, onMounted, onDestroy);

  const perStep = resolvePerStep(resolvedOptions);
  const maxIndex =
    reachableCount !== null ? reachableCount - 1 : getMaxIndex(resolvedOptions, pageCount);
  const paginationCount =
    reachableCount !== null
      ? Math.max(Math.ceil(reachableCount / perStep), 1)
      : getPaginationCount(resolvedOptions, pageCount);
  const currentPageIndex =
    currentIndex >= maxIndex
      ? Math.max(paginationCount - 1, 0)
      : Math.floor(currentIndex / perStep);

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
```

> Note: `prev`/`next` now call `goTo('<')`/`goTo('>')` directly instead of `NavigationAction.Prev/Next` so `NavigationAction` no longer needs importing here. `resolveNextIndex` treats `'<'`/`'>'` identically to the enum, so behavior is unchanged. (`NavigationAction` remains exported from the barrel via `types.ts`.)

- [ ] **Step 7: Run the full suite + coverage**

Run: `pnpm test:cov`
Expected: PASS, coverage ≥99%. Every prior `use-slider.browser.test.tsx` case green, unchanged.

- [ ] **Step 8: Lint + typecheck**

Run: `./node_modules/.bin/biome check . && pnpm typecheck`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/hooks src/use-slider.ts
git commit -m "refactor(use-slider): split effects into focused hooks, thin composer"
```

---

# PHASE A — Resize render perf (`matchMedia` store)

## Task A1: `matchMedia`-backed responsive store

**Files:**
- Modify: `src/responsive-store.ts`
- Test: `src/responsive-store.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type ResponsiveStore = {
    subscribe: (callback: () => void) => () => void;
    getSnapshot: () => number | null;
    getServerSnapshot: () => number | null;
  };
  function createResponsiveStore(
    breakpointWidths?: readonly number[],
    mediaQuery?: 'max' | 'min'
  ): ResponsiveStore;
  ```
  Defaults: `breakpointWidths = []`, `mediaQuery = 'max'`. Back-compatible with the current zero-arg call.

**Behavior contract:**
- Re-renders (callback fires) only when a breakpoint `MediaQueryList` toggles — NOT on within-band resizes.
- `getSnapshot()` returns a cached width that only changes inside a `change` handler → referentially stable between crossings.
- `getServerSnapshot()` always `null`; `getSnapshot()` returns `null` when `window` is undefined.
- `matchMedia` absent → falls back to a plain `resize` listener (still notifies on every resize, but at least correct).

- [ ] **Step 1: Write the failing tests**

Add to `src/responsive-store.test.ts` (keep all existing tests — they must still pass):

```ts
type FakeMql = {
  matches: boolean;
  addEventListener: (t: string, cb: () => void) => void;
  removeEventListener: (t: string, cb: () => void) => void;
};

function makeFakeWindow(initialWidth: number) {
  const mqls: { cb: () => void }[] = [];
  const fakeWindow = {
    innerWidth: initialWidth,
    matchMedia: (_query: string): FakeMql => {
      const entry = { cb: () => {} };
      return {
        matches: false,
        addEventListener: (_t: string, cb: () => void) => {
          entry.cb = cb;
          mqls.push(entry);
        },
        removeEventListener: () => {},
      };
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  return { fakeWindow, fireAll: () => mqls.forEach((m) => m.cb()) };
}

describe('createResponsiveStore (matchMedia)', () => {
  it('notifies only when a breakpoint MQL changes, and caches width between changes', () => {
    const { fakeWindow, fireAll } = makeFakeWindow(800);
    vi.stubGlobal('window', fakeWindow);
    const store = createResponsiveStore([640, 1024], 'max');
    const cb = vi.fn();
    store.subscribe(cb);
    expect(store.getSnapshot()).toBe(800);
    // within-band resize without an MQL change: snapshot stays cached
    fakeWindow.innerWidth = 700;
    expect(store.getSnapshot()).toBe(800);
    expect(cb).not.toHaveBeenCalled();
    // crossing a breakpoint fires the MQL change handler
    fakeWindow.innerWidth = 500;
    fireAll();
    expect(cb).toHaveBeenCalled();
    expect(store.getSnapshot()).toBe(500);
    vi.unstubAllGlobals();
  });

  it('falls back to resize when matchMedia is absent', () => {
    const listeners = new Set<() => void>();
    const fakeWindow = {
      innerWidth: 900,
      addEventListener: (_: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    };
    vi.stubGlobal('window', fakeWindow);
    const store = createResponsiveStore([640]);
    const cb = vi.fn();
    const unsub = store.subscribe(cb);
    expect(listeners.size).toBe(1);
    fakeWindow.innerWidth = 400;
    for (const l of listeners) {
      l();
    }
    expect(cb).toHaveBeenCalled();
    expect(store.getSnapshot()).toBe(400);
    unsub();
    expect(listeners.size).toBe(0);
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `pnpm vitest run --project node src/responsive-store.test.ts`
Expected: FAIL on the two new cases (`createResponsiveStore` ignores args / no matchMedia path).

- [ ] **Step 3: Rewrite `src/responsive-store.ts`**

```ts
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
      if (typeof window.matchMedia === 'undefined') {
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
      }
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
```

- [ ] **Step 4: Run the full responsive-store suite**

Run: `pnpm vitest run --project node src/responsive-store.test.ts`
Expected: PASS — all existing + the two new cases. (Existing zero-arg tests still pass: no `matchMedia` on those fake windows → resize fallback; `getSnapshot()` returns cached `innerWidth`.)

- [ ] **Step 5: Run full coverage**

Run: `pnpm test:cov`
Expected: PASS, ≥99%.

- [ ] **Step 6: Lint + typecheck + commit**

```bash
./node_modules/.bin/biome check . && pnpm typecheck
git add src/responsive-store.ts src/responsive-store.test.ts
git commit -m "perf(responsive-store): matchMedia-backed, re-render only on breakpoint crossings"
```

---

## Task A2: Wire breakpoint widths into the store from `use-slider`

**Files:**
- Modify: `src/use-slider.ts`

**Interfaces:**
- Consumes: `createResponsiveStore(breakpointWidths, mediaQuery)` from Task A1.

- [ ] **Step 1: Update the store memo in `use-slider.ts`**

Replace:
```ts
  const store = useMemo(() => createResponsiveStore(), []);
```
with:
```ts
  const breakpointWidths = useMemo(
    () => Object.keys(options.breakpoints ?? {}).map(Number),
    [options.breakpoints]
  );
  const store = useMemo(
    () => createResponsiveStore(breakpointWidths, options.mediaQuery),
    [breakpointWidths, options.mediaQuery]
  );
```

> `options.breakpoints`/`options.mediaQuery` are read from the RAW options (breakpoints are not themselves breakpoint-resolved). Callers should pass a stable `breakpoints` object; an inline object recreated each render would re-subscribe each render (documented limitation, same as today's `resolveOptions` memo).

- [ ] **Step 2: Run full suite + coverage**

Run: `pnpm test:cov`
Expected: PASS, ≥99%. Existing responsive behavior tests in `use-slider.browser.test.tsx` (if any drive breakpoints) stay green.

- [ ] **Step 3: Lint + typecheck + commit**

```bash
./node_modules/.bin/biome check . && pnpm typecheck
git add src/use-slider.ts
git commit -m "perf(use-slider): feed breakpoint widths to the matchMedia store"
```

---

# PHASE C — Tighten public API (breaking)

## Task C1: Typed events + remove dead `keyboard`

**Files:**
- Modify: `src/types.ts`

**Interfaces:**
- Produces:
  ```ts
  type SliderEventMap = { moved: (index: number) => void };
  // SliderApi.on:
  on: <E extends keyof SliderEventMap>(event: E, callback: SliderEventMap[E]) => () => void;
  ```
- `keyboard?: boolean` removed from `SliderOptions`.

- [ ] **Step 1: Edit `src/types.ts`**

Remove the `keyboard?: boolean;` line from `SliderOptions`.

Add the event map above `SliderApi` and update `on`:
```ts
export type SliderEventMap = {
  moved: (index: number) => void;
};

export type SliderApi = {
  destroy: () => void;
  go: (control: SliderControl) => void;
  index: number;
  on: <E extends keyof SliderEventMap>(event: E, callback: SliderEventMap[E]) => () => void;
};
```

- [ ] **Step 2: Verify the `on` implementation still typechecks**

The implementation in `src/hooks/use-imperative-api.ts` uses `on: (event, callback) => { if (event !== 'moved') return () => {}; ... }`. With the generic signature, `event` narrows to `'moved'` and `callback` to `(index: number) => void` — the runtime guard remains valid (defends JS callers). No code change needed; confirm via typecheck.

Run: `pnpm typecheck`
Expected: PASS. If the generic causes an inference issue in `use-imperative-api.ts`, annotate the param explicitly, e.g. `on: <E extends keyof SliderEventMap>(event: E, callback: SliderEventMap[E]) => { ... }`.

- [ ] **Step 3: Run full suite + coverage**

Run: `pnpm test:cov`
Expected: PASS, ≥99%. The existing `on('moved', ...)` and `on ignores unknown events` tests still pass (the unknown-event test calls `on` with a non-`'moved'` string; if TS now rejects that literal in the test, change that test to exercise the runtime guard through a typed indirection — see note).

> Note for the "ignores unknown events" test: if it currently calls `api.on('something', fn)` with a literal, TS will now reject it. Keep runtime coverage of the guard by calling through a variable typed as the public surface, e.g.:
> ```ts
> const event: 'moved' = 'moved';
> // exercise the noop branch via a known-unsupported event passed as the mapped key is impossible at type level;
> // instead assert the supported path returns an unsubscribe and the guard branch stays covered by a JS-level call:
> const onUnknown: (e: string, cb: () => void) => () => void = api.on;
> const off = onUnknown('nope', () => {});
> expect(typeof off).toBe('function');
> ```
> This keeps the `event !== 'moved'` branch covered without a type assertion (it widens via an explicit function-typed annotation, which is allowed — no `as`).

- [ ] **Step 4: Lint + commit**

```bash
./node_modules/.bin/biome check .
git add src/types.ts src/hooks/use-imperative-api.ts src/use-slider.browser.test.tsx
git commit -m "feat(types)!: typed on() event map, remove dead keyboard option"
```

---

## Task C2: Un-leak `useSlider` (internal `pageCount`)

**Files:**
- Modify: `src/use-slider.ts`
- Modify: `src/components/Slider.tsx`
- Modify: `src/use-slider.browser.test.tsx`
- Modify: `README.md`

**Interfaces:**
- Produces: `useSlider({ options, onMounted?, onDestroy? }): SliderContextValue`. `pageCount`/`setPageCount` are no longer params; the returned `SliderContextValue` still exposes both (`SliderTrack` keeps calling `setPageCount`).

- [ ] **Step 1: Update the `use-slider.browser.test.tsx` harnesses (failing first)**

Change `Harness` to use the internal state:
```tsx
function Harness({ options, onApi }: { options: SliderOptions; onApi?: (api: SliderApi) => void }) {
  const ctx = useSlider({ options, onMounted: onApi });
  return (
    <SliderContext.Provider value={ctx}>
      <div
        ref={ctx.registerScrollElement}
        style={{ display: 'flex', width: 200, overflowX: 'auto' }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            data-carousel-page="true"
            style={{ flex: '0 0 200px', width: 200, height: 50 }}
          >
            {i}
          </div>
        ))}
      </div>
      <Counter setPageCount={ctx.setPageCount} />
    </SliderContext.Provider>
  );
}
```
For each `Probe` that did `const [pageCount, setPageCount] = useState(3); useSlider({ options, pageCount, setPageCount })`, replace with:
```tsx
function Probe() {
  const ctx = useSlider({ options: { perPage: 1 } });
  useEffect(() => {
    ctx.setPageCount(3);
  }, [ctx.setPageCount]);
  captured.current = ctx;
  return null;
}
```
Apply the same shape to every harness/probe in the file that passed `pageCount`/`setPageCount`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run --project browser src/use-slider.browser.test.tsx`
Expected: FAIL — `useSlider` still requires `pageCount`/`setPageCount` (type error / runtime).

- [ ] **Step 3: Move `pageCount` state inside `useSlider`**

In `src/use-slider.ts`, change `UseSliderParams` and add internal state:
```ts
type UseSliderParams = {
  options: SliderOptions;
  onMounted?: (api: SliderApi) => void;
  onDestroy?: () => void;
};

export function useSlider({ options, onMounted, onDestroy }: UseSliderParams): SliderContextValue {
  const [pageCount, setPageCount] = useState(0);
  // ... rest unchanged; `pageCount` and `setPageCount` are still returned in the context object
```
Remove `pageCount` and `setPageCount` from the destructured params. The returned object already includes `pageCount` and `setPageCount`.

- [ ] **Step 4: Simplify `src/components/Slider.tsx`**

```tsx
'use client';
import { SliderContext } from '../slider-context';
import type { SliderProps } from '../types';
import { useSlider } from '../use-slider';

export function Slider({
  options,
  className,
  style,
  'aria-label': ariaLabel,
  children,
  onMounted,
  onDestroy,
  ...rest
}: SliderProps) {
  const ctx = useSlider({ options: options ?? {}, onMounted, onDestroy });
  return (
    <SliderContext.Provider value={ctx}>
      <section
        aria-label={ariaLabel}
        className={className}
        style={{ position: 'relative', ...style }}
        {...rest}
      >
        {children}
      </section>
    </SliderContext.Provider>
  );
}

export default Slider;
```
(Removes the now-unused `useState` import.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run --project browser src/use-slider.browser.test.tsx`
Expected: PASS.

- [ ] **Step 6: Update `README.md`**

In the `## Custom build with useSlider` section, change the `useSlider({ ... })` example and the "`useSlider` params" list to the new signature: `options`, `onMounted?`, `onDestroy?` only — remove `pageCount`/`setPageCount` from the params list and note that the returned context exposes `setPageCount` for a track component to report its page count. Remove the `keyboard` row from the options table.

- [ ] **Step 7: Full suite + coverage + lint + typecheck**

Run: `pnpm test:cov && ./node_modules/.bin/biome check . && pnpm typecheck`
Expected: PASS, ≥99%.

- [ ] **Step 8: Commit**

```bash
git add src/use-slider.ts src/components/Slider.tsx src/use-slider.browser.test.tsx README.md
git commit -m "feat(use-slider)!: manage pageCount internally, drop leaked params"
```

---

# PHASE D — Bundle-size budget

## Task D1: Add `size-limit` gate

**Files:**
- Create: `.size-limit.json`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Install dev deps**

Run:
```bash
pnpm add -D size-limit @size-limit/preset-small-lib
```
Expected: both added under `devDependencies`.

- [ ] **Step 2: Build, then measure current size**

Run:
```bash
pnpm build
pnpm exec size-limit --json --limit 100kb dist/index.js || true
```
Note the reported gzip size for `dist/index.js` (record the number, e.g. `N kB`).

- [ ] **Step 3: Create `.size-limit.json` with budgets set just above measured**

Set each `limit` to the measured gzip + ~15% headroom (round to a clean value). Example shape (replace the limit strings with the measured-derived values):
```json
[
  {
    "name": "ESM entry (gzip)",
    "path": "dist/index.js",
    "limit": "<measured+headroom> kB",
    "gzip": true
  },
  {
    "name": "Baseline stylesheet",
    "path": "dist/styles.css",
    "limit": "2 kB",
    "gzip": true
  }
]
```

- [ ] **Step 4: Add the `size` script to `package.json`**

In `"scripts"`, add:
```json
"size": "size-limit",
```

- [ ] **Step 5: Verify the gate passes locally**

Run:
```bash
pnpm build && pnpm size
```
Expected: PASS — both entries under their limits. If `dist/index.js` is over, the budget is too tight; bump to measured + headroom (do NOT loosen wildly).

- [ ] **Step 6: Wire into CI**

In `.github/workflows/ci.yml`, add a step after the existing `- run: pnpm build` step:
```yaml
      - run: pnpm size
```
(`check` stays build-free so release scripts don't double-build; the size gate runs in CI after the build, and locally via `pnpm build && pnpm size`.)

- [ ] **Step 7: Commit**

```bash
git add .size-limit.json package.json pnpm-lock.yaml .github/workflows/ci.yml
git commit -m "build: add size-limit budget gate (CI, post-build)"
```

---

# PHASE E — Make `drag` real (`touch-action`) — deferred, do last

## Task E1: Wire `touch-action` from the `drag` option

**Files:**
- Modify: `src/components/SliderTrack.tsx`
- Test: `src/components/SliderTrack.browser.test.tsx`
- Modify: `README.md`

**Behavior:** `options.drag === false` → scroll element gets `touchAction: 'pan-y'` (disables horizontal touch/trackpad panning). Otherwise `touchAction` is left unset (browser default, horizontal pan allowed). Mouse drag-to-scroll is explicitly out of scope.

- [ ] **Step 1: Write the failing test**

Add to `src/components/SliderTrack.browser.test.tsx` (mirror the existing render/context setup used by other cases in that file — wrap `SliderTrack` in a `SliderContext.Provider` with a context whose `options.drag` is `false`, query `[data-slider-scroll]`):

```tsx
it('sets touch-action: pan-y on the scroll element when drag is disabled', () => {
  const { container } = renderWithContext({ drag: false });
  const scroll = container.querySelector<HTMLElement>('[data-slider-scroll]');
  if (!scroll) {
    throw new Error('expected scroll element');
  }
  expect(scroll.style.touchAction).toBe('pan-y');
});

it('leaves touch-action unset when drag is enabled (default)', () => {
  const { container } = renderWithContext({ drag: true });
  const scroll = container.querySelector<HTMLElement>('[data-slider-scroll]');
  if (!scroll) {
    throw new Error('expected scroll element');
  }
  expect(scroll.style.touchAction).toBe('');
});
```
> Use the file's existing helper for building a context value (the other tests already construct a `SliderContextValue`); add a `drag` field to the `options` they pass. If no shared helper exists, build a minimal `SliderContextValue` inline following the pattern already in this test file. Do not introduce `as`/`!`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run --project browser src/components/SliderTrack.browser.test.tsx`
Expected: FAIL — `touchAction` is `''` in both cases (not yet wired).

- [ ] **Step 3: Add `touchAction` to the scroll style in `SliderTrack.tsx`**

In the `scrollStyle` object, add (after the existing properties):
```ts
    ...(carousel.options.drag === false ? { touchAction: 'pan-y' } : {}),
```
(Spreading conditionally keeps `touchAction` absent — empty string in `.style` — when drag is enabled.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run --project browser src/components/SliderTrack.browser.test.tsx`
Expected: PASS.

- [ ] **Step 5: Update `README.md`**

Update the `drag` options-table row to reflect real semantics: `drag: false` disables horizontal touch/trackpad panning via `touch-action: pan-y`; native mouse drag-to-scroll is not implemented.

- [ ] **Step 6: Full suite + coverage + lint + typecheck**

Run: `pnpm test:cov && ./node_modules/.bin/biome check . && pnpm typecheck`
Expected: PASS, ≥99%.

- [ ] **Step 7: Re-run the size gate**

Run: `pnpm build && pnpm size`
Expected: PASS (the new branch is tiny; if it nudges over, the Phase D budget had no headroom — re-evaluate).

- [ ] **Step 8: Commit**

```bash
git add src/components/SliderTrack.tsx src/components/SliderTrack.browser.test.tsx README.md
git commit -m "feat(slider-track): wire drag option to touch-action: pan-y"
```

---

## Final verification (after all phases)

- [ ] Run `pnpm check` → lint + typecheck + test:cov all green, coverage ≥99%.
- [ ] Run `pnpm build && pnpm size` → build succeeds, size gate green.
- [ ] Grep confirms no `any`/`unknown`/` as `/`!` introduced: `./node_modules/.bin/biome check .` clean.
- [ ] `grep -rn "keyboard" src` → no matches in source.
- [ ] `src/use-slider.ts` is ≤ ~100 lines; `readPageGeometry` is the only place that reads `[data-carousel-page]` offsets + maxScrollLeft.

---

## Self-Review

**Spec coverage:**
- Phase A (matchMedia perf) → Tasks A1, A2. ✓
- Phase B (decompose, readPageGeometry, resolvePerStep, remove v8-ignores) → B1, B2, B3. ✓
- Phase C (un-leak useSlider, typed on, remove keyboard) → C1, C2. ✓
- Phase D (size-limit gate, CI) → D1. ✓
- Phase E (drag touch-action) → E1. ✓
- SSR unchanged (getServerSnapshot null) → A1 contract + test. ✓
- TDD/coverage/no-assertions → every task’s steps + Global Constraints. ✓

**Placeholder scan:** Size budget numbers in D1 are intentionally measure-at-implementation (Step 2 measures, Step 3 sets) — not a placeholder, it’s a required measurement. No TODO/TBD elsewhere.

**Type consistency:** `readPageGeometry → PageGeometry { pages, offsets, maxScrollLeft, reachableCount, maxIndex }` used consistently in B2/B3. `useSlider` signature change (drop `pageCount`/`setPageCount`) is consistent across C2 (hook, Slider.tsx, tests). `on` generic signature consistent between C1 (types) and the existing impl in `use-imperative-api.ts`. `createResponsiveStore(breakpointWidths?, mediaQuery?)` consistent between A1 (def) and A2 (call).
