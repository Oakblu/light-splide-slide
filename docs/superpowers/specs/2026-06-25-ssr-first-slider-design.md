# SSR-first slider — design

**Date:** 2026-06-25
**Status:** Approved (pending spec review)
**Goal:** Make `light-splide-slide` SSR-first: eliminate `useState`, and reduce `'use client'`
to only the genuinely-interactive client island, so the structural components render as React
Server Components (RSC) in Next.js App Router.

## Motivation

The package is already SSR-*safe* (renders on the server via `useSyncExternalStore` +
`getServerSnapshot`). Native scroll-snap means scrolling/swiping needs **zero JS**. The remaining
JS exists only for (a) React state and (b) interactivity (arrow `onClick`, scroll/IO/RO listeners,
the imperative API).

Two concrete goals:

1. **No `useState`.** Replace all four `useState` call-sites with a single per-slider external
   store read via `useSyncExternalStore` (the SSR-safe primitive already in use).
2. **Minimize `'use client'`.** Split structural rendering (server) from interactivity (a minimal
   client island) so `Slider`, `SliderTrack`, and `SliderSlide` become true server components.

### Why not "just delete every `'use client'`"

Tests run in Vitest browser mode, where `'use client'` is a no-op — so deleting the directives
would keep tests green but break real Next.js Server Component consumers (`useContext`/`useState`/
`useRef`/`createContext` all require a client boundary). We instead remove client-feature *usage*
from the structural components so the directive's removal is *correct*, not cosmetic.

### What stays client (by design / by tested contract)

- `useSlider` + `SliderContext` — a directly-tested public headless API
  (`use-slider.browser.test.tsx`, `use-slider-pagination.browser.test.tsx`,
  `headless.browser.test.tsx` call `useSlider()` and provide `SliderContext.Provider` themselves,
  pushing state via `ctx.setPageCount(n)` and asserting `go('>')` updates `index`). Its public
  surface (`setPageCount`, `registerScrollElement`, `currentIndex`, `canGoNext/Prev`, `go`, `on`,
  `next`, `prev`, …) is frozen; only the internal state mechanism changes.
- `SliderArrows`, `SliderPagination` — consume dynamic state and fire `onClick`.
- The new `SliderRuntime` island.

One important reassurance: client components do **not** force consumer content into the client
bundle. Slide content passed as `children` to `<SliderSlide>` still server-renders and streams.

## Architecture: two planes

### Plane A — Server (no `'use client'`, no hooks, no context)

Renders all structural DOM from options alone — `<section>`, the track/scroll wrapper, page
grouping, and the slides (the SSR-first payload).

- **`Slider` (server).** Resolves base options server-side: `resolveOptions(options, null)`.
  Renders `<section style={{ position: 'relative', ...cssVars, ...userStyle }}>` carrying CSS
  custom properties for style options (`--slider-gap`, `--slider-padding-left/right`,
  `--slider-per-page`, `--slider-fixed-width`). Wraps children in the client
  `<SliderRuntime options={resolved}>`. Injects resolved options into its direct `SliderTrack`
  child via `cloneElement` (Track is the only structural child that needs option *data*, for grid
  grouping). Direct-child composition is assumed (matches all current usage/tests).
- **`SliderTrack` (server).** Pure function of (children, injected options, own props). Groups
  children into pages (grid `dimensions` / `cssGridRows`), emits the outer wrapper + scroll
  container with structural styles (gap/padding via CSS vars, `touch-action` from `drag`), and on
  the flat-mode `cloneElement` injects each slide's computed `width`. No context. **No effect** —
  it no longer reports `pageCount` (the runtime measures it). Rendered with no injected options
  (standalone) → returns `null` (preserves the "renders null outside a Slider" behavior).
- **`SliderSlide` (server).** Dumb `div`. Width comes from the style Track injects (flat mode) or
  resolves from CSS vars; user `style`/`className`/`...rest` forwarded with user precedence
  preserved. Standalone (no parent injection) → plain `div` (test preserved).

### Plane B — Client island (`'use client'`, minimal)

- **`SliderRuntime` (new, client).** Calls `useSlider({ options, onMounted, onDestroy })`, provides
  `SliderContext`, and renders a wrapper `div` (with a ref) around `children`. On mount it:
  - `querySelector('[data-slider-scroll]')` from its root → `registerScrollElement(el)`
    (replaces the ref-threading that `<Slider>` used to do directly).
  - counts `[data-carousel-page]` elements → `setPageCount(n)` (replaces `SliderTrack`'s old
    effect; identical count, so pagination/measurement behavior is unchanged).
  - imperatively re-syncs CSS style-vars on viewport breakpoint changes (responsive style options).
- **`SliderArrows`, `SliderPagination` (client).** Behavior unchanged; read `SliderContext`.

`'use client'` ends up only on: `SliderRuntime`, `SliderArrows`, `SliderPagination`, `use-slider`,
`slider-context`. Removed from `Slider`, `SliderTrack`, `SliderSlide`, and all pure files
(`slider-store`, `responsive-store`, `core/*`, `page-geometry`, `types`).

## State model (eliminating `useState`)

New pure module `src/slider-store.ts` (no React, no `'use client'`):

```ts
type SliderState = {
  currentIndex: number;
  pageCount: number;
  reachableCount: number | null;
  isLastChildVisible: boolean;
};

createSliderStore(): {
  subscribe(cb: () => void): () => void;
  getSnapshot(): SliderState;        // client
  getServerSnapshot(): SliderState;  // SSR: frozen initial state
  setState(patch: Partial<SliderState>): void;  // shallow-merge + notify
};
```

- `useSlider` reads the whole state with one
  `useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)`.
- `emitMoved`, `setPageCount`, and the measurement hooks (`use-reachable-count`,
  `use-last-child-visibility`) **write into the store** via `setState` instead of owning
  `useState`. They keep exposing the same values.
- `currentIndex` continues to be mirrored in a ref (`currentIndexRef`) so `api.index` and `go()`
  stay synchronous; the store drives reactive re-render.
- Initial state: `{ currentIndex: 0, pageCount: 0, reachableCount: null, isLastChildVisible: false }`
  — identical to today's initial `useState` values, so SSR output and the first client render match.

Result: **no `useState` anywhere** in source or tests.

## Options distribution (server-safe)

Server components cannot use `useContext`, so option data reaches them without context:

- **Style options** (gap, padding, perPage width, fixedWidth) → CSS custom properties set by
  `Slider` on `<section>`; read by Track/Slide via `var()` and computed widths.
- **Structural grouping options** (`grid.dimensions`, `cssGridRows`) → `cssGridRows` is already a
  `SliderTrack` prop; `grid` is injected into Track by `Slider` via `cloneElement` of its direct
  `SliderTrack` child (identified by a static marker on the component).
- **Dynamic state + resolved options for interactivity** → the client `SliderContext`, consumed by
  `SliderArrows`/`SliderPagination`/`useSlider` (unchanged).

## Test impact and coverage

Behavior is preserved; a small number of assertions change because the wiring changes.

**Changed (Tier-2 wiring, same observable result):**
- `SliderSlide.browser.test.tsx` "applies fixedWidth" — assertion adjusts if width flows via a CSS
  var that resolves to `10rem` (slide is still 10rem wide).
- `headless.browser.test.tsx` "SliderTrack renders null outside a Slider" — same `null` output;
  rationale shifts from "no context" to "no injected options".
- Any assertion implicitly depending on `SliderTrack`'s `setPageCount` effect now depends on the
  runtime's measure path. Real-`<Slider>` pagination tests
  (`use-slider-pagination.browser.test.tsx`) assert identical page counts and should pass as-is.

**Unchanged (frozen contract):** the entire `useSlider`/`SliderContext` headless surface,
`SliderArrows`, `SliderPagination`, and all structural-style assertions in
`SliderTrack.browser.test.tsx` / `Slider.browser.test.tsx`.

**Coverage (≥99% lines/statements/functions/branches, enforced in `vitest.config.ts`):**
- New files `slider-store.ts` and `SliderRuntime` get dedicated unit/browser coverage.
- Removed `useState` branches shrink the surface.
- The `getServerSnapshot` path is covered by an SSR/initial-state test.

## Known limitations (accepted)

- **Per-breakpoint *structural* changes** (e.g., `grid.dimensions` differing per breakpoint) resolve
  from base options at SSR; the runtime re-syncs *style* vars on viewport change but does not
  re-group the DOM. Style-level responsive (gap/padding/perPage width) is fully supported. No
  current test exercises per-breakpoint regrouping.
- **Pagination dots / arrow-disabled states** are client-driven (as today): they populate on mount,
  not in SSR HTML. The content (slides) is fully SSR-rendered — the SSR-first goal.
- **Direct-child composition** of `SliderTrack` under `Slider` is assumed for option injection
  (matches all current usage and tests).

## Non-goals

- Zero-JS interactivity (anchor-link navigation, CSS scroll-driven active states).
- Changing the public composition API (`<Slider options>` / `<SliderTrack>` / `<SliderSlide>` /
  `<SliderArrows>` / `<SliderPagination>`).
- Removing the imperative API (`onMounted`, `on('moved')`).

## Constraints carried from the project guide

- TDD-first; coverage gate ≥99%.
- No `any`/`unknown`/type assertions (except `as const`) and no non-null assertions, in source and
  tests.
- Headless contract: any styling system works; never hard-code colors or require Tailwind.
- SSR: never read `window`/`document` during render.
- Strict dependency direction: presentation → controller → core.
