# Headless Slider Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `light-splide-slide` as a truly headless, SSR-safe, dependency-light React slider with a clean 1.0 API, built test-first to a ≥99% coverage gate.

**Architecture:** Three layers with a strict dependency direction `presentation → controller → core`. A pure, DOM-free core (`src/core/`) holds all option/geometry math. A single controller hook (`src/use-slider.ts`) owns state, prop-getters, the imperative API, and SSR-safe responsive resolution via `useSyncExternalStore`. Thin, side-effect-free components (`src/components/`) consume the controller through context and forward `className`/`style`/`ref`/`data-*`. Styling is unopinionated: structural inline styles only, `data-*` state hooks, CSS custom properties, and an optional baseline stylesheet.

**Tech Stack:** React 18+ (peer), TypeScript, Vitest (node + Browser Mode/Playwright Chromium), Biome (lint/format), tsup (ESM+CJS+d.ts build), v8 coverage.

## Global Constraints

- **No runtime UI dependencies.** Remove `tailwind-merge`. `react`/`react-dom` stay peer deps (`>=18`). No Tailwind requirement.
- **Headless / no fixed colors.** Components emit only structural inline styles (flex, snap, overflow, computed slide width, gap/padding CSS vars). No color/visual styling in JS. Every component accepts `className` AND `style`, forwards `...rest` and `ref`, and emits documented `data-*` state.
- **SSR-first.** No component reads `window`/`document` during render. Server render and first client render must be byte-identical. Responsive option changes that need JS go through `useSyncExternalStore` with a `getServerSnapshot` returning base options.
- **TDD-first.** Every production line is preceded by a failing test. Order per unit: write failing test → run to confirm fail → minimal impl → run to confirm pass → commit.
- **Coverage gate ≥ 99%** for lines, statements, functions, branches — enforced in Vitest config; CI fails under threshold. Any exclusion uses an explicit commented `/* v8 ignore */`.
- **Clean 1.0 API.** Neutral naming (`Slider`, `SliderTrack`, `SliderSlide`, `SliderArrows`, `SliderPagination`, `useSlider`, `useSliderContext`). No `Splide*` aliases.
- **Lint/format:** Biome. Build: tsup. Package manager for dev: pnpm (scripts also run under npm).
- **TypeScript strictness — `any`, `unknown`, and type assertions are forbidden** (in source AND tests). No `as` casts (except the no-op `as const`), no `<T>value` casts, no non-null assertions (`!`), no `any`, no `unknown`. Use the cast-free patterns below instead. Biome enforces `noExplicitAny` and `noNonNullAssertion` as errors; the remaining `as`/`unknown` ban is a code rule verified in review.
- **Pruned options:** keep `arrows`, `drag`, `pagination`, `perPage`, `perMove`, `fixedWidth`, `fixedHeight`, `gap`, `padding`, `grid`, `mediaQuery`, `breakpoints`, `keyboard`, `type:'slide'`. Drop unimplemented passthroughs: `focus`, `omitEnd`, `lazyLoad`, `preloadPages`, `waitForTransition`.

---

## TypeScript Strictness Patterns (cast-free recipes)

Use these everywhere instead of `as` / `unknown` / `any` / `!`:

- **CSS custom properties in `style`** — annotate the variable, don't cast:
  ```ts
  const style: CSSProperties & Record<`--${string}`, string> = { display: 'flex', '--slider-gap': gap };
  ```
- **Narrowing React children** — `isValidElement` is a type guard; filter narrows with no cast:
  ```ts
  const slides = Children.toArray(children).filter(isValidElement); // ReactElement[]
  ```
  Read keys via `element.key` (already `string | null` on `ReactElement`) — no `& { key?: string }` intersection.
- **Distinguishing flat vs grouped pages** — a user-defined type guard, not a cast:
  ```ts
  function isGrouped(p: ReactElement[] | ReactElement[][]): p is ReactElement[][] {
    return Array.isArray(p[0]);
  }
  ```
- **`cloneElement` to inject a page marker** — build a typed props variable (structurally assignable to `Attributes`, extra `data-*` allowed via a variable, no excess-property check, no cast):
  ```ts
  const pageProps: Attributes & { 'data-carousel-page': true } = {
    key: page.key ?? `page-${pageIndex}`,
    'data-carousel-page': true,
  };
  return cloneElement(page, pageProps);
  ```
  (Do NOT spread `page.props` — `cloneElement` already preserves the original props.)
- **Querying DOM in tests** — use the typed generic form, never `as`:
  ```ts
  const section = container.querySelector<HTMLSelectElement | HTMLElement>('section');
  // simpler: container.querySelector<HTMLElement>('section')
  ```
- **Depend only on what you use (ISP)** — e.g. `getNearestPageIndex` takes `readonly Pick<HTMLElement, 'offsetLeft'>[]` so tests pass plain typed objects with no cast.
- **Validate object literals** with `satisfies` (allowed — it is not a cast) when you want a check without widening.

---

## File Structure

```
src/
  core/
    units.ts            # toCssUnit
    options.ts          # mergePadding, mergeGrid, mergeOptions, resolveOptions, DEFAULTS
    geometry.ts         # getGridDimensions, getPaginationCount, getMaxIndex,
                        #   resolveNextIndex, getNearestPageIndex
    index.ts            # barrel for core
  types.ts              # SliderOptions, SliderControl, SliderApi, SliderGrid,
                        #   SliderPadding, SliderContextValue, prop types, NavigationAction
  responsive-store.ts   # createResponsiveStore (useSyncExternalStore source)
  use-slider.ts         # controller hook: state, prop-getters, imperative api, SSR resolve
  slider-context.ts     # SliderContext + useSliderContext
  components/
    Slider.tsx
    SliderTrack.tsx
    SliderSlide.tsx
    SliderArrows.tsx
    SliderPagination.tsx
  icons/
    IconArrow.tsx       # neutral default arrow (currentColor)
  styles.css            # optional baseline theme (CSS vars + data-* selectors)
  index.ts              # public barrel

tests live next to source as *.test.ts (node) and *.browser.test.tsx (browser).

config/docs:
  biome.json
  tsup.config.ts
  vitest.config.ts
  vitest.setup.browser.ts
  package.json (rewritten scripts/exports/deps)
  tsconfig.json (updated)
  the project guide
  README.md (rewritten)
  .github/workflows/ci.yml
  examples/BasicSliderExample.tsx (rewritten, headless)
```

The old `src/SplideWrapper/`, `src/NavCustomSplide.tsx`, `src/carousel-context.ts`, `src/icons/IconArrowRight.tsx`, and `src/index.tsx` are deleted (replaced) — handled in Task 14's barrel + Task 1 cleanup notes.

---

## Task 1: Tooling & test harness

**Files:**
- Create: `biome.json`, `vitest.config.ts`, `vitest.setup.browser.ts`, `tsup.config.ts`
- Modify: `package.json`, `tsconfig.json`
- Test: `src/core/units.test.ts` (node smoke), `src/harness.browser.test.tsx` (browser smoke)

**Interfaces:**
- Consumes: nothing.
- Produces: `pnpm test` (runs node+browser projects), `pnpm test:cov` (coverage, 99% gate), `pnpm lint`, `pnpm typecheck`, `pnpm build`. Proves both Vitest projects run.

- [ ] **Step 1: Install dev dependencies**

```bash
pnpm add -D vitest @vitest/browser @vitest/coverage-v8 playwright @testing-library/react @testing-library/dom @biomejs/biome tsup
pnpm exec playwright install chromium
```

- [ ] **Step 2: Write `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": { "enabled": true },
  "files": { "ignore": ["dist", "coverage", "node_modules"] },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noArrayIndexKey": "warn",
        "noExplicitAny": "error"
      },
      "style": {
        "noNonNullAssertion": "error",
        "useConsistentArrayType": { "level": "error", "options": { "syntax": "shorthand" } }
      }
    }
  },
  "javascript": { "formatter": { "quoteStyle": "single", "trailingCommas": "es5" } }
}
```

- [ ] **Step 3: Write `vitest.setup.browser.ts`**

```ts
import '@testing-library/react';
```

- [ ] **Step 4: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.tsx'],
          setupFiles: ['./vitest.setup.browser.ts'],
          browser: {
            enabled: true,
            provider: 'playwright',
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.ts', 'src/**/*.browser.test.tsx', 'src/index.ts', 'vitest.setup.browser.ts'],
      thresholds: { lines: 99, statements: 99, functions: 99, branches: 99 },
    },
  },
});
```

- [ ] **Step 5: Write `tsup.config.ts`**

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom'],
});
```

- [ ] **Step 6: Rewrite `package.json` scripts/exports/deps**

```json
{
  "name": "light-splide-slide",
  "version": "0.1.0",
  "description": "Headless, SSR-safe, dependency-light React slider/carousel built on native scroll-snap.",
  "license": "MIT",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./styles.css": "./dist/styles.css"
  },
  "files": ["dist"],
  "sideEffects": ["*.css"],
  "keywords": ["react", "slider", "carousel", "headless", "scroll-snap", "ssr"],
  "peerDependencies": { "react": ">=18", "react-dom": ">=18" },
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:cov": "vitest run --coverage",
    "build": "tsup && cp src/styles.css dist/styles.css",
    "check": "pnpm lint && pnpm typecheck && pnpm test:cov",
    "prepublishOnly": "pnpm check && pnpm build",
    "release:patch": "pnpm check && pnpm build && npm version patch && npm publish && git push --follow-tags",
    "release:minor": "pnpm check && pnpm build && npm version minor && npm publish && git push --follow-tags",
    "release:major": "pnpm check && pnpm build && npm version major && npm publish && git push --follow-tags"
  },
  "devDependencies": {}
}
```

Note: keep the existing `devDependencies` block (React, TS types, etc.) plus the tools installed in Step 1; only the `tailwind-merge` runtime dependency is removed.

- [ ] **Step 7: Update `tsconfig.json`** — add `"types": []` is unnecessary; ensure `"include": ["src", "examples", "*.config.ts"]` and keep `"noEmit": true`. Leave the rest as-is.

- [ ] **Step 8: Write node smoke test `src/core/units.test.ts`**

```ts
import { describe, expect, it } from 'vitest';

describe('harness', () => {
  it('runs node tests', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 9: Write browser smoke test `src/harness.browser.test.tsx`**

```tsx
import { render } from '@testing-library/react';
import { expect, it } from 'vitest';

it('runs browser tests with layout', () => {
  const { container } = render(<div style={{ width: 100 }}>hi</div>);
  expect(container.firstChild).toBeTruthy();
  expect((container.firstChild as HTMLElement).getBoundingClientRect().width).toBe(100);
});
```

- [ ] **Step 10: Run both projects**

Run: `pnpm test`
Expected: PASS — both `node` and `browser` projects report passing tests.

- [ ] **Step 11: Delete obsolete smoke + remove legacy source that will be replaced**

Delete `src/harness.browser.test.tsx` (the browser harness is re-proven later). Keep `src/core/units.test.ts` (Task 2 expands it). Leave legacy `src/SplideWrapper/`, `src/NavCustomSplide.tsx`, `src/carousel-context.ts`, `src/index.tsx`, `src/icons/IconArrowRight.tsx` in place for now — Task 14 deletes them when the new barrel replaces them, so `git` history stays clean.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: set up Biome, Vitest (node+browser), tsup, release scripts"
```

---

## Task 2: Core — `toCssUnit`

**Files:**
- Create: `src/core/units.ts`
- Test: `src/core/units.test.ts` (replace smoke content)

**Interfaces:**
- Produces: `toCssUnit(value?: number | string): string | undefined` — numbers → `"<n>px"`, strings pass through, `undefined` → `undefined`.

- [ ] **Step 1: Write failing test** in `src/core/units.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { toCssUnit } from './units';

describe('toCssUnit', () => {
  it('returns undefined for undefined', () => {
    expect(toCssUnit(undefined)).toBeUndefined();
  });
  it('appends px to numbers', () => {
    expect(toCssUnit(16)).toBe('16px');
    expect(toCssUnit(0)).toBe('0px');
  });
  it('passes strings through', () => {
    expect(toCssUnit('1rem')).toBe('1rem');
  });
});
```

- [ ] **Step 2: Run to confirm fail** — `pnpm test -- units` → FAIL (cannot find `./units`).

- [ ] **Step 3: Implement `src/core/units.ts`**

```ts
export function toCssUnit(value?: number | string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return typeof value === 'number' ? `${value}px` : value;
}
```

- [ ] **Step 4: Run to confirm pass** — `pnpm test -- units` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(core): add toCssUnit"`

---

## Task 3: Core — types

**Files:**
- Create: `src/types.ts`
- Test: none (type-only; exercised by consumers). Verified via `pnpm typecheck`.

**Interfaces:**
- Produces:
```ts
export enum NavigationAction { Next = 'next', Prev = 'prev' }
export type SliderControl = number | `${number}` | `+${number}` | `-${number}` | '>' | '<' | NavigationAction;
export type SliderPadding = { left?: string | number; right?: string | number };
export type SliderGrid = { gap?: { row?: string | number; col?: string | number }; dimensions?: [number, number][] };
export type SliderOptions = { arrows?: boolean; breakpoints?: Record<number, Partial<SliderOptions>>; drag?: boolean; fixedHeight?: string | number; fixedWidth?: string | number; gap?: string | number; grid?: SliderGrid; keyboard?: boolean; mediaQuery?: 'max' | 'min'; padding?: SliderPadding | number | string; pagination?: boolean; perMove?: number; perPage?: number; type?: 'slide' };
export type SliderApi = { destroy: () => void; go: (control: SliderControl) => void; index: number; on: (event: string, callback: (newIndex: number) => void) => () => void };
```

- [ ] **Step 1: Write `src/types.ts`** with the exact definitions above, plus:

```ts
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

export type SliderContextValue = {
  canGoNext: boolean;
  canGoPrev: boolean;
  currentIndex: number;
  goTo: (control: SliderControl) => void;
  next: () => void;
  prev: () => void;
  options: SliderOptions;
  pageCount: number;
  paginationCount: number;
  currentPageIndex: number;
  registerScrollElement: (el: HTMLDivElement | null) => void;
  setPageCount: (count: number) => void;
};

export type SliderProps = Omit<HTMLAttributes<HTMLElement>, 'aria-label'> & {
  options?: SliderOptions;
  className?: string;
  style?: CSSProperties;
  'aria-label': string;
  children: ReactNode;
  onMounted?: (api: SliderApi) => void;
  onDestroy?: () => void;
};
```

- [ ] **Step 2: Run typecheck** — `pnpm typecheck` → PASS (no errors).

- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: add public types"`

---

## Task 4: Core — option merging & resolution

**Files:**
- Create: `src/core/options.ts`
- Test: `src/core/options.test.ts`

**Interfaces:**
- Consumes: `SliderOptions`, `SliderGrid`, `SliderPadding` from `../types`.
- Produces: `DEFAULTS: SliderOptions`, `resolveOptions(options: SliderOptions, viewportWidth: number | null): SliderOptions`, and internal `mergeOptions` (exported for tests).

- [ ] **Step 1: Write failing test `src/core/options.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { mergeOptions, resolveOptions } from './options';

describe('resolveOptions', () => {
  it('applies defaults', () => {
    const r = resolveOptions({}, null);
    expect(r).toMatchObject({ arrows: true, drag: true, pagination: false, perMove: 1, perPage: 1, type: 'slide' });
  });
  it('user options override defaults', () => {
    expect(resolveOptions({ perPage: 3 }, null).perPage).toBe(3);
  });
  it('skips breakpoints when viewportWidth is null', () => {
    const r = resolveOptions({ perPage: 1, breakpoints: { 600: { perPage: 2 } } }, null);
    expect(r.perPage).toBe(1);
  });
  it('applies max-width breakpoints (default mediaQuery)', () => {
    const r = resolveOptions({ perPage: 1, breakpoints: { 600: { perPage: 2 } } }, 500);
    expect(r.perPage).toBe(2);
  });
  it('does not apply max-width breakpoint above width', () => {
    const r = resolveOptions({ perPage: 1, breakpoints: { 600: { perPage: 2 } } }, 800);
    expect(r.perPage).toBe(1);
  });
  it('applies min-width breakpoints', () => {
    const r = resolveOptions({ perPage: 1, mediaQuery: 'min', breakpoints: { 600: { perPage: 2 } } }, 800);
    expect(r.perPage).toBe(2);
  });
});

describe('mergeOptions', () => {
  it('returns base when no override', () => {
    expect(mergeOptions({ perPage: 1 }).perPage).toBe(1);
  });
  it('deep-merges padding objects', () => {
    const r = mergeOptions({ padding: { left: '1rem', right: '1rem' } }, { padding: { right: '2rem' } });
    expect(r.padding).toEqual({ left: '1rem', right: '2rem' });
  });
  it('normalizes scalar padding into both sides', () => {
    const r = mergeOptions({ padding: '1rem' }, { padding: { left: '2rem' } });
    expect(r.padding).toEqual({ left: '2rem', right: '1rem' });
  });
  it('deep-merges grid gap', () => {
    const r = mergeOptions({ grid: { gap: { row: '1px' } } }, { grid: { gap: { col: '2px' } } });
    expect(r.grid).toEqual({ gap: { row: '1px', col: '2px' } });
  });
  it('override gap wins, falls back to base', () => {
    expect(mergeOptions({ gap: '1rem' }, { perPage: 2 }).gap).toBe('1rem');
    expect(mergeOptions({ gap: '1rem' }, { gap: '2rem' }).gap).toBe('2rem');
  });
  it('keeps base breakpoints (override breakpoints ignored)', () => {
    const r = mergeOptions({ breakpoints: { 1: {} } }, { breakpoints: { 2: {} } });
    expect(r.breakpoints).toEqual({ 1: {} });
  });
  it('returns undefined padding/grid when neither present', () => {
    const r = mergeOptions({ perPage: 1 }, { perPage: 2 });
    expect(r.padding).toBeUndefined();
    expect(r.grid).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to confirm fail** — `pnpm test -- options` → FAIL.

- [ ] **Step 3: Implement `src/core/options.ts`** (lifted from legacy `utils.ts`, retyped to `Slider*`)

```ts
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
```

Note on the scalar-padding test (CORRECTED): for an OBJECT override, `no = override`
itself (e.g. `{left:'2rem'}` — no `right` key), so `{...nb, ...no}` =
`{left:'2rem', right:'1rem'}` — the unspecified `right` is preserved from base. The
"normalizes scalar padding" test must therefore expect `{ left: '2rem', right: '1rem' }`,
and a one-side object override over an object base must keep the other side (regression
test added). An earlier draft of this note wrongly claimed `right: undefined`; that would
drop a side on responsive padding overrides and is a bug. Keep the spread implementation.

- [ ] **Step 4: Run to confirm pass** — `pnpm test -- options` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(core): add option merge + breakpoint resolution"`

---

## Task 5: Core — geometry

**Files:**
- Create: `src/core/geometry.ts`, `src/core/index.ts`
- Test: `src/core/geometry.test.ts`

**Interfaces:**
- Consumes: `SliderGrid`, `SliderOptions`, `SliderControl`, `NavigationAction` from `../types`.
- Produces:
  - `getGridDimensions(grid?: SliderGrid): { columns: number; itemsPerPage: number; rows: number } | null`
  - `getPaginationCount(options: SliderOptions, pageCount: number): number`
  - `getMaxIndex(options: SliderOptions, pageCount: number): number`
  - `resolveNextIndex({ control, currentIndex, perMove }): number`
  - `getNearestPageIndex(pageElements: HTMLElement[], scrollLeft: number): number | null`
  - `src/core/index.ts` re-exports units + options + geometry.

- [ ] **Step 1: Write failing test `src/core/geometry.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { NavigationAction } from '../types';
import {
  getGridDimensions,
  getMaxIndex,
  getNearestPageIndex,
  getPaginationCount,
  resolveNextIndex,
} from './geometry';

describe('getGridDimensions', () => {
  it('returns null without dimensions', () => {
    expect(getGridDimensions(undefined)).toBeNull();
    expect(getGridDimensions({ dimensions: [] })).toBeNull();
  });
  it('sums columns and items per page, takes max rows', () => {
    expect(getGridDimensions({ dimensions: [[2, 2], [1, 3]] })).toEqual({
      columns: 5,
      itemsPerPage: 7,
      rows: 2,
    });
  });
});

describe('getPaginationCount', () => {
  it('equals pageCount in grid mode', () => {
    expect(getPaginationCount({ grid: { dimensions: [[1, 2]] } }, 4)).toBe(4);
  });
  it('accounts for perPage', () => {
    expect(getPaginationCount({ perPage: 2 }, 5)).toBe(4);
  });
  it('accounts for perMove > 1', () => {
    expect(getPaginationCount({ perPage: 1, perMove: 2 }, 5)).toBe(3);
  });
  it('never below 1', () => {
    expect(getPaginationCount({ perPage: 5 }, 2)).toBe(1);
  });
});

describe('getMaxIndex', () => {
  it('pageCount-1 in grid mode', () => {
    expect(getMaxIndex({ grid: { dimensions: [[1, 2]] } }, 4)).toBe(3);
  });
  it('pageCount-perPage otherwise, floored at 0', () => {
    expect(getMaxIndex({ perPage: 2 }, 5)).toBe(3);
    expect(getMaxIndex({ perPage: 5 }, 2)).toBe(0);
  });
});

describe('resolveNextIndex', () => {
  const base = { currentIndex: 2, perMove: 2 };
  it('numeric control returns it directly', () => {
    expect(resolveNextIndex({ ...base, control: 5 })).toBe(5);
  });
  it('Next / > advance by perMove', () => {
    expect(resolveNextIndex({ ...base, control: NavigationAction.Next })).toBe(4);
    expect(resolveNextIndex({ ...base, control: '>' })).toBe(4);
  });
  it('Prev / < retreat by perMove', () => {
    expect(resolveNextIndex({ ...base, control: NavigationAction.Prev })).toBe(0);
    expect(resolveNextIndex({ ...base, control: '<' })).toBe(0);
  });
  it('+n / -n are relative', () => {
    expect(resolveNextIndex({ ...base, control: '+3' })).toBe(5);
    expect(resolveNextIndex({ ...base, control: '-1' })).toBe(1);
  });
  it('numeric string is absolute', () => {
    expect(resolveNextIndex({ ...base, control: '4' })).toBe(4);
  });
});

describe('getNearestPageIndex', () => {
  it('returns null for empty', () => {
    expect(getNearestPageIndex([], 0)).toBeNull();
  });
  it('picks the element whose offsetLeft is closest', () => {
    const els: { offsetLeft: number }[] = [{ offsetLeft: 0 }, { offsetLeft: 100 }, { offsetLeft: 200 }];
    expect(getNearestPageIndex(els, 90)).toBe(1);
    expect(getNearestPageIndex(els, 10)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to confirm fail** — `pnpm test -- geometry` → FAIL.

- [ ] **Step 3: Implement `src/core/geometry.ts`** (lifted from legacy `utils.ts`)

```ts
import { NavigationAction, type SliderControl, type SliderGrid, type SliderOptions } from '../types';

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
```

- [ ] **Step 4: Write `src/core/index.ts`**

```ts
export * from './geometry';
export * from './options';
export * from './units';
```

- [ ] **Step 5: Run to confirm pass** — `pnpm test -- geometry` → PASS.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(core): add geometry + pagination/index math"`

---

## Task 6: Responsive store (SSR-safe viewport source)

**Files:**
- Create: `src/responsive-store.ts`
- Test: `src/responsive-store.test.ts` (node)

**Interfaces:**
- Produces: `createResponsiveStore()` returning `{ subscribe(cb): () => void; getSnapshot(): number | null; getServerSnapshot(): null }`. `getSnapshot` returns `window.innerWidth` in the browser and `null` where `window` is undefined. `getServerSnapshot` always returns `null` (so SSR + first client paint resolve base options).

- [ ] **Step 1: Write failing test `src/responsive-store.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createResponsiveStore } from './responsive-store';

describe('createResponsiveStore', () => {
  it('server snapshot is always null', () => {
    expect(createResponsiveStore().getServerSnapshot()).toBeNull();
  });
  it('getSnapshot returns null when window is undefined (node env)', () => {
    expect(createResponsiveStore().getSnapshot()).toBeNull();
  });
  it('subscribe returns an unsubscribe that does not throw without window', () => {
    const store = createResponsiveStore();
    const unsub = store.subscribe(() => {});
    expect(() => unsub()).not.toThrow();
  });
  it('notifies on resize when window exists', () => {
    const listeners = new Set<() => void>();
    const fakeWindow = {
      innerWidth: 800,
      addEventListener: (_: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    };
    vi.stubGlobal('window', fakeWindow);
    const store = createResponsiveStore();
    expect(store.getSnapshot()).toBe(800);
    const cb = vi.fn();
    store.subscribe(cb);
    fakeWindow.innerWidth = 400;
    listeners.forEach((l) => l());
    expect(cb).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run to confirm fail** — `pnpm test -- responsive-store` → FAIL.

- [ ] **Step 3: Implement `src/responsive-store.ts`**

```ts
export function createResponsiveStore() {
  return {
    subscribe(callback: () => void): () => void {
      if (typeof window === 'undefined') {
        return () => {};
      }
      window.addEventListener('resize', callback);
      return () => window.removeEventListener('resize', callback);
    },
    getSnapshot(): number | null {
      return typeof window === 'undefined' ? null : window.innerWidth;
    },
    getServerSnapshot(): number | null {
      return null;
    },
  };
}
```

- [ ] **Step 4: Run to confirm pass** — `pnpm test -- responsive-store` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: add SSR-safe responsive store"`

---

## Task 7: Slider context

**Files:**
- Create: `src/slider-context.ts`
- Test: covered via components (Task 10+); add a tiny node test for the default-null hook is not possible without React render — so test in browser project later. No standalone test here.

**Interfaces:**
- Produces: `SliderContext = createContext<SliderContextValue | null>(null)`, `useSliderContext(): SliderContextValue | null`.

- [ ] **Step 1: Implement `src/slider-context.ts`**

```ts
'use client';
import { createContext, useContext } from 'react';
import type { SliderContextValue } from './types';

export const SliderContext = createContext<SliderContextValue | null>(null);

export function useSliderContext(): SliderContextValue | null {
  return useContext(SliderContext);
}
```

- [ ] **Step 2: Typecheck** — `pnpm typecheck` → PASS.

- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: add slider context"`

---

## Task 8: Controller hook — `useSlider`

**Files:**
- Create: `src/use-slider.ts`
- Test: `src/use-slider.browser.test.tsx` (browser — needs real scroll geometry + effects)

**Interfaces:**
- Consumes: core fns, `createResponsiveStore`, types, `SliderContext`.
- Produces:
```ts
useSlider(params: {
  options: SliderOptions;
  pageCount: number;
  setPageCount: (n: number) => void;
  onMounted?: (api: SliderApi) => void;
  onDestroy?: () => void;
}): SliderContextValue
```
The hook computes `resolvedOptions` from the responsive store via `useSyncExternalStore`, owns `currentIndex`, the scroll element ref, the moved-listener set, `goTo/next/prev`, `registerScrollElement`, derives `canGoNext/canGoPrev/paginationCount/currentPageIndex`, wires scroll-sync + last-child visibility + imperative API effects, and returns a `SliderContextValue`.

- [ ] **Step 1: Write failing browser test `src/use-slider.browser.test.tsx`**

```tsx
import { render } from '@testing-library/react';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import { SliderContext } from './slider-context';
import type { SliderApi, SliderContextValue, SliderOptions } from './types';
import { useSlider } from './use-slider';

function Harness({ options, onApi }: { options: SliderOptions; onApi?: (api: SliderApi) => void }) {
  const [pageCount, setPageCount] = useState(0);
  const ctx = useSlider({ options, pageCount, setPageCount, onMounted: onApi });
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
      <Counter setPageCount={setPageCount} />
    </SliderContext.Provider>
  );
}

function Counter({ setPageCount }: { setPageCount: (n: number) => void }) {
  // emulate SliderTrack reporting 3 pages once
  useState(() => setPageCount(3));
  return null;
}

it('starts at index 0 with correct nav state', () => {
  let captured: SliderContextValue | null = null;
  function Probe() {
    const [pageCount, setPageCount] = useState(3);
    captured = useSlider({ options: { perPage: 1 }, pageCount, setPageCount });
    return null;
  }
  render(<Probe />);
  expect(captured?.currentIndex).toBe(0);
  expect(captured?.canGoPrev).toBe(false);
});

it('exposes an imperative api on mount and go() scrolls', async () => {
  const api: { current: SliderApi | null } = { current: null };
  render(<Harness options={{ perPage: 1 }} onApi={(a) => { api.current = a; }} />);
  expect(api.current).not.toBeNull();
  expect(api.current?.index).toBe(0);
  const moved = vi.fn();
  const off = api.current?.on('moved', moved);
  api.current?.go('>');
  await vi.waitFor(() => expect(api.current?.index).toBe(1));
  expect(moved).toHaveBeenCalledWith(1);
  off?.();
});

it('on() ignores unknown events and returns a noop unsubscribe', () => {
  let captured: SliderContextValue | null = null;
  const api: { current: SliderApi | null } = { current: null };
  function Probe() {
    const [pageCount, setPageCount] = useState(3);
    captured = useSlider({ options: {}, pageCount, setPageCount, onMounted: (a) => { api.current = a; } });
    return null;
  }
  render(<Probe />);
  const off = api.current?.on('weird', () => {});
  expect(typeof off).toBe('function');
  expect(() => off?.()).not.toThrow();
  expect(captured?.pageCount).toBe(3);
});
```

- [ ] **Step 2: Run to confirm fail** — `pnpm test -- use-slider` → FAIL (no `./use-slider`).

- [ ] **Step 3: Implement `src/use-slider.ts`**

```tsx
'use client';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  getMaxIndex,
  getNearestPageIndex,
  getPaginationCount,
  resolveNextIndex,
  resolveOptions,
} from './core';
import { createResponsiveStore } from './responsive-store';
import {
  NavigationAction,
  type SliderApi,
  type SliderContextValue,
  type SliderControl,
  type SliderOptions,
} from './types';

const FULL_VISIBILITY_TOLERANCE_PX = 1;

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
    () => resolveOptions(options ?? {}, viewportWidth),
    [options, viewportWidth]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);
  const scrollElementRef = useRef<HTMLDivElement | null>(null);
  const movedListenersRef = useRef(new Set<(i: number) => void>());
  const [isLastChildVisible, setIsLastChildVisible] = useState(false);

  const registerScrollElement = useCallback((el: HTMLDivElement | null) => {
    scrollElementRef.current = el;
  }, []);

  const emitMoved = useCallback((index: number) => {
    currentIndexRef.current = index;
    setCurrentIndex(index);
    for (const l of movedListenersRef.current) {
      l(index);
    }
  }, []);

  const goTo = useCallback(
    (control: SliderControl) => {
      const scrollElement = scrollElementRef.current;
      if (!scrollElement) {
        return;
      }
      const pageElements = Array.from(
        scrollElement.querySelectorAll<HTMLElement>('[data-carousel-page="true"]')
      );
      if (!pageElements.length) {
        return;
      }
      const maxIndex = getMaxIndex(resolvedOptions, pageCount);
      const perMove = resolvedOptions.grid ? 1 : resolvedOptions.perMove ?? 1;
      const next = resolveNextIndex({ control, currentIndex: currentIndexRef.current, perMove });
      const clamped = Math.max(0, Math.min(next, maxIndex));
      if (clamped === currentIndexRef.current) {
        return;
      }
      const target = pageElements[clamped];
      if (!target) {
        return;
      }
      scrollElement.scrollTo({ behavior: 'smooth', left: target.offsetLeft - scrollElement.offsetLeft });
    },
    [pageCount, resolvedOptions]
  );

  const prev = useCallback(() => goTo(NavigationAction.Prev), [goTo]);
  const next = useCallback(() => goTo(NavigationAction.Next), [goTo]);

  // scroll-sync
  useEffect(() => {
    const scrollElement = scrollElementRef.current;
    if (!scrollElement) {
      return;
    }
    let frame = 0;
    const handle = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const pages = Array.from(
          scrollElement.querySelectorAll<HTMLElement>('[data-carousel-page="true"]')
        );
        const nearest = getNearestPageIndex(pages, scrollElement.scrollLeft);
        if (nearest === null || nearest === currentIndexRef.current) {
          return;
        }
        emitMoved(nearest);
      });
    };
    scrollElement.addEventListener('scroll', handle, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      scrollElement.removeEventListener('scroll', handle);
    };
  }, [emitMoved, pageCount]);

  // last-child visibility
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
    scrollElement.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      scrollElement.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [pageCount]);

  // imperative api
  useEffect(() => {
    const listeners = movedListenersRef.current;
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
  }, [goTo, onMounted, onDestroy]);

  const maxIndex = getMaxIndex(resolvedOptions, pageCount);
  const paginationCount = getPaginationCount(resolvedOptions, pageCount);
  const perStep = resolvedOptions.grid ? 1 : resolvedOptions.perMove ?? 1;
  const currentPageIndex =
    currentIndex >= maxIndex ? Math.max(paginationCount - 1, 0) : Math.floor(currentIndex / perStep);

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

- [ ] **Step 4: Run to confirm pass** — `pnpm test -- use-slider` → PASS. If the smooth-scroll `go('>')` test is flaky in headless Chromium, the `vi.waitFor` already polls; keep tolerance.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: add SSR-safe useSlider controller hook"`

---

## Task 9: `IconArrow` + `Slider` root + `SliderTrack`

**Files:**
- Create: `src/icons/IconArrow.tsx`, `src/components/Slider.tsx`, `src/components/SliderTrack.tsx`
- Test: `src/components/Slider.browser.test.tsx`

**Interfaces:**
- Consumes: `useSlider`, `SliderContext`, `useSliderContext`, core fns, types.
- Produces:
  - `IconArrow({ className?, style? })` — neutral SVG using `currentColor`.
  - `Slider` (default export of `Slider.tsx`) — renders `<section aria-label className style>`, provides context via `useSlider`, owns `pageCount` state, renders children.
  - `SliderTrack({ className?, style?, scrollClassName?, gridClassName?, cssGridRows? })` — the scroll container; reports page count; builds pages/grid; emits `data-carousel-page`.

- [ ] **Step 1: Write failing test `src/components/Slider.browser.test.tsx`**

```tsx
import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Slider } from './Slider';
import { SliderSlide } from './SliderSlide';
import { SliderTrack } from './SliderTrack';

it('renders a labelled section and forwards className/style', () => {
  const { container } = render(
    <Slider aria-label="demo" className="my-slider" style={{ background: 'red' }}>
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
        <SliderSlide>b</SliderSlide>
      </SliderTrack>
    </Slider>
  );
  const section = container.querySelector<HTMLElement>('section');
  expect(section?.getAttribute('aria-label')).toBe('demo');
  expect(section?.className).toContain('my-slider');
  expect(section?.style.background).toBe('red');
});

it('marks pages with data-carousel-page', () => {
  const { container } = render(
    <Slider aria-label="demo">
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
        <SliderSlide>b</SliderSlide>
        <SliderSlide>c</SliderSlide>
      </SliderTrack>
    </Slider>
  );
  expect(container.querySelectorAll('[data-carousel-page="true"]')).toHaveLength(3);
});

it('forwards scrollClassName to the scroll container', () => {
  const { container } = render(
    <Slider aria-label="demo">
      <SliderTrack scrollClassName="scroller">
        <SliderSlide>a</SliderSlide>
      </SliderTrack>
    </Slider>
  );
  expect(container.querySelector('.scroller')).toBeTruthy();
});
```

(SliderSlide is created in Task 10; if executing strictly in order, write a temporary minimal `SliderSlide` first or reorder so Task 10 precedes this test. Recommended: implement `SliderSlide` Step from Task 10 before running this test — note this dependency.)

- [ ] **Step 2: Run to confirm fail** — `pnpm test -- Slider` → FAIL.

- [ ] **Step 3: Implement `src/icons/IconArrow.tsx`**

```tsx
import type { CSSProperties } from 'react';

export function IconArrow({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      style={style}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="currentColor"
        d="M19.692 61.538c-1.477 0-2.462 0-3.446-1.477-1.969-1.969-1.969-4.923 0-6.892l21.169-21.169-21.169-21.169c-1.969-1.969-1.969-4.923 0-6.892s4.923-1.969 6.892 0l24.615 24.615c1.969 1.969 1.969 4.923 0 6.892l-24.615 24.615c-0.985 0.985-2.462 1.477-3.446 1.477z"
      />
    </svg>
  );
}

export default IconArrow;
```

- [ ] **Step 4: Implement `src/components/Slider.tsx`**

```tsx
'use client';
import { useState } from 'react';
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
  const [pageCount, setPageCount] = useState(0);
  const ctx = useSlider({
    options: options ?? {},
    pageCount,
    setPageCount,
    onMounted,
    onDestroy,
  });
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

- [ ] **Step 5: Implement `src/components/SliderTrack.tsx`** (structural styles only; grid logic from legacy)

```tsx
'use client';
import {
  type Attributes,
  Children,
  cloneElement,
  type CSSProperties,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useMemo,
} from 'react';
import { getGridDimensions, toCssUnit } from '../core';
import { useSliderContext } from '../slider-context';

type SliderTrackProps = {
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

export function SliderTrack({
  className,
  style,
  scrollClassName,
  gridClassName,
  cssGridRows,
  children,
}: SliderTrackProps) {
  const carousel = useSliderContext();
  const slideChildren = Children.toArray(children).filter(isValidElement);
  const gridDimensions = getGridDimensions(carousel?.options.grid);

  const pages = useMemo<ReactElement[] | ReactElement[][]>(() => {
    if (cssGridRows) {
      const cols: ReactElement[][] = [];
      for (let i = 0; i < slideChildren.length; i += cssGridRows) {
        cols.push(slideChildren.slice(i, i + cssGridRows));
      }
      return cols;
    }
    if (!gridDimensions) {
      return slideChildren;
    }
    const grouped: ReactElement[][] = [];
    for (let i = 0; i < slideChildren.length; i += gridDimensions.itemsPerPage) {
      grouped.push(slideChildren.slice(i, i + gridDimensions.itemsPerPage));
    }
    return grouped;
  }, [cssGridRows, gridDimensions, slideChildren]);

  const pageCount = pages.length;
  useEffect(() => {
    carousel?.setPageCount(pageCount);
  }, [carousel, pageCount]);

  if (!carousel) {
    return null;
  }

  const gap = toCssUnit(carousel.options.gap) ?? '0px';
  const hasPadding = carousel.options.padding !== undefined;
  const pad =
    typeof carousel.options.padding === 'object'
      ? carousel.options.padding
      : { left: carousel.options.padding, right: carousel.options.padding };
  const paddingLeft = toCssUnit(pad?.left) ?? '0px';
  const paddingRight = toCssUnit(pad?.right) ?? '0px';

  const scrollStyle: CSSProperties & Record<`--${string}`, string> = {
    display: 'flex',
    scrollSnapType: 'x mandatory',
    overflowX: 'auto',
    overflowY: 'hidden',
    overscrollBehaviorX: 'contain',
    scrollbarWidth: 'none',
    scrollBehavior: 'smooth',
    gap,
    '--slider-gap': gap,
    '--slider-padding-left': paddingLeft,
    '--slider-padding-right': paddingRight,
    ...(hasPadding
      ? { paddingLeft, paddingRight, scrollPaddingLeft: paddingLeft, scrollPaddingRight: paddingRight }
      : {}),
  };

  const renderGroupedPage = (page: ReactElement[], pageIndex: number) => {
    const pageKey = page.map((p) => p.key ?? pageIndex).join('--');
    const innerStyle: CSSProperties = cssGridRows
      ? {
          display: 'grid',
          height: '100%',
          gridTemplateRows: `repeat(${cssGridRows}, minmax(0, 1fr))`,
          rowGap: toCssUnit(carousel.options.grid?.gap?.row) ?? gap,
        }
      : {
          display: 'grid',
          gridTemplateColumns: `repeat(${gridDimensions?.columns}, minmax(0, 1fr))`,
          columnGap: toCssUnit(carousel.options.grid?.gap?.col) ?? gap,
          rowGap: toCssUnit(carousel.options.grid?.gap?.row) ?? gap,
        };
    return (
      <div
        key={`page-${pageKey}`}
        className={gridClassName}
        data-carousel-page="true"
        style={{ minWidth: 0, flexShrink: 0, scrollSnapAlign: 'start' }}
      >
        <div style={innerStyle}>
          {page.map((child, ci) => (
            <div key={`item-${pageKey}-${child.key ?? ci}`} style={{ width: '100%' }}>
              {child}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFlatPage = (page: ReactElement, pageIndex: number) => {
    const pageProps: Attributes & { 'data-carousel-page': true } = {
      key: page.key ?? `page-${pageIndex}`,
      'data-carousel-page': true,
    };
    return cloneElement(page, pageProps);
  };

  return (
    <div className={className} style={{ overflow: 'hidden', ...style }}>
      <div
        ref={carousel.registerScrollElement}
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

- [ ] **Step 6: Run to confirm pass** — `pnpm test -- Slider` → PASS (after Task 10's `SliderSlide` exists).

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat: add IconArrow, Slider root, SliderTrack (headless)"`

---

## Task 10: `SliderSlide`

**Files:**
- Create: `src/components/SliderSlide.tsx`
- Test: `src/components/SliderSlide.browser.test.tsx`

**Interfaces:**
- Consumes: `useSliderContext`, `toCssUnit`.
- Produces: `SliderSlide(props: HTMLAttributes<HTMLDivElement>)` — computes width from `fixedWidth` or `perPage`+`gap`; structural styles only; forwards `className`/`style`/`...rest`. Without context, renders a plain `<div>` passthrough.

- [ ] **Step 1: Write failing test `src/components/SliderSlide.browser.test.tsx`**

```tsx
import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Slider } from './Slider';
import { SliderSlide } from './SliderSlide';
import { SliderTrack } from './SliderTrack';

it('renders plain div without a Slider context', () => {
  const { container } = render(<SliderSlide className="solo">x</SliderSlide>);
  expect(container.querySelector('.solo')?.textContent).toBe('x');
});

it('applies fixedWidth', () => {
  const { container } = render(
    <Slider aria-label="d" options={{ fixedWidth: '10rem' }}>
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
      </SliderTrack>
    </Slider>
  );
  const page = container.querySelector<HTMLElement>('[data-carousel-page="true"]');
  expect(page?.style.width).toBe('10rem');
});

it('forwards className and style', () => {
  const { container } = render(
    <Slider aria-label="d">
      <SliderTrack>
        <SliderSlide className="slide" style={{ color: 'rgb(0, 128, 0)' }}>a</SliderSlide>
      </SliderTrack>
    </Slider>
  );
  const el = container.querySelector<HTMLElement>('.slide');
  expect(el?.style.color).toBe('rgb(0, 128, 0)');
});
```

- [ ] **Step 2: Run to confirm fail** — `pnpm test -- SliderSlide` → FAIL.

- [ ] **Step 3: Implement `src/components/SliderSlide.tsx`**

```tsx
'use client';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { toCssUnit } from '../core';
import { useSliderContext } from '../slider-context';

export function SliderSlide({
  className,
  style,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
  const carousel = useSliderContext();
  if (!carousel) {
    return (
      <div className={className} style={style} {...rest}>
        {children}
      </div>
    );
  }
  const fixedWidth = toCssUnit(carousel.options.fixedWidth);
  const gap = toCssUnit(carousel.options.gap) ?? '0px';
  const perPage = carousel.options.perPage ?? 1;
  const width = fixedWidth
    ? fixedWidth
    : `calc((100% - (${gap} * ${Math.max(perPage - 1, 0)})) / ${perPage})`;
  const slideStyle: CSSProperties = { minWidth: 0, flexShrink: 0, scrollSnapAlign: 'start', width, ...style };
  return (
    <div className={className} style={slideStyle} {...rest}>
      {children}
    </div>
  );
}

export default SliderSlide;
```

- [ ] **Step 4: Run to confirm pass** — `pnpm test -- SliderSlide` → PASS. Re-run `pnpm test -- Slider` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: add SliderSlide (headless width logic)"`

---

## Task 11: `SliderArrows`

**Files:**
- Create: `src/components/SliderArrows.tsx`
- Test: `src/components/SliderArrows.browser.test.tsx`

**Interfaces:**
- Consumes: `useSliderContext`, `IconArrow`.
- Produces:
```ts
SliderArrows(props: {
  className?: string; style?: CSSProperties;
  prevClassName?: string; nextClassName?: string;
  prevStyle?: CSSProperties; nextStyle?: CSSProperties;
  prevLabel?: string; nextLabel?: string;
  placement?: 'default' | 'top';
  hideOnMobile?: boolean;
  onPrev?: () => void; onNext?: () => void;
  renderPrev?: (p: { disabled: boolean; onClick: () => void }) => ReactNode;
  renderNext?: (p: { disabled: boolean; onClick: () => void }) => ReactNode;
})
```
Emits `data-disabled`, `data-placement`, `data-hide-on-mobile`. Real `<button>`s with `aria-label`s; returns `null` when arrows disabled and no custom handlers.

- [ ] **Step 1: Write failing test `src/components/SliderArrows.browser.test.tsx`**

```tsx
import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Slider } from './Slider';
import { SliderArrows } from './SliderArrows';
import { SliderSlide } from './SliderSlide';
import { SliderTrack } from './SliderTrack';

function setup(arrowsProps = {}) {
  return render(
    <Slider aria-label="d" options={{ perPage: 1 }}>
      <SliderArrows {...arrowsProps} />
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
        <SliderSlide>b</SliderSlide>
        <SliderSlide>c</SliderSlide>
      </SliderTrack>
    </Slider>
  );
}

it('renders two labelled buttons; prev disabled at start', () => {
  const { container } = setup();
  const buttons = container.querySelectorAll('button');
  expect(buttons).toHaveLength(2);
  const prev = container.querySelector<HTMLButtonElement>('[aria-label="Previous slide"]');
  expect(prev?.disabled).toBe(true);
  expect(prev?.getAttribute('data-disabled')).toBe('true');
});

it('hidden entirely when arrows option is false and no handlers', () => {
  const { container } = render(
    <Slider aria-label="d" options={{ arrows: false }}>
      <SliderArrows />
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
      </SliderTrack>
    </Slider>
  );
  expect(container.querySelectorAll('button')).toHaveLength(0);
});

it('uses custom labels and placement data attribute', () => {
  const { container } = setup({ prevLabel: 'Back', nextLabel: 'Forward', placement: 'top' });
  expect(container.querySelector('[aria-label="Back"]')).toBeTruthy();
  expect(container.querySelector('[aria-label="Forward"]')).toBeTruthy();
  expect(container.querySelector('[data-placement="top"]')).toBeTruthy();
});

it('supports custom render props', () => {
  const { container } = setup({
    renderNext: ({ disabled, onClick }: { disabled: boolean; onClick: () => void }) => (
      <button type="button" data-custom="next" disabled={disabled} onClick={onClick}>
        next
      </button>
    ),
  });
  expect(container.querySelector('[data-custom="next"]')).toBeTruthy();
});
```

- [ ] **Step 2: Run to confirm fail** — `pnpm test -- SliderArrows` → FAIL.

- [ ] **Step 3: Implement `src/components/SliderArrows.tsx`**

```tsx
'use client';
import type { CSSProperties, ReactNode } from 'react';
import { IconArrow } from '../icons/IconArrow';
import { useSliderContext } from '../slider-context';

type RenderButton = (p: { disabled: boolean; onClick: () => void }) => ReactNode;

type SliderArrowsProps = {
  className?: string;
  style?: CSSProperties;
  prevClassName?: string;
  nextClassName?: string;
  prevStyle?: CSSProperties;
  nextStyle?: CSSProperties;
  prevLabel?: string;
  nextLabel?: string;
  placement?: 'default' | 'top';
  hideOnMobile?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  renderPrev?: RenderButton;
  renderNext?: RenderButton;
};

const noop = () => {};

export function SliderArrows({
  className,
  style,
  prevClassName,
  nextClassName,
  prevStyle,
  nextStyle,
  prevLabel = 'Previous slide',
  nextLabel = 'Next slide',
  placement = 'default',
  hideOnMobile = false,
  onPrev,
  onNext,
  renderPrev,
  renderNext,
}: SliderArrowsProps) {
  const carousel = useSliderContext();
  const arrowsEnabled = carousel?.options.arrows ?? true;
  if (!arrowsEnabled && !onPrev && !onNext) {
    return null;
  }
  const handlePrev = onPrev ?? carousel?.prev ?? noop;
  const handleNext = onNext ?? carousel?.next ?? noop;
  const canPrev = onPrev ? true : carousel?.canGoPrev ?? false;
  const canNext = onNext ? true : carousel?.canGoNext ?? false;

  return (
    <div
      className={className}
      style={style}
      data-slider-arrows=""
      data-placement={placement}
      data-hide-on-mobile={hideOnMobile ? 'true' : 'false'}
    >
      {renderPrev ? (
        renderPrev({ disabled: !canPrev, onClick: handlePrev })
      ) : (
        <button
          type="button"
          aria-label={prevLabel}
          className={prevClassName}
          style={prevStyle}
          data-direction="prev"
          data-disabled={canPrev ? 'false' : 'true'}
          disabled={!canPrev}
          onClick={handlePrev}
        >
          <IconArrow style={{ transform: 'rotate(180deg)' }} />
        </button>
      )}
      {renderNext ? (
        renderNext({ disabled: !canNext, onClick: handleNext })
      ) : (
        <button
          type="button"
          aria-label={nextLabel}
          className={nextClassName}
          style={nextStyle}
          data-direction="next"
          data-disabled={canNext ? 'false' : 'true'}
          disabled={!canNext}
          onClick={handleNext}
        >
          <IconArrow />
        </button>
      )}
    </div>
  );
}

export default SliderArrows;
```

- [ ] **Step 4: Run to confirm pass** — `pnpm test -- SliderArrows` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: add SliderArrows with placement/render props"`

---

## Task 12: `SliderPagination`

**Files:**
- Create: `src/components/SliderPagination.tsx`
- Test: `src/components/SliderPagination.browser.test.tsx`

**Interfaces:**
- Consumes: `useSliderContext`.
- Produces: `SliderPagination({ className?, style?, dotClassName?, dotStyle?, renderDot? })`. Renders `paginationCount` dots; active dot has `data-current="true"`; returns `null` if `pagination` option is false (unless explicitly forced via being rendered — KISS: render only when `options.pagination`).

- [ ] **Step 1: Write failing test `src/components/SliderPagination.browser.test.tsx`**

```tsx
import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Slider } from './Slider';
import { SliderPagination } from './SliderPagination';
import { SliderSlide } from './SliderSlide';
import { SliderTrack } from './SliderTrack';

it('renders one dot per page with first current', () => {
  const { container } = render(
    <Slider aria-label="d" options={{ perPage: 1, pagination: true }}>
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
        <SliderSlide>b</SliderSlide>
        <SliderSlide>c</SliderSlide>
      </SliderTrack>
      <SliderPagination />
    </Slider>
  );
  const dots = container.querySelectorAll('[data-slider-dot]');
  expect(dots).toHaveLength(3);
  expect(dots[0].getAttribute('data-current')).toBe('true');
  expect(dots[1].getAttribute('data-current')).toBe('false');
});

it('renders nothing when pagination disabled', () => {
  const { container } = render(
    <Slider aria-label="d" options={{ pagination: false }}>
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
      </SliderTrack>
      <SliderPagination />
    </Slider>
  );
  expect(container.querySelectorAll('[data-slider-dot]')).toHaveLength(0);
});
```

- [ ] **Step 2: Run to confirm fail** — `pnpm test -- SliderPagination` → FAIL.

- [ ] **Step 3: Implement `src/components/SliderPagination.tsx`**

```tsx
'use client';
import type { CSSProperties, ReactNode } from 'react';
import { useSliderContext } from '../slider-context';

type SliderPaginationProps = {
  className?: string;
  style?: CSSProperties;
  dotClassName?: string;
  dotStyle?: CSSProperties;
  renderDot?: (p: { index: number; current: boolean }) => ReactNode;
};

export function SliderPagination({
  className,
  style,
  dotClassName,
  dotStyle,
  renderDot,
}: SliderPaginationProps) {
  const carousel = useSliderContext();
  if (!carousel || !carousel.options.pagination) {
    return null;
  }
  return (
    <div className={className} style={style} data-slider-pagination="">
      {Array.from({ length: carousel.paginationCount }).map((_, index) => {
        const current = index === carousel.currentPageIndex;
        const key = `dot-${index}`;
        if (renderDot) {
          return <span key={key}>{renderDot({ index, current })}</span>;
        }
        return (
          <span
            key={key}
            aria-hidden="true"
            className={dotClassName}
            style={dotStyle}
            data-slider-dot=""
            data-current={current ? 'true' : 'false'}
          />
        );
      })}
    </div>
  );
}

export default SliderPagination;
```

- [ ] **Step 4: Run to confirm pass** — `pnpm test -- SliderPagination` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: add SliderPagination"`

---

## Task 13: Headless proof + context-null coverage

**Files:**
- Test: `src/headless.browser.test.tsx`

**Interfaces:**
- Consumes: `useSlider`, `SliderContext`, `useSliderContext`.
- Produces: a test proving a fully custom UI can be built from the hook with no library components, plus coverage of the `useSliderContext()===null` branch and `SliderTrack`/`SliderPagination` null returns.

- [ ] **Step 1: Write `src/headless.browser.test.tsx`**

```tsx
import { render } from '@testing-library/react';
import { useState } from 'react';
import { expect, it } from 'vitest';
import { SliderContext, useSliderContext } from './slider-context';
import { SliderTrack } from './components/SliderTrack';
import type { SliderContextValue } from './types';
import { useSlider } from './use-slider';

it('builds a custom slider purely from useSlider', () => {
  function Custom() {
    const [pageCount, setPageCount] = useState(0);
    const ctx = useSlider({ options: { perPage: 1 }, pageCount, setPageCount });
    return (
      <SliderContext.Provider value={ctx}>
        <button type="button" aria-label="custom-next" onClick={ctx.next}>
          next
        </button>
        <div ref={ctx.registerScrollElement} style={{ display: 'flex', width: 100, overflow: 'auto' }}>
          <div data-carousel-page="true" style={{ flex: '0 0 100px' }}>
            one
          </div>
          <div data-carousel-page="true" style={{ flex: '0 0 100px' }}>
            two
          </div>
        </div>
      </SliderContext.Provider>
    );
  }
  const { container } = render(<Custom />);
  expect(container.querySelector('[aria-label="custom-next"]')).toBeTruthy();
});

it('SliderTrack renders null outside a Slider', () => {
  let value: SliderContextValue | null = null;
  function Probe() {
    value = useSliderContext();
    return null;
  }
  const { container } = render(
    <>
      <Probe />
      <SliderTrack>
        <div>x</div>
      </SliderTrack>
    </>
  );
  expect(value).toBeNull();
  expect(container.textContent).toBe('');
});
```

- [ ] **Step 2: Run** — `pnpm test -- headless` → PASS.

- [ ] **Step 3: Commit** — `git add -A && git commit -m "test: headless build proof + null-context coverage"`

---

## Task 14: Public barrel + delete legacy + coverage gate

**Files:**
- Create: `src/index.ts`
- Delete: `src/SplideWrapper/`, `src/NavCustomSplide.tsx`, `src/carousel-context.ts`, `src/index.tsx`, `src/icons/IconArrowRight.tsx`
- Test: full suite + coverage.

**Interfaces:**
- Produces public exports: components, hooks, `IconArrow`, all types, `NavigationAction`.

- [ ] **Step 1: Write `src/index.ts`**

```ts
export { Slider, default as default } from './components/Slider';
export { SliderTrack } from './components/SliderTrack';
export { SliderSlide } from './components/SliderSlide';
export { SliderArrows } from './components/SliderArrows';
export { SliderPagination } from './components/SliderPagination';
export { IconArrow } from './icons/IconArrow';
export { useSlider } from './use-slider';
export { SliderContext, useSliderContext } from './slider-context';
export { NavigationAction } from './types';
export type {
  SliderApi,
  SliderContextValue,
  SliderControl,
  SliderGrid,
  SliderOptions,
  SliderPadding,
  SliderProps,
} from './types';
```

- [ ] **Step 2: Delete legacy files**

```bash
git rm -r src/SplideWrapper src/NavCustomSplide.tsx src/carousel-context.ts src/index.tsx src/icons/IconArrowRight.tsx
```

- [ ] **Step 3: Typecheck + full suite with coverage**

Run: `pnpm typecheck && pnpm test:cov`
Expected: PASS; coverage report shows **≥99%** on lines/statements/functions/branches. If any file dips below, add a targeted test (preferred) or a justified `/* v8 ignore next -- reason */`.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: public barrel; remove legacy Splide* implementation"`

---

## Task 15: Optional baseline stylesheet

**Files:**
- Create: `src/styles.css`
- Test: none (pure CSS). Validated by build copy + README usage.

**Interfaces:**
- Produces: `light-splide-slide/styles.css` — minimal theme driven entirely by CSS variables and `data-*` selectors. No element is required to use it.

- [ ] **Step 1: Write `src/styles.css`**

```css
/* Optional baseline theme for light-splide-slide. Import only if you want it:
   import 'light-splide-slide/styles.css';
   Override any of these custom properties to retheme. */
[data-slider-arrows] {
  --slider-arrow-size: 2.75rem;
  --slider-arrow-bg: #3a3a3c;
  --slider-arrow-color: #ffffff;
  --slider-arrow-radius: 0.5rem;
  position: absolute;
  inset-inline: 0;
  top: 50%;
  pointer-events: none;
  z-index: 2;
}

[data-slider-arrows] button {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: var(--slider-arrow-size);
  height: var(--slider-arrow-size);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: var(--slider-arrow-bg);
  color: var(--slider-arrow-color);
  opacity: 0.75;
  pointer-events: auto;
  cursor: pointer;
}
[data-slider-arrows] button:hover { opacity: 1; }
[data-slider-arrows] button[data-direction='prev'] {
  left: 0;
  border-radius: 0 var(--slider-arrow-radius) var(--slider-arrow-radius) 0;
}
[data-slider-arrows] button[data-direction='next'] {
  right: 0;
  border-radius: var(--slider-arrow-radius) 0 0 var(--slider-arrow-radius);
}
[data-slider-arrows] button[data-disabled='true'] { opacity: 0; }
[data-slider-arrows] button svg { width: 1em; height: 1em; }

[data-slider-pagination] {
  --slider-dot-size: 0.625rem;
  --slider-dot-color: #c7c7cc;
  --slider-dot-active-color: #0a84ff;
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 1rem;
}
[data-slider-dot] {
  width: var(--slider-dot-size);
  height: var(--slider-dot-size);
  border-radius: 9999px;
  background: var(--slider-dot-color);
}
[data-slider-dot][data-current='true'] { background: var(--slider-dot-active-color); }
```

- [ ] **Step 2: Build check** — `pnpm build` → `dist/styles.css` exists.

- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: add optional baseline stylesheet"`

---

## Task 16: Example, README, the project guide, CI

**Files:**
- Modify: `examples/BasicSliderExample.tsx`
- Rewrite: `README.md`
- Create: `the project guide`, `.github/workflows/ci.yml`

**Interfaces:** documentation only; example imports from `../src`.

- [ ] **Step 1: Rewrite `examples/BasicSliderExample.tsx`** to use the new neutral API + a CSS-Modules-style className demo and an inline-style demo, importing `Slider, SliderTrack, SliderSlide, SliderArrows, SliderPagination` from `../src`. Keep it framework-agnostic (plain `<img>`/`<a>`). No Tailwind/custom colors.

```tsx
'use client';
import { Slider, SliderArrows, SliderPagination, SliderSlide, SliderTrack } from '../src';

const categories = [
  { id: 1, title: 'Small prices' },
  { id: 2, title: 'Family' },
  { id: 3, title: 'Electric' },
  { id: 4, title: 'Luxury' },
];

export function BasicSliderExample() {
  return (
    <Slider
      aria-label="Categories"
      options={{ perPage: 1, fixedWidth: '14rem', gap: '1rem', pagination: true, padding: { left: '1rem', right: '1rem' } }}
    >
      <SliderArrows />
      <SliderTrack>
        {categories.map((c) => (
          <SliderSlide key={c.id}>
            <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>{c.title}</div>
          </SliderSlide>
        ))}
      </SliderTrack>
      <SliderPagination />
    </Slider>
  );
}

export default BasicSliderExample;
```

- [ ] **Step 2: Rewrite `README.md`** with sections: intro (headless, SSR, dependency-light); install; quickstart; **styling with each system** (Tailwind via `className`, CSS Modules, styled-components wrapping with render props, vanilla CSS via `data-*`, inline `style`); optional baseline stylesheet (`import 'light-splide-slide/styles.css'`); CSS-variable theming table (`--slider-arrow-*`, `--slider-dot-*`, `--slider-gap`); components & props tables; `SliderOptions` table (pruned list); `data-*` attribute reference; imperative API (`onMounted`); `useSlider` custom-build recipe; SSR notes (no window in render; `useSyncExternalStore`).

- [ ] **Step 3: Create `the project guide`**

```markdown
# the project guide — light-splide-slide

Headless, SSR-safe React slider on native scroll-snap.

## Architecture (strict dependency direction: presentation → controller → core)
- `src/core/` — pure, DOM-free option/geometry math. No React. ~100% unit-tested in node.
- `src/use-slider.ts` — the single controller hook: state, prop-getters, imperative API,
  SSR-safe responsive resolution via `useSyncExternalStore` + `getServerSnapshot`.
- `src/components/` — thin, side-effect-free-during-render components consuming the
  controller via `src/slider-context.ts`. Structural inline styles only; forward
  `className`/`style`/`...rest`; emit `data-*` state. No colors in JS.

## Rules
- TDD-first: failing test → minimal impl → pass → commit. No exceptions.
- **No `any`, no `unknown`, no type assertions** (`as`, `<T>x`) — except `as const` — and no
  non-null assertions (`!`), in source AND tests. Use type annotations, user-defined type
  guards, `satisfies`, ISP-narrowed parameter types, and the typed `querySelector<T>()` form
  instead. Biome errors on `noExplicitAny`/`noNonNullAssertion`; the `as`/`unknown` ban is
  enforced in review.
- Coverage gate ≥99% (lines/statements/functions/branches), enforced in `vitest.config.ts`.
- Pure logic → `*.test.ts` (node). DOM/geometry → `*.browser.test.tsx` (Vitest Browser Mode, Chromium).
- Headless contract: any styling system must work (Tailwind, CSS Modules, styled-components,
  vanilla CSS, inline). Never hard-code colors or require Tailwind.
- SSR: never read `window`/`document` during render.

## Commands
- `pnpm test` / `pnpm test:cov` — run tests / with coverage gate
- `pnpm lint` / `pnpm format` — Biome
- `pnpm typecheck` — tsc --noEmit
- `pnpm build` — tsup (ESM+CJS+d.ts) + copy styles.css
- `pnpm check` — lint + typecheck + test:cov (CI + prepublish gate)
- `pnpm release:patch|minor|major` — check + build + npm version + publish + push tags
```

- [ ] **Step 4: Create `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request: {}
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test:cov
      - run: pnpm build
```

- [ ] **Step 5: Verify** — `pnpm lint && pnpm typecheck && pnpm test:cov && pnpm build` → all PASS, coverage ≥99%.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "docs: rewrite README/example, add the project guide + CI"`

---

## Self-Review Notes (addressed)

- **Spec coverage:** Tailwind removal + className/style (Tasks 9–12, 14), extendability/no-fixed-colors (Tasks 9–12, 15; render props in 11–12; `data-*` everywhere), tests/99% (Tasks 1–14), README (16), SSR (Tasks 6, 8), the project guide (16), release commands (Task 1), Biome (Task 1). All mapped.
- **Magic strings removed:** `noArrows`→`hideOnMobile` prop, `splideNav--top`→`placement="top"` (Task 11).
- **Type consistency:** `SliderContextValue` (Task 3) adds `currentPageIndex` consumed by `useSlider` (Task 8) and `SliderPagination` (Task 12); `registerScrollElement`/`setPageCount` names consistent across Tasks 3/8/9.
- **Known ordering dependency:** Task 9's test depends on `SliderSlide` (Task 10) — flagged in Task 9 Step 1; implement Task 10's component before running Task 9's test, or run them as a pair.
- **Padding edge:** Task 4 Step 3 documents the `{left, right: undefined}` normalization and aligns the test expectation.
```
