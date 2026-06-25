# SSR-first Slider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `light-splide-slide` SSR-first by removing all `useState` (→ one external store read via `useSyncExternalStore`) and moving `Slider`/`SliderTrack`/`SliderSlide` to React Server Components, leaving `'use client'` only on a minimal interactive island.

**Architecture:** Two planes. **Server plane** (`Slider`, `SliderTrack`, `SliderSlide`) renders all structural DOM purely from options, with option *data* flowing top-down via `cloneElement` injection and CSS variables — no React context, no hooks. **Client plane** is a new `SliderRuntime` island that owns the controller (`useSlider`), provides `SliderContext`, measures the DOM (scroll element + page count), and feeds the interactive controls (`SliderArrows`, `SliderPagination`). State lives in a per-slider external store; `useState` is eliminated entirely.

**Tech Stack:** React 18+/19, TypeScript (strict, no `any`/`unknown`/assertions except `as const`, no non-null `!`), Vitest (node + browser/Chromium), Biome, tsup. Native CSS scroll-snap.

## Global Constraints

- TDD-first: failing test → minimal impl → pass → commit. No exceptions.
- No `any`, no `unknown`, no type assertions (`as`, `<T>x`) except `as const`, no non-null assertions (`!`) — in source AND tests. Use type annotations, user-defined type guards, `satisfies`, ISP-narrowed parameter types, and the typed `querySelector<T>()` form.
- Coverage gate ≥ 99% (lines/statements/functions/branches), enforced in `vitest.config.ts`.
- Pure logic → `*.test.ts` (node). DOM/geometry → `*.browser.test.tsx` (Vitest Browser Mode, Chromium).
- Headless contract: any styling system must work; never hard-code colors or require Tailwind.
- SSR: never read `window`/`document` during render.
- Strict dependency direction: presentation → controller → core.
- Lint with the binary directly (RTK proxy hijacks `pnpm lint` locally): `./node_modules/.bin/biome check .` and `./node_modules/.bin/biome check --write <file>`.
- Run tests with `pnpm test`; coverage with `pnpm test:cov`; types with `pnpm typecheck`.
- Frozen public surface: the `useSlider` / `SliderContext` headless API (`setPageCount`, `registerScrollElement`, `currentIndex`, `canGoNext`, `canGoPrev`, `currentPageIndex`, `pageCount`, `paginationCount`, `options`, `goTo`, `next`, `prev`) and the imperative API (`index`, `go`, `on`, `destroy`). Do not rename or change their semantics.
- Public composition API unchanged: `<Slider options>` / `<SliderTrack>` / `<SliderSlide>` / `<SliderArrows>` / `<SliderPagination>`. `SliderTrack` must remain a **direct child** of `Slider` (option injection relies on it; already true in all usage/tests).

**Branch:** all work lands on `ssr-first-slider` (already created; spec committed there).

---

## File Structure

**New files:**
- `src/slider-store.ts` — pure external store: `SliderState`, `createSliderStore()`. No React, no `'use client'`.
- `src/slider-store.test.ts` — node unit tests for the store.
- `src/core/scroll-style.ts` — pure `computeScrollStyle(options)` → `{ style, cssVars }` (extracted from `SliderTrack`). Reused by Track (render) and the runtime (imperative responsive sync).
- `src/core/scroll-style.test.ts` — node unit tests for the helper.
- `src/components/SliderRuntime.tsx` — `'use client'` island: calls `useSlider`, provides context, measures DOM, syncs responsive styles.
- `src/components/SliderRuntime.browser.test.tsx` — browser tests for the island.

**Modified files:**
- `src/use-slider.ts` — replace `useState` with the store; thread stable setters into the measurement hooks.
- `src/hooks/use-reachable-count.ts` — write to store via injected setter instead of owning `useState`.
- `src/hooks/use-last-child-visibility.ts` — same.
- `src/core/index.ts` — re-export `computeScrollStyle`.
- `src/components/SliderTrack.tsx` — server component: options via injected `__options`, styles via `computeScrollStyle`, no effect, no context, no `'use client'`; injects `__options` into flat component slides.
- `src/components/SliderSlide.tsx` — server component: options via injected `__options`, no context, no `'use client'`.
- `src/components/Slider.tsx` — server component: resolves base options, sets section CSS vars, injects options into its `SliderTrack` child, delegates interactivity to `SliderRuntime`; no `'use client'`.
- `src/types.ts` — add internal injected-prop types (`SliderInjectedOptions`).

**Test files touched only if the runtime wrapper perturbs a structural assertion** (the plan is designed to avoid this; adjust only if a run proves otherwise).

---

## Task 1: External store (`slider-store.ts`)

**Files:**
- Create: `src/slider-store.ts`
- Test: `src/slider-store.test.ts`

**Interfaces:**
- Produces:
  - `type SliderState = { currentIndex: number; pageCount: number; reachableCount: number | null; isLastChildVisible: boolean }`
  - `type SliderStore = { subscribe(cb: () => void): () => void; getSnapshot(): SliderState; getServerSnapshot(): SliderState; getState(): SliderState; setState(patch: Partial<SliderState>): void }`
  - `function createSliderStore(): SliderStore`
  - Initial state: `{ currentIndex: 0, pageCount: 0, reachableCount: null, isLastChildVisible: false }`.
  - `getSnapshot` returns a stable reference until `setState` actually changes a field; `setState` is a no-op (no notify) when the patch changes nothing; `getServerSnapshot` always returns the shared initial object.

- [ ] **Step 1: Write the failing test**

```ts
// src/slider-store.test.ts
import { describe, expect, it, vi } from 'vitest';
import { createSliderStore } from './slider-store';

describe('createSliderStore', () => {
  it('starts at the initial state', () => {
    const store = createSliderStore();
    expect(store.getSnapshot()).toEqual({
      currentIndex: 0,
      pageCount: 0,
      reachableCount: null,
      isLastChildVisible: false,
    });
  });

  it('getServerSnapshot returns a stable initial reference', () => {
    const store = createSliderStore();
    expect(store.getServerSnapshot()).toBe(store.getServerSnapshot());
    expect(store.getServerSnapshot().currentIndex).toBe(0);
  });

  it('setState merges, notifies, and returns a new snapshot reference', () => {
    const store = createSliderStore();
    const before = store.getSnapshot();
    const listener = vi.fn();
    const unsub = store.subscribe(listener);
    store.setState({ currentIndex: 2 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).not.toBe(before);
    expect(store.getSnapshot().currentIndex).toBe(2);
    expect(store.getSnapshot().pageCount).toBe(0);
    unsub();
  });

  it('treats 0 and null patches as real values (not nullish-skipped)', () => {
    const store = createSliderStore();
    store.setState({ currentIndex: 3, reachableCount: 5 });
    store.setState({ currentIndex: 0, reachableCount: null });
    expect(store.getSnapshot().currentIndex).toBe(0);
    expect(store.getSnapshot().reachableCount).toBe(null);
  });

  it('does not notify or change the reference when nothing changes', () => {
    const store = createSliderStore();
    store.setState({ pageCount: 4 });
    const snapshot = store.getSnapshot();
    const listener = vi.fn();
    store.subscribe(listener);
    store.setState({ pageCount: 4 });
    expect(listener).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toBe(snapshot);
  });

  it('unsubscribe stops notifications', () => {
    const store = createSliderStore();
    const listener = vi.fn();
    const unsub = store.subscribe(listener);
    unsub();
    store.setState({ pageCount: 9 });
    expect(listener).not.toHaveBeenCalled();
  });

  it('getState returns the current live state', () => {
    const store = createSliderStore();
    store.setState({ isLastChildVisible: true });
    expect(store.getState().isLastChildVisible).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/slider-store.test.ts`
Expected: FAIL — `Cannot find module './slider-store'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/slider-store.ts
export type SliderState = {
  currentIndex: number;
  pageCount: number;
  reachableCount: number | null;
  isLastChildVisible: boolean;
};

export type SliderStore = {
  subscribe: (callback: () => void) => () => void;
  getSnapshot: () => SliderState;
  getServerSnapshot: () => SliderState;
  getState: () => SliderState;
  setState: (patch: Partial<SliderState>) => void;
};

const INITIAL_STATE: SliderState = {
  currentIndex: 0,
  pageCount: 0,
  reachableCount: null,
  isLastChildVisible: false,
};

export function createSliderStore(): SliderStore {
  let state: SliderState = INITIAL_STATE;
  const listeners = new Set<() => void>();

  return {
    subscribe(callback) {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    getSnapshot() {
      return state;
    },
    getServerSnapshot() {
      return INITIAL_STATE;
    },
    getState() {
      return state;
    },
    setState(patch) {
      const next: SliderState = {
        currentIndex: patch.currentIndex ?? state.currentIndex,
        pageCount: patch.pageCount ?? state.pageCount,
        reachableCount:
          patch.reachableCount !== undefined ? patch.reachableCount : state.reachableCount,
        isLastChildVisible: patch.isLastChildVisible ?? state.isLastChildVisible,
      };
      if (
        next.currentIndex === state.currentIndex &&
        next.pageCount === state.pageCount &&
        next.reachableCount === state.reachableCount &&
        next.isLastChildVisible === state.isLastChildVisible
      ) {
        return;
      }
      state = next;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}
```

Note: `currentIndex`, `pageCount`, `isLastChildVisible` use `??` (their `0`/`false` values are not nullish, so they pass through). `reachableCount` uses an explicit `!== undefined` check because `null` is a meaningful value that `??` would discard.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/slider-store.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Lint**

Run: `./node_modules/.bin/biome check src/slider-store.ts src/slider-store.test.ts`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/slider-store.ts src/slider-store.test.ts
git commit -m "feat: add per-slider external store (no React)"
```

---

## Task 2: Remove all `useState` — controller + measurement hooks read/write the store

**Files:**
- Modify: `src/use-slider.ts`
- Modify: `src/hooks/use-reachable-count.ts`
- Modify: `src/hooks/use-last-child-visibility.ts`
- Verification: full existing browser suite stays green; `useState` no longer imported anywhere in `src/`.

**Interfaces:**
- Consumes: `createSliderStore`, `SliderState` from Task 1.
- Produces (changed internal hook signatures):
  - `useReachableCount(scrollElementRef, pageCount, resolvedOptions, setReachableCount: (count: number | null) => void): void` — no return; writes via the setter.
  - `useLastChildVisibility(scrollElementRef, pageCount, setIsLastChildVisible: (visible: boolean) => void): void` — no return; writes via the setter.
  - `useSlider` public return shape is **unchanged**.

This is a refactor guarded by the existing test suite (the suite is the test). No behavior changes.

- [ ] **Step 1: Confirm the guard suite is green before refactor**

Run: `pnpm test`
Expected: PASS (all existing tests). Record the count.

- [ ] **Step 2: Refactor `use-reachable-count.ts` to write via an injected setter**

```ts
// src/hooks/use-reachable-count.ts
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
```

(Only change vs. current: removed `useState`; `measure` now calls the injected `setReachableCount` and includes it in its dep array.)

- [ ] **Step 3: Refactor `use-last-child-visibility.ts` to write via an injected setter**

```ts
// src/hooks/use-last-child-visibility.ts
'use client';
import { type RefObject, useEffect } from 'react';

const FULL_VISIBILITY_TOLERANCE_PX = 1;

export function useLastChildVisibility(
  scrollElementRef: RefObject<HTMLDivElement | null>,
  pageCount: number,
  setIsLastChildVisible: (visible: boolean) => void
): void {
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
  }, [scrollElementRef, pageCount, setIsLastChildVisible]);

  // Note: `setIsLastChildVisible` is wrapped in useCallback by the caller, so it is stable.
}
```

- [ ] **Step 4: Refactor `use-slider.ts` to use the store and remove both `useState` calls**

Replace the state section. The full new file:

```ts
// src/use-slider.ts
'use client';
import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
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
import { createSliderStore } from './slider-store';
import type { SliderApi, SliderContextValue, SliderControl, SliderOptions } from './types';

type UseSliderParams = {
  options: SliderOptions;
  onMounted?: (api: SliderApi) => void;
  onDestroy?: () => void;
};

export function useSlider({ options, onMounted, onDestroy }: UseSliderParams): SliderContextValue {
  const store = useMemo(() => createSliderStore(), []);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const { currentIndex, pageCount, reachableCount, isLastChildVisible } = state;

  const breakpointWidths = useMemo(
    () => Object.keys(options.breakpoints ?? {}).map(Number),
    [options.breakpoints]
  );
  const responsiveStore = useMemo(
    () => createResponsiveStore(breakpointWidths, options.mediaQuery),
    [breakpointWidths, options.mediaQuery]
  );
  const viewportWidth = useSyncExternalStore(
    responsiveStore.subscribe,
    responsiveStore.getSnapshot,
    responsiveStore.getServerSnapshot
  );
  const resolvedOptions = useMemo(
    () => resolveOptions(options, viewportWidth),
    [options, viewportWidth]
  );

  const currentIndexRef = useRef(0);
  const scrollElementRef = useRef<HTMLDivElement | null>(null);
  const listenersRef = useRef(new Set<(i: number) => void>());

  const setPageCount = useCallback(
    (count: number) => store.setState({ pageCount: count }),
    [store]
  );
  const setReachableCount = useCallback(
    (count: number | null) => store.setState({ reachableCount: count }),
    [store]
  );
  const setIsLastChildVisible = useCallback(
    (visible: boolean) => store.setState({ isLastChildVisible: visible }),
    [store]
  );

  const registerScrollElement = useCallback((el: HTMLDivElement | null) => {
    scrollElementRef.current = el;
  }, []);

  const emitMoved = useCallback(
    (index: number) => {
      currentIndexRef.current = index;
      store.setState({ currentIndex: index });
      for (const l of listenersRef.current) {
        l(index);
      }
    },
    [store]
  );

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

  useReachableCount(scrollElementRef, pageCount, resolvedOptions, setReachableCount);
  useScrollSync(scrollElementRef, currentIndexRef, emitMoved);
  useLastChildVisibility(scrollElementRef, pageCount, setIsLastChildVisible);
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

- [ ] **Step 5: Run the full suite to verify behavior is unchanged**

Run: `pnpm test`
Expected: PASS — same count as Step 1.

- [ ] **Step 6: Verify no `useState` remains in source**

Run: `rg -n "useState" src/`
Expected: **no matches** (exit code 1 / empty output).

- [ ] **Step 7: Typecheck + lint**

Run: `pnpm typecheck && ./node_modules/.bin/biome check src/use-slider.ts src/hooks/use-reachable-count.ts src/hooks/use-last-child-visibility.ts`
Expected: no errors.

- [ ] **Step 8: Coverage gate**

Run: `pnpm test:cov`
Expected: PASS, coverage ≥ 99% on all metrics.

- [ ] **Step 9: Commit**

```bash
git add src/use-slider.ts src/hooks/use-reachable-count.ts src/hooks/use-last-child-visibility.ts
git commit -m "refactor: replace all useState with external store (no useState)"
```

---

## Task 3: Extract pure `computeScrollStyle` helper

**Files:**
- Create: `src/core/scroll-style.ts`
- Create: `src/core/scroll-style.test.ts`
- Modify: `src/core/index.ts` (re-export)
- Modify: `src/components/SliderTrack.tsx` (consume the helper — no behavior change)

**Interfaces:**
- Produces:
  - `type ScrollStyleResult = { style: CSSProperties; cssVars: Record<\`--${string}\`, string> }`
  - `function computeScrollStyle(options: SliderOptions): ScrollStyleResult` — returns the scroll container's structural style (display/snap/overflow/gap/padding/touchAction) and the `--slider-gap` / `--slider-padding-left` / `--slider-padding-right` custom properties, matching `SliderTrack`'s current inline output exactly.
- Consumed by: `SliderTrack` (Task 6/render) and `SliderRuntime` (Task 8/imperative responsive sync).

This is a pure extraction of the logic currently inline in `SliderTrack.tsx:73-103`.

- [ ] **Step 1: Write the failing test**

```ts
// src/core/scroll-style.test.ts
import { describe, expect, it } from 'vitest';
import { computeScrollStyle } from './scroll-style';

describe('computeScrollStyle', () => {
  it('emits the baseline structural styles', () => {
    const { style } = computeScrollStyle({});
    expect(style.display).toBe('flex');
    expect(style.scrollSnapType).toBe('x mandatory');
    expect(style.overflowX).toBe('auto');
    expect(style.overflowY).toBe('hidden');
    expect(style.overscrollBehaviorX).toBe('contain');
    expect(style.scrollbarWidth).toBe('none');
    expect(style.scrollBehavior).toBe('smooth');
  });

  it('defaults gap and padding custom properties to 0px', () => {
    const { cssVars } = computeScrollStyle({});
    expect(cssVars['--slider-gap']).toBe('0px');
    expect(cssVars['--slider-padding-left']).toBe('0px');
    expect(cssVars['--slider-padding-right']).toBe('0px');
  });

  it('forwards gap (string and number) to style and custom property', () => {
    expect(computeScrollStyle({ gap: '12px' }).style.gap).toBe('12px');
    expect(computeScrollStyle({ gap: 8 }).style.gap).toBe('8px');
    expect(computeScrollStyle({ gap: '12px' }).cssVars['--slider-gap']).toBe('12px');
  });

  it('applies object padding to padding + scroll-padding and custom properties', () => {
    const { style, cssVars } = computeScrollStyle({ padding: { left: '20px', right: '10px' } });
    expect(style.paddingLeft).toBe('20px');
    expect(style.paddingRight).toBe('10px');
    expect(style.scrollPaddingLeft).toBe('20px');
    expect(style.scrollPaddingRight).toBe('10px');
    expect(cssVars['--slider-padding-left']).toBe('20px');
    expect(cssVars['--slider-padding-right']).toBe('10px');
  });

  it('applies scalar padding symmetrically', () => {
    expect(computeScrollStyle({ padding: 16 }).style.paddingLeft).toBe('16px');
    expect(computeScrollStyle({ padding: '1rem' }).style.paddingRight).toBe('1rem');
  });

  it('leaves padding / scroll-padding unset when no padding option', () => {
    const { style } = computeScrollStyle({});
    expect(style.paddingLeft).toBeUndefined();
    expect(style.scrollPaddingLeft).toBeUndefined();
  });

  it('sets touch-action pan-y only when drag is disabled', () => {
    expect(computeScrollStyle({ drag: false }).style.touchAction).toBe('pan-y');
    expect(computeScrollStyle({ drag: true }).style.touchAction).toBeUndefined();
    expect(computeScrollStyle({}).style.touchAction).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/core/scroll-style.test.ts`
Expected: FAIL — `Cannot find module './scroll-style'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/core/scroll-style.ts
import type { CSSProperties } from 'react';
import type { SliderOptions } from '../types';
import { toCssUnit } from './units';

export type ScrollStyleResult = {
  style: CSSProperties;
  cssVars: Record<`--${string}`, string>;
};

export function computeScrollStyle(options: SliderOptions): ScrollStyleResult {
  const gap = toCssUnit(options.gap) ?? '0px';
  const hasPadding = options.padding !== undefined;
  const pad =
    typeof options.padding === 'object'
      ? options.padding
      : { left: options.padding, right: options.padding };
  const paddingLeft = toCssUnit(pad?.left) ?? '0px';
  const paddingRight = toCssUnit(pad?.right) ?? '0px';

  const style: CSSProperties = {
    display: 'flex',
    scrollSnapType: 'x mandatory',
    overflowX: 'auto',
    overflowY: 'hidden',
    overscrollBehaviorX: 'contain',
    scrollbarWidth: 'none',
    scrollBehavior: 'smooth',
    gap,
    ...(hasPadding
      ? {
          paddingLeft,
          paddingRight,
          scrollPaddingLeft: paddingLeft,
          scrollPaddingRight: paddingRight,
        }
      : {}),
    ...(options.drag === false ? { touchAction: 'pan-y' } : {}),
  };

  const cssVars: Record<`--${string}`, string> = {
    '--slider-gap': gap,
    '--slider-padding-left': paddingLeft,
    '--slider-padding-right': paddingRight,
  };

  return { style, cssVars };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/core/scroll-style.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Re-export from core**

Add to `src/core/index.ts` (keep existing exports; append):

```ts
export { computeScrollStyle, type ScrollStyleResult } from './scroll-style';
```

- [ ] **Step 6: Refactor `SliderTrack` to consume the helper (no behavior change)**

In `src/components/SliderTrack.tsx`, replace the inline `scrollStyle` construction (the `gap`/`hasPadding`/`pad`/`paddingLeft`/`paddingRight` block and the `scrollStyle` object literal, lines ~73-103) with:

```ts
import { computeScrollStyle, getGridDimensions, toCssUnit } from '../core';
// ...
const { style: scrollBaseStyle, cssVars: scrollCssVars } = computeScrollStyle(carousel.options);
const gap = toCssUnit(carousel.options.gap) ?? '0px'; // still needed for grid row/col fallbacks below
const scrollStyle: CSSProperties & Record<`--${string}`, string> = {
  ...scrollBaseStyle,
  ...scrollCssVars,
};
```

Leave the rest of `SliderTrack` (grid rendering, `gap` usage in grid gaps, the JSX) unchanged. `carousel` is still read from context in this task.

- [ ] **Step 7: Run the Track + full suite**

Run: `pnpm test src/components/SliderTrack.browser.test.tsx && pnpm test`
Expected: PASS (all Track structural-style assertions unchanged).

- [ ] **Step 8: Typecheck + lint**

Run: `pnpm typecheck && ./node_modules/.bin/biome check src/core/scroll-style.ts src/core/scroll-style.test.ts src/core/index.ts src/components/SliderTrack.tsx`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/core/scroll-style.ts src/core/scroll-style.test.ts src/core/index.ts src/components/SliderTrack.tsx
git commit -m "refactor: extract pure computeScrollStyle helper"
```

---

## Task 4: Introduce `SliderRuntime` island; `Slider` delegates + injects options to Track

**Files:**
- Create: `src/components/SliderRuntime.tsx`
- Create: `src/components/SliderRuntime.browser.test.tsx`
- Modify: `src/components/Slider.tsx`
- Modify: `src/types.ts` (add `SliderInjectedOptions`)

**Interfaces:**
- Consumes: `useSlider`, `SliderContext`.
- Produces:
  - `type SliderInjectedOptions = { __sliderOptions?: SliderOptions }` (internal injection prop).
  - `SliderRuntime(props: { options: SliderOptions; onMounted?: (api: SliderApi) => void; onDestroy?: () => void; children?: ReactNode }): JSX.Element` — client island. Calls `useSlider`, provides `SliderContext`, wraps children in a `display: contents` div, and on each render measures the DOM: `querySelector<HTMLDivElement>('[data-slider-scroll]')` → `registerScrollElement`, and `querySelectorAll('[data-carousel-page]').length` → `setPageCount`.
- At this task, `Slider` still has `'use client'`; `SliderTrack` still reports `setPageCount` via its own effect. The runtime's `setPageCount` reports the **same** count, so double-reporting is a harmless no-op (store dedups). `Slider` also begins injecting `__sliderOptions` into its `SliderTrack` child, but `SliderTrack` still reads context (ignores the prop for now).

- [ ] **Step 1: Add the injected-options type**

Append to `src/types.ts`:

```ts
export type SliderInjectedOptions = {
  /** Internal: resolved options injected by <Slider> into structural children. Not part of the public API. */
  __sliderOptions?: SliderOptions;
};
```

- [ ] **Step 2: Write the failing runtime test**

```tsx
// src/components/SliderRuntime.browser.test.tsx
import { render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useSliderContext } from '../slider-context';
import type { SliderContextValue } from '../types';
import { SliderRuntime } from './SliderRuntime';

it('provides context and reports measured page count to consumers', async () => {
  const captured: { ctx: SliderContextValue | null } = { ctx: null };
  function Probe() {
    captured.ctx = useSliderContext();
    return null;
  }
  render(
    <SliderRuntime options={{ perPage: 1 }}>
      <Probe />
      <div data-slider-scroll="" style={{ display: 'flex', width: 200, overflowX: 'auto' }}>
        <div data-carousel-page="true" style={{ flex: '0 0 200px', width: 200 }}>
          a
        </div>
        <div data-carousel-page="true" style={{ flex: '0 0 200px', width: 200 }}>
          b
        </div>
      </div>
    </SliderRuntime>
  );
  await vi.waitFor(() => {
    expect(captured.ctx?.pageCount).toBe(2);
  });
});

it('calls onMounted with the imperative api', async () => {
  const onMounted = vi.fn();
  render(
    <SliderRuntime options={{ perPage: 1 }} onMounted={onMounted}>
      <div data-slider-scroll="">
        <div data-carousel-page="true">a</div>
      </div>
    </SliderRuntime>
  );
  await vi.waitFor(() => expect(onMounted).toHaveBeenCalledTimes(1));
});

it('wrapper uses display: contents so it is layout-transparent', () => {
  const { container } = render(
    <SliderRuntime options={{}}>
      <span>x</span>
    </SliderRuntime>
  );
  const wrapper = container.querySelector<HTMLElement>('[data-slider-runtime]');
  if (!wrapper) throw new Error('runtime wrapper not found');
  expect(wrapper.style.display).toBe('contents');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test src/components/SliderRuntime.browser.test.tsx`
Expected: FAIL — `Cannot find module './SliderRuntime'`.

- [ ] **Step 4: Implement `SliderRuntime`**

```tsx
// src/components/SliderRuntime.tsx
'use client';
import { type ReactNode, useEffect, useRef } from 'react';
import { SliderContext } from '../slider-context';
import type { SliderApi, SliderOptions } from '../types';
import { useSlider } from '../use-slider';

type SliderRuntimeProps = {
  options: SliderOptions;
  onMounted?: (api: SliderApi) => void;
  onDestroy?: () => void;
  children?: ReactNode;
};

export function SliderRuntime({ options, onMounted, onDestroy, children }: SliderRuntimeProps) {
  const ctx = useSlider({ options, onMounted, onDestroy });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { registerScrollElement, setPageCount } = ctx;

  // Measure the DOM after every render: register the scroll element and report the
  // current page count. Both are idempotent (registerScrollElement stores a ref;
  // setPageCount dedups in the store), so re-running on each render is safe and keeps
  // the count correct when children change.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const scroll = root.querySelector<HTMLDivElement>('[data-slider-scroll]');
    registerScrollElement(scroll);
    setPageCount(root.querySelectorAll('[data-carousel-page]').length);
  });

  return (
    <SliderContext.Provider value={ctx}>
      <div ref={rootRef} data-slider-runtime="" style={{ display: 'contents' }}>
        {children}
      </div>
    </SliderContext.Provider>
  );
}

export default SliderRuntime;
```

- [ ] **Step 5: Run runtime test to verify it passes**

Run: `pnpm test src/components/SliderRuntime.browser.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Make `Slider` delegate to the runtime and inject options into its Track child**

Replace `src/components/Slider.tsx` with (still `'use client'` in this task):

```tsx
// src/components/Slider.tsx
'use client';
import { Children, cloneElement, isValidElement, type ReactElement } from 'react';
import { resolveOptions } from '../core';
import type { SliderInjectedOptions, SliderOptions, SliderProps } from '../types';
import { SliderRuntime } from './SliderRuntime';
import { SliderTrack } from './SliderTrack';

function injectIntoTrack(children: SliderProps['children'], options: SliderOptions) {
  return Children.map(children, (child) => {
    if (isValidElement(child) && child.type === SliderTrack) {
      const injected: SliderInjectedOptions = { __sliderOptions: options };
      const trackChild: ReactElement<SliderInjectedOptions> = child;
      return cloneElement(trackChild, injected);
    }
    return child;
  });
}

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
  const resolved = resolveOptions(options ?? {}, null);
  return (
    <section
      aria-label={ariaLabel}
      className={className}
      style={{ position: 'relative', ...style }}
      {...rest}
    >
      <SliderRuntime options={options ?? {}} onMounted={onMounted} onDestroy={onDestroy}>
        {injectIntoTrack(children, resolved)}
      </SliderRuntime>
    </section>
  );
}

export default Slider;
```

Notes: `resolveOptions(options ?? {}, null)` resolves **base** options (no viewport) for server injection; `SliderRuntime` still passes the **raw** `options` to `useSlider`, which keeps resolving responsively on the client. `injectIntoTrack` only clones direct `SliderTrack` children (reference-equality on `child.type`).

- [ ] **Step 7: Run the full suite**

Run: `pnpm test`
Expected: PASS. The `Slider`/Arrows/Pagination/Slide/Track browser tests still pass (Track still reads context; runtime + Track both report the same pageCount).

- [ ] **Step 8: Typecheck + lint + coverage**

Run: `pnpm typecheck && ./node_modules/.bin/biome check src/components/SliderRuntime.tsx src/components/SliderRuntime.browser.test.tsx src/components/Slider.tsx src/types.ts && pnpm test:cov`
Expected: no errors; coverage ≥ 99%.

- [ ] **Step 9: Commit**

```bash
git add src/components/SliderRuntime.tsx src/components/SliderRuntime.browser.test.tsx src/components/Slider.tsx src/types.ts
git commit -m "feat: add SliderRuntime client island; Slider delegates + injects options"
```

---

## Task 5: `SliderTrack` injects `__sliderOptions` into flat component slides (plumbing)

**Files:**
- Modify: `src/components/SliderTrack.tsx`

**Interfaces:**
- Produces: in flat mode, each cloned slide that is a **component element** (`typeof child.type !== 'string'`) receives `__sliderOptions` (the resolved options) in addition to `data-carousel-page`. Host elements (raw `<div>`) are not injected (avoids invalid DOM props).
- `SliderSlide` still reads context in this task (ignores the prop) — pure plumbing, no behavior change.

- [ ] **Step 1: Confirm green baseline**

Run: `pnpm test src/components/SliderTrack.browser.test.tsx src/components/SliderSlide.browser.test.tsx`
Expected: PASS.

- [ ] **Step 2: Inject options into flat component slides**

In `src/components/SliderTrack.tsx`, update `renderFlatPage` to also pass `__sliderOptions` for component elements:

```tsx
import type { SliderInjectedOptions } from '../types';
// ...
const renderFlatPage = (page: ReactElement, pageIndex: number) => {
  const base: Attributes & { 'data-carousel-page': true } = {
    // v8 ignore next -- Children.toArray always assigns keys; `?? \`page-${pageIndex}\`` is unreachable
    key: page.key ?? `page-${pageIndex}`,
    'data-carousel-page': true,
  };
  // Inject resolved options only into component slides (e.g. <SliderSlide>); never onto
  // host elements like <div>, where an unknown prop would reach the DOM.
  if (typeof page.type === 'string') {
    return cloneElement(page, base);
  }
  const injected: typeof base & SliderInjectedOptions = {
    ...base,
    __sliderOptions: carousel.options,
  };
  return cloneElement(page, injected);
};
```

(`carousel` is still the context value in this task.)

- [ ] **Step 3: Run the Track + Slide + full suite**

Run: `pnpm test`
Expected: PASS (unchanged output — `SliderSlide` still ignores the new prop).

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm typecheck && ./node_modules/.bin/biome check src/components/SliderTrack.tsx`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/SliderTrack.tsx
git commit -m "refactor: SliderTrack injects resolved options into flat component slides"
```

---

## Task 6: Convert `SliderSlide` to a server component

**Files:**
- Modify: `src/components/SliderSlide.tsx`

**Interfaces:**
- Consumes: `__sliderOptions` injected by `SliderTrack` (Task 5).
- Produces: `SliderSlide` reads options from `props.__sliderOptions` instead of context. When absent (rendered standalone), returns a plain `div` (same as today). No `useContext`, no `'use client'`.

- [ ] **Step 1: Rewrite `SliderSlide` to use the injected options**

```tsx
// src/components/SliderSlide.tsx
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { toCssUnit } from '../core';
import type { SliderInjectedOptions } from '../types';

type SliderSlideProps = HTMLAttributes<HTMLDivElement> &
  SliderInjectedOptions & { children?: ReactNode };

export function SliderSlide({
  className,
  style,
  children,
  __sliderOptions,
  ...rest
}: SliderSlideProps) {
  if (!__sliderOptions) {
    return (
      <div className={className} style={style} {...rest}>
        {children}
      </div>
    );
  }
  const fixedWidth = toCssUnit(__sliderOptions.fixedWidth);
  const gap = toCssUnit(__sliderOptions.gap) ?? '0px';
  // v8 ignore next -- perPage is always set by resolveOptions defaults; `?? 1` is unreachable
  const perPage = __sliderOptions.perPage ?? 1;
  const width = fixedWidth
    ? fixedWidth
    : `calc((100% - (${gap} * ${Math.max(perPage - 1, 0)})) / ${perPage})`;
  const slideStyle: CSSProperties = {
    minWidth: 0,
    flexShrink: 0,
    scrollSnapAlign: 'start',
    width,
    ...style,
  };
  return (
    <div className={className} style={slideStyle} {...rest}>
      {children}
    </div>
  );
}

export default SliderSlide;
```

Key points: destructuring `__sliderOptions` out of props keeps it off the spread DOM `...rest`. The `__sliderOptions` injected by Track carries the controller's resolved options (same source the context previously provided), so widths render identically. Standalone (`__sliderOptions` undefined) → plain div, satisfying "renders plain div without a Slider context" (`SliderSlide.browser.test.tsx:7`).

- [ ] **Step 2: Run the Slide + headless + full suite**

Run: `pnpm test src/components/SliderSlide.browser.test.tsx src/components/Slider.browser.test.tsx src/components/SliderPagination.browser.test.tsx && pnpm test`
Expected: PASS. `applies fixedWidth` (`10rem`), `uses calc width…`, base structural styles, and user-style precedence all hold because the computation is identical, now fed by the injected options.

- [ ] **Step 3: Verify `SliderSlide` no longer imports React client features**

Run: `rg -n "use client|useContext|useSliderContext" src/components/SliderSlide.tsx`
Expected: no matches.

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm typecheck && ./node_modules/.bin/biome check src/components/SliderSlide.tsx`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/SliderSlide.tsx
git commit -m "feat: SliderSlide is now a server component (options via injection)"
```

---

## Task 7: Convert `SliderTrack` to a server component

**Files:**
- Modify: `src/components/SliderTrack.tsx`

**Interfaces:**
- Consumes: `__sliderOptions` injected by `Slider` (Task 4).
- Produces: `SliderTrack` reads options from `props.__sliderOptions`; no context, no `useMemo`, no `useEffect` (the runtime reports `pageCount`), no `'use client'`. When `__sliderOptions` is absent (standalone, no `Slider` parent) → returns `null` (preserves "SliderTrack renders null outside a Slider", `headless.browser.test.tsx:34`).

- [ ] **Step 1: Rewrite `SliderTrack` as a pure server component**

```tsx
// src/components/SliderTrack.tsx
import {
  type Attributes,
  Children,
  type CSSProperties,
  cloneElement,
  type HTMLAttributes,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { computeScrollStyle, getGridDimensions, toCssUnit } from '../core';
import type { SliderInjectedOptions, SliderOptions } from '../types';

type SliderTrackProps = HTMLAttributes<HTMLDivElement> &
  SliderInjectedOptions & {
    className?: string;
    style?: CSSProperties;
    scrollClassName?: string;
    gridClassName?: string;
    cssGridRows?: number;
    children?: ReactNode;
  };

function isGrouped(pages: ReactElement[] | ReactElement[][]): pages is ReactElement[][] {
  return Array.isArray(pages[0]);
}

function groupPages(
  children: ReactNode,
  cssGridRows: number | undefined,
  options: SliderOptions
): ReactElement[] | ReactElement[][] {
  const slides = Children.toArray(children).filter(isValidElement);
  if (cssGridRows) {
    const cols: ReactElement[][] = [];
    for (let i = 0; i < slides.length; i += cssGridRows) {
      cols.push(slides.slice(i, i + cssGridRows));
    }
    return cols;
  }
  const gridDimensions = getGridDimensions(options.grid);
  if (!gridDimensions) {
    return slides;
  }
  const grouped: ReactElement[][] = [];
  for (let i = 0; i < slides.length; i += gridDimensions.itemsPerPage) {
    grouped.push(slides.slice(i, i + gridDimensions.itemsPerPage));
  }
  return grouped;
}

export function SliderTrack({
  className,
  style,
  scrollClassName,
  gridClassName,
  cssGridRows,
  children,
  __sliderOptions,
  ...rest
}: SliderTrackProps) {
  if (!__sliderOptions) {
    return null;
  }
  const options = __sliderOptions;
  const gridDimensions = getGridDimensions(options.grid);
  const pages = groupPages(children, cssGridRows, options);

  const { style: scrollBaseStyle, cssVars: scrollCssVars } = computeScrollStyle(options);
  const gap = toCssUnit(options.gap) ?? '0px';
  const scrollStyle: CSSProperties & Record<`--${string}`, string> = {
    ...scrollBaseStyle,
    ...scrollCssVars,
  };

  const renderGroupedPage = (page: ReactElement[], pageIndex: number) => {
    // v8 ignore next -- Children.toArray always assigns keys; `?? pageIndex` is unreachable
    const pageKey = page.map((p) => p.key ?? pageIndex).join('--');
    const innerStyle: CSSProperties = cssGridRows
      ? {
          display: 'grid',
          height: '100%',
          gridTemplateRows: `repeat(${cssGridRows}, minmax(0, 1fr))`,
          rowGap: toCssUnit(options.grid?.gap?.row) ?? gap,
        }
      : {
          display: 'grid',
          gridTemplateColumns: `repeat(${gridDimensions?.columns}, minmax(0, 1fr))`,
          columnGap: toCssUnit(options.grid?.gap?.col) ?? gap,
          rowGap: toCssUnit(options.grid?.gap?.row) ?? gap,
        };
    return (
      <div
        key={`page-${pageKey}`}
        className={gridClassName}
        data-carousel-page="true"
        style={{ width: '100%', flex: '0 0 100%', minWidth: 0, scrollSnapAlign: 'start' }}
      >
        <div style={innerStyle}>
          {page.map((child, ci) => {
            // v8 ignore next -- Children.toArray always assigns keys; right side of `?? ci` is unreachable
            const itemKey = `item-${pageKey}-${child.key ?? ci}`;
            return (
              <div key={itemKey} style={{ width: '100%' }}>
                {child}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderFlatPage = (page: ReactElement, pageIndex: number) => {
    const base: Attributes & { 'data-carousel-page': true } = {
      // v8 ignore next -- Children.toArray always assigns keys; `?? \`page-${pageIndex}\`` is unreachable
      key: page.key ?? `page-${pageIndex}`,
      'data-carousel-page': true,
    };
    if (typeof page.type === 'string') {
      return cloneElement(page, base);
    }
    const injected: typeof base & SliderInjectedOptions = {
      ...base,
      __sliderOptions: options,
    };
    return cloneElement(page, injected);
  };

  return (
    <div {...rest} className={className} style={{ overflow: 'hidden', ...style }}>
      <div
        ref={undefined}
        className={scrollClassName}
        data-slider-scroll=""
        style={scrollStyle}
      >
        {isGrouped(pages) ? pages.map(renderGroupedPage) : pages.map(renderFlatPage)}
      </div>
    </div>
  );
}

export default SliderTrack;
```

Notes: the scroll element no longer takes `ref={carousel.registerScrollElement}` — the runtime finds it via `[data-slider-scroll]`. Drop the `ref` line entirely (shown as `ref={undefined}` for clarity; in the final code, **omit the `ref` prop**). The `'use client'`, `useMemo`, `useEffect`, and `useSliderContext` imports are all gone.

- [ ] **Step 2: Remove the `ref={undefined}` placeholder**

Edit the scroll `<div>` to have no `ref` prop at all:

```tsx
      <div className={scrollClassName} data-slider-scroll="" style={scrollStyle}>
```

- [ ] **Step 3: Run the Track + headless + full suite**

Run: `pnpm test`
Expected: PASS. Track structural-style tests, grid/cssGridRows grouping, padding/gap, `data-testid` forwarding, and "renders null outside a Slider" all hold. Real-`<Slider>` pagination/measurement tests pass because the runtime now solely reports `pageCount` and the controller measures `reachableCount` from the same `[data-slider-scroll]`.

- [ ] **Step 4: Verify `SliderTrack` is free of client features**

Run: `rg -n "use client|useContext|useSliderContext|useEffect|useMemo" src/components/SliderTrack.tsx`
Expected: no matches.

- [ ] **Step 5: Typecheck + lint + coverage**

Run: `pnpm typecheck && ./node_modules/.bin/biome check src/components/SliderTrack.tsx && pnpm test:cov`
Expected: no errors; coverage ≥ 99%.

- [ ] **Step 6: Commit**

```bash
git add src/components/SliderTrack.tsx
git commit -m "feat: SliderTrack is now a server component (no context/effect)"
```

---

## Task 8: Make `Slider` a server component + responsive style sync in the runtime

**Files:**
- Modify: `src/components/Slider.tsx` (remove `'use client'`; set section CSS vars)
- Modify: `src/components/SliderRuntime.tsx` (imperatively sync responsive scroll styles via `computeScrollStyle`)
- Test: extend `src/components/SliderRuntime.browser.test.tsx`

**Interfaces:**
- `Slider` becomes a pure server component: it computes nothing that needs hooks (already delegates interactivity to `SliderRuntime`). It additionally sets the `--slider-*` custom properties (from `computeScrollStyle(resolved).cssVars`) on the `<section>` so they inherit to descendants.
- `SliderRuntime` gains an effect that, when `ctx.options` changes (viewport breakpoints), re-applies `computeScrollStyle(ctx.options)` imperatively onto the live `[data-slider-scroll]` element — preserving responsive *style* updates that previously came from `SliderTrack` re-rendering on context.

- [ ] **Step 1: Remove `'use client'` from `Slider` and set section CSS vars**

Update `src/components/Slider.tsx`:

```tsx
// src/components/Slider.tsx
import { Children, cloneElement, isValidElement, type ReactElement } from 'react';
import { computeScrollStyle, resolveOptions } from '../core';
import type { SliderInjectedOptions, SliderOptions, SliderProps } from '../types';
import { SliderRuntime } from './SliderRuntime';
import { SliderTrack } from './SliderTrack';

function injectIntoTrack(children: SliderProps['children'], options: SliderOptions) {
  return Children.map(children, (child) => {
    if (isValidElement(child) && child.type === SliderTrack) {
      const injected: SliderInjectedOptions = { __sliderOptions: options };
      const trackChild: ReactElement<SliderInjectedOptions> = child;
      return cloneElement(trackChild, injected);
    }
    return child;
  });
}

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
  const resolved = resolveOptions(options ?? {}, null);
  const { cssVars } = computeScrollStyle(resolved);
  const sectionStyle: React.CSSProperties & Record<`--${string}`, string> = {
    position: 'relative',
    ...cssVars,
    ...style,
  };
  return (
    <section aria-label={ariaLabel} className={className} style={sectionStyle} {...rest}>
      <SliderRuntime options={options ?? {}} onMounted={onMounted} onDestroy={onDestroy}>
        {injectIntoTrack(children, resolved)}
      </SliderRuntime>
    </section>
  );
}

export default Slider;
```

Note: import the `CSSProperties` type explicitly rather than via the `React.` namespace to satisfy lint:

```tsx
import { Children, cloneElement, type CSSProperties, isValidElement, type ReactElement } from 'react';
// ...
const sectionStyle: CSSProperties & Record<`--${string}`, string> = { position: 'relative', ...cssVars, ...style };
```

- [ ] **Step 2: Add the responsive style-sync effect to `SliderRuntime`**

Update `src/components/SliderRuntime.tsx` to apply scroll styles imperatively when `ctx.options` changes:

```tsx
'use client';
import { type ReactNode, useEffect, useRef } from 'react';
import { computeScrollStyle } from '../core';
import { SliderContext } from '../slider-context';
import type { SliderApi, SliderOptions } from '../types';
import { useSlider } from '../use-slider';

type SliderRuntimeProps = {
  options: SliderOptions;
  onMounted?: (api: SliderApi) => void;
  onDestroy?: () => void;
  children?: ReactNode;
};

export function SliderRuntime({ options, onMounted, onDestroy, children }: SliderRuntimeProps) {
  const ctx = useSlider({ options, onMounted, onDestroy });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { registerScrollElement, setPageCount } = ctx;
  const resolvedOptions = ctx.options;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const scroll = root.querySelector<HTMLDivElement>('[data-slider-scroll]');
    registerScrollElement(scroll);
    setPageCount(root.querySelectorAll('[data-carousel-page]').length);
  });

  // Responsive: when resolved options change across a breakpoint on the client, re-apply
  // the scroll container's style + custom properties (the server rendered base options).
  useEffect(() => {
    const root = rootRef.current;
    const scroll = root?.querySelector<HTMLDivElement>('[data-slider-scroll]');
    if (!scroll) {
      return;
    }
    const { style, cssVars } = computeScrollStyle(resolvedOptions);
    for (const [key, value] of Object.entries(style)) {
      scroll.style.setProperty(camelToKebab(key), String(value));
    }
    for (const [key, value] of Object.entries(cssVars)) {
      scroll.style.setProperty(key, value);
    }
  }, [resolvedOptions]);

  return (
    <SliderContext.Provider value={ctx}>
      <div ref={rootRef} data-slider-runtime="" style={{ display: 'contents' }}>
        {children}
      </div>
    </SliderContext.Provider>
  );
}

function camelToKebab(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

export default SliderRuntime;
```

- [ ] **Step 3: Add a test for the responsive sync (mount applies current options)**

Append to `src/components/SliderRuntime.browser.test.tsx`:

```tsx
it('applies scroll styles imperatively from resolved options on mount', async () => {
  const { container } = render(
    <SliderRuntime options={{ gap: '12px', padding: { left: '20px', right: '10px' } }}>
      <div data-slider-scroll="">
        <div data-carousel-page="true">a</div>
      </div>
    </SliderRuntime>
  );
  const scroll = container.querySelector<HTMLElement>('[data-slider-scroll]');
  if (!scroll) throw new Error('scroll not found');
  await vi.waitFor(() => {
    expect(scroll.style.gap).toBe('12px');
    expect(scroll.style.paddingLeft).toBe('20px');
    expect(scroll.style.getPropertyValue('--slider-gap')).toBe('12px');
  });
});
```

- [ ] **Step 4: Run the runtime + full suite**

Run: `pnpm test`
Expected: PASS. `Slider.browser.test.tsx` (`section` style/position/merge), CSS-var inheritance tests on the scroll element (`SliderTrack.browser.test.tsx` "scroll container exposes CSS custom properties") still pass — Track sets them inline and the section also sets them; both resolve to the same values.

- [ ] **Step 5: Verify `Slider` is free of client features**

Run: `rg -n "use client|useContext|useSlider\b|useState|useEffect" src/components/Slider.tsx`
Expected: no matches (it imports `SliderRuntime`, not the hook).

- [ ] **Step 6: Typecheck + lint + coverage**

Run: `pnpm typecheck && ./node_modules/.bin/biome check src/components/Slider.tsx src/components/SliderRuntime.tsx src/components/SliderRuntime.browser.test.tsx && pnpm test:cov`
Expected: no errors; coverage ≥ 99%.

- [ ] **Step 7: Commit**

```bash
git add src/components/Slider.tsx src/components/SliderRuntime.tsx src/components/SliderRuntime.browser.test.tsx
git commit -m "feat: Slider is now a server component + responsive style sync in runtime"
```

---

## Task 9: Finalize `'use client'` boundary + full verification

**Files:**
- Verify directives across `src/`.
- Run the complete CI gate.

**Interfaces:** none. This task asserts the final state and ships the green build.

- [ ] **Step 1: Confirm the intended `'use client'` set**

Run: `rg -l "use client" src/`
Expected exactly these files (and no others):
- `src/use-slider.ts`
- `src/slider-context.ts`
- `src/hooks/use-imperative-api.ts`
- `src/hooks/use-last-child-visibility.ts`
- `src/hooks/use-reachable-count.ts`
- `src/hooks/use-scroll-sync.ts`
- `src/components/SliderRuntime.tsx`
- `src/components/SliderArrows.tsx`
- `src/components/SliderPagination.tsx`

- [ ] **Step 2: Confirm the structural components are server components (no directive)**

Run: `rg -n "use client" src/components/Slider.tsx src/components/SliderTrack.tsx src/components/SliderSlide.tsx`
Expected: no matches.

- [ ] **Step 3: Confirm `useState` is gone repo-wide**

Run: `rg -n "useState" src/`
Expected: no matches.

- [ ] **Step 4: Full CI gate**

Run: `pnpm check`
Expected: lint + typecheck + `test:cov` all PASS; coverage ≥ 99% on every metric.

Note: `pnpm lint` here runs the real Biome script in CI; locally it may be hijacked by the RTK proxy — if so, run `./node_modules/.bin/biome check .` instead and `pnpm typecheck && pnpm test:cov` separately.

- [ ] **Step 5: Build smoke test**

Run: `pnpm build`
Expected: tsup emits ESM+CJS+d.ts and `styles.css` is copied, no errors.

- [ ] **Step 6: Commit any final lint fixes (if Step 4 wrote changes)**

```bash
git add -A
git commit -m "chore: finalize SSR-first boundary; verify no useState, minimal use client"
```

---

## Self-Review

**1. Spec coverage**

| Spec requirement | Task |
|---|---|
| Remove all `useState` → external store | Tasks 1–2 (verified Step 6/3 grep) |
| `useSyncExternalStore` reads store; SSR-safe `getServerSnapshot` | Task 1 (test), Task 2 |
| Frozen `useSlider`/`SliderContext` public surface | Task 2 (guard suite) |
| `Slider` server component, resolves base options, sets CSS vars, injects into Track | Tasks 4 + 8 |
| `SliderTrack` server component (grouping, styles, no effect/context) | Tasks 5 + 7 |
| `SliderSlide` server component (width via injection/CSS) | Tasks 5 + 6 |
| `SliderRuntime` client island (measures scroll + pageCount, provides context, onMounted/onDestroy) | Tasks 4 + 8 |
| Options distribution: CSS vars + `cloneElement` injection | Tasks 4–8 |
| `SliderArrows`/`SliderPagination` stay client, unchanged | (untouched; verified Task 9 Step 1) |
| Responsive style sync on viewport change | Task 8 |
| `'use client'` only on the interactive island set | Task 9 |
| Coverage ≥ 99% | Tasks 2, 7, 8 (`test:cov`), Task 9 |
| `computeScrollStyle` pure helper, node-tested, reused | Task 3 + Task 8 |

Known-limitation items from the spec (per-breakpoint *structural* regrouping not re-run on client; pagination/arrow state client-driven; direct-child Track composition) are accepted non-goals — no task required.

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N". Every code step shows complete code; the one `ref={undefined}` placeholder in Task 7 Step 1 is explicitly removed in Task 7 Step 2.

**3. Type consistency:** `SliderInjectedOptions.__sliderOptions` is defined in Task 4 Step 1 and consumed identically in Tasks 5 (`SliderTrack`), 6 (`SliderSlide`), 7 (`SliderTrack`), 8 (`Slider`). `computeScrollStyle`/`ScrollStyleResult` defined in Task 3 and consumed in Tasks 7–8. `createSliderStore`/`SliderState`/`setState`/`getServerSnapshot` defined in Task 1 and consumed in Task 2. Hook signatures `useReachableCount(..., setReachableCount)` and `useLastChildVisibility(..., setIsLastChildVisible)` defined and consumed consistently in Task 2.
