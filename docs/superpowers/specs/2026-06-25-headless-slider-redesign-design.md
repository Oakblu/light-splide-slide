# Headless Slider Redesign — Design Spec

**Date:** 2026-06-25
**Package:** `light-splide-slide`
**Status:** Approved design, ready for implementation planning

## Problem

The package was extracted from a host app (`MostFrequentlyUsedSearches`) and carries
the app's assumptions with it. To become a reusable, easy-to-use, highly extendable
slider it must shed those assumptions:

1. **Tailwind hard-dependency + app-specific colors.** Every element uses `twMerge`
   and utility classes including non-portable custom colors (`bg-arsenic`, `bg-iron`,
   `bg-luxauto-100`, `bg-raven`). It does not render correctly outside the original app,
   and there is no first-class `className` + `style` support.
2. **Not extendable.** Fixed colors and fixed visual rules; behavior is smuggled through
   magic class strings (`className.includes('noArrows')`, `className.includes('splideNav--top')`).
3. **No tests.**
4. **README assumes Tailwind**; not comprehensive.
5. **Not SSR-safe.** `useViewportWidth()` returns `null` on the server then
   `window.innerWidth` on the client, changing resolved options and risking hydration
   mismatch.

Also missing: a `CLAUDE.md`, and one-step version-bump + npm-publish commands.

## Goals & Non-Goals

**Goals**

- Truly **headless** core: works with Tailwind, CSS Modules, styled-components, vanilla
  CSS, or inline styles — equally well, with no preference baked in.
- **Clean 1.0 API** (breaking redesign permitted): real typed props instead of magic
  strings; neutral, non-`Splide` naming.
- **SSR-first**: identical server and first-client render; no hydration mismatch.
- **TDD-first**, SOLID, DRY, KISS.
- **Strict TypeScript**: no `any`, no `unknown`, no type assertions (`as` / `<T>x`, except
  `as const`), no non-null assertions (`!`) — in source and tests. Cast-free patterns only.
- **≥ 99% test coverage** (lines, statements, functions, branches), enforced in CI.
- Tooling: **Biome** (lint/format), **tsup** (build), one-step release scripts, `CLAUDE.md`,
  rewritten comprehensive `README`.

**Non-Goals**

- Backward compatibility with the current `Splide*` exports (no aliases; clean break).
- Supporting carousel `type` modes other than `slide`.
- A heavy "batteries-included" theme. The shipped stylesheet is an _optional_ minimal baseline.

## Decisions (locked during brainstorming)

| Decision            | Choice                                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Styling model       | Headless core; structural styles only; `className`+`style` on every part; `data-*` state hooks; CSS custom properties for theming; optional baseline CSS at a subpath. Any styling system works. |
| API compatibility   | Clean breaking redesign → this is the 1.0 surface. No `Splide*` aliases.                                                                                                                         |
| Test strategy       | Hybrid: pure logic in Vitest **node**; DOM/geometry in Vitest **Browser Mode** (real Chromium via Playwright).                                                                                   |
| Extensibility shape | **Hybrid (Option C)**: ergonomic compound components built _on top of_ an exported `useSlider` controller hook + prop-getters. One source of truth.                                              |
| Lint/format         | Biome.                                                                                                                                                                                           |
| Build               | tsup (ESM + CJS + d.ts).                                                                                                                                                                         |
| Release             | npm-native one-step scripts (`release:patch/minor/major`).                                                                                                                                       |

## Architecture — three layers

Dependency direction is strictly **presentation → controller → core**. Core depends on nothing.

### Layer 1 — Pure core (`src/core/`)

No React, no DOM. Pure functions, trivially unit-testable in node toward ~100%:

- `resolveOptions`, `mergeOptions` (+ `mergePadding`, `mergeGrid`)
- `getMaxIndex`, `getPaginationCount`, `resolveNextIndex`, `getGridDimensions`,
  `getNearestPageIndex`, `toCssUnit`

These are lifted out of the current `SplideWrapper/utils.ts`, with any DOM coupling removed.
Single responsibility: decide _what_ should happen, never _how_ the DOM does it.

### Layer 2 — Controller hook (`src/use-slider.ts`)

The single stateful brain. Owns:

- `currentIndex` (+ `currentIndexRef`), scroll-element ref, moved-listener set, imperative API.
- Prop-getters: `getTrackProps`, `getSlideProps`, `getPrevButtonProps`, `getNextButtonProps`,
  `getPaginationProps`.
- Imperative API: `go`, `on('moved', cb)`, `index`, `destroy`.

**SSR-safety lives here.** Responsive option resolution goes through
`useSyncExternalStore` with `getServerSnapshot()` returning the **base** (non-responsive)
options, so the server and first client paint render identical markup. After hydration the
store updates to the matched breakpoint. DOM side effects (`scrollTo`, geometry reads,
`IntersectionObserver`, `requestAnimationFrame` scroll-sync) are isolated behind small
internal effect helpers; the decision logic stays pure and mockable.

CSS-driven responsiveness is preferred wherever possible (slide width, gap, padding are
CSS custom properties set via media/container queries), so most responsive behavior needs
no JS viewport read at all.

### Layer 3 — Presentation (`src/components/`)

Thin, side-effect-free-during-render components consuming the controller via context:

- `Slider` — root; owns controller; provides context; requires `aria-label`.
- `SliderTrack` — scrollable snap track.
- `SliderSlide` — one slide; width from `fixedWidth` or `perPage` via CSS.
- `SliderArrows` — prev/next nav (replaces `NavCustomSplide`).
- `SliderPagination` — dot pagination (now a real component, not inline in the wrapper).

Each forwards `className`, `style`, `...rest`, and `ref`, and emits `data-*` state.
No business logic. Presentation is fully replaceable — that is the "extendable" guarantee.

## Public API surface

```
Components (90% case):
  <Slider aria-label="…" options={…}>
  <SliderTrack>
  <SliderSlide>
  <SliderArrows placement="default|top" hideOnMobile />
  <SliderPagination />

Hook (10% / full custom):
  useSlider(options)        -> state + prop-getters + imperative api
  useSliderContext()        -> read controller within <Slider>

Prop-getters:
  getTrackProps, getSlideProps, getPrevButtonProps, getNextButtonProps, getPaginationProps

Types:
  SliderOptions, SliderApi, SliderControl, SliderGrid, SliderPadding,
  SliderContextValue, SliderArrowsProps, SliderProps, …
```

**Magic strings → real props:**

- `className.includes('noArrows')` → `<SliderArrows hideOnMobile />`.
- `className.includes('splideNav--top')` → `<SliderArrows placement="top" />`.

**Styling contract (no fixed colors):**

- Structural inline styles only (flex, snap, overflow, computed slide width, gap/padding vars).
- `data-*` state for any selector engine: `data-active`, `data-disabled` (arrows),
  `data-current` (pagination), `data-orientation`.
- CSS custom properties for theming, e.g. `--slider-gap`, `--slider-arrow-size`,
  `--slider-arrow-bg`, `--slider-arrow-color`, `--slider-dot-size`, `--slider-dot-color`,
  `--slider-dot-active-color`. (Final variable list finalized during implementation.)
- Optional baseline stylesheet published at `light-splide-slide/styles.css`.

**Options (`SliderOptions`)** carry forward the existing shape (`arrows`, `drag`,
`pagination`, `perPage`, `perMove`, `fixedWidth`, `fixedHeight`, `gap`, `padding`, `grid`,
`mediaQuery`, `breakpoints`, `focus`, `omitEnd`, `keyboard`, `lazyLoad`, `type:'slide'`),
minus anything proven dead during implementation (documented in the plan).

## Behavioral details preserved

- `IntersectionObserver` last-child-visibility detection **with** the non-IO fallback path.
- `currentIndexRef` + `requestAnimationFrame`-debounced scroll-sync → `moved` emission.
- Grid pages and CSS-grid-rows layouts; pagination count math; index clamping;
  `>`/`<`/`+n`/`-n`/numeric controls.
- Imperative API lifecycle: `onMounted(api)` / `onDestroy()` and listener cleanup on unmount.

## Testing strategy (TDD-first, ≥99%)

Test-first for every unit: red → green → refactor (uses the `test-driven-development` skill).
No production line written before a failing test requires it.

**Two Vitest projects, one merged coverage report (v8):**

1. **Node** (`*.test.ts`): entire pure core + SSR snapshot logic
   (`getServerSnapshot` vs `getSnapshot`). Fast, no browser. Covers the logic-heavy majority.
2. **Browser** (`*.browser.test.tsx`): Vitest Browser Mode on real Chromium (Playwright).
   Covers scroll-snap, `scrollTo`, real geometry, `IntersectionObserver`, arrow clicks
   moving the track, pagination state, drag/scroll-sync, keyboard nav, component rendering,
   `className`/`style`/`data-*` forwarding, and `aria-label` enforcement.

**Coverage gate:** lines/statements/functions/branches **≥ 99%** in Vitest config; CI fails
under threshold. Genuinely untestable lines use an explicit, commented `/* v8 ignore */`
(kept to near-zero, each justified).

**Test categories:**

- Core math/option resolution (node) — breakpoints, grid, perPage/perMove, padding merge,
  index clamping, nearest-page.
- SSR (node) — server snapshot equals base options; no `window` access in snapshot path.
- Controller integration (browser) — go/next/prev/clamping, moved listeners, imperative
  lifecycle, destroy cleanup.
- Components (browser) — rendering, styling-prop forwarding, a11y, arrow disabled/`data-*`,
  pagination current dot, last-child-visible edge.
- Headless proof (browser) — build a working UI from the exported hook + prop-getters with
  **no** components.

## Tooling, build & release

**Biome** — `biome.json`; scripts `lint`, `lint:fix`, `format`; runs in CI and pre-publish.

**tsup** — ESM + CJS + `.d.ts`. `exports`:

- `"."` → types/import/require for the library.
- `"./styles.css"` → optional baseline stylesheet.
- `"sideEffects": ["*.css"]`; `files: ["dist"]`.
- `react`/`react-dom` remain peer deps; **`tailwind-merge` removed**.

**Release scripts (npm-native, KISS):**

- `release:patch` / `release:minor` / `release:major` →
  `check` (lint + typecheck + test + coverage gate) → `build` → `npm version <type>` →
  `npm publish` → `git push --follow-tags`.
- `prepublishOnly` runs `check` + `build` (broken builds can't publish).
- `.github/workflows/ci.yml`: lint + typecheck + tests + coverage on PRs
  (optional publish-on-tag).

**CLAUDE.md** documents: three-layer architecture + dependency direction, TDD-first rule,
99% coverage gate, node-vs-browser test split, headless/no-fixed-colors styling contract,
and the release commands.

**README** rewritten: headless quickstart; styling with _each_ system (Tailwind, CSS
Modules, styled-components, vanilla CSS, inline); CSS-variable theming reference; full
options/props/`data-*` tables; imperative API; `useSlider` custom-build recipe; SSR notes.

## Risks & mitigations

- **Browser-mode CI cost/flake.** Mitigate by keeping the logic-heavy majority in fast node
  tests; browser tests target only true DOM/geometry behavior. CI installs the Playwright
  Chromium provider.
- **99% on the React/effect layer.** Mitigate by pushing logic into the pure core and the
  controller so the component layer is thin; remaining lines covered by browser tests.
- **CSS-driven responsiveness vs JS breakpoints.** Prefer CSS; reserve JS breakpoints (via
  `useSyncExternalStore`) only for option changes CSS can't express, keeping the SSR path
  small and fully testable.

## Out of scope for this spec

Exact CSS-variable naming, the final pruned options list, and the precise prop-getter
signatures are settled during implementation (TDD will pin them down) and recorded in the
implementation plan.
