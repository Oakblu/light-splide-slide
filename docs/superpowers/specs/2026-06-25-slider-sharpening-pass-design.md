# light-splide-slide — Sharpening Pass

**Date:** 2026-06-25
**Status:** Approved (design) — pending spec review
**Type:** Refactor + small features. Single spec, four phases.

## Goal

Make the package lighter, more maintainable, easier to use, and faster to render —
without changing its headless, SSR-safe, native-scroll-snap nature. The bones are
good; this is a sharpening pass, not a rebuild.

## Constraints (project rules — non-negotiable)

- **TDD-first** for every change: failing test → minimal impl → pass → commit.
- **Coverage ≥99%** (lines/statements/functions/branches) maintained throughout.
- **No `any`/`unknown`/type assertions (`as`, `<T>x`)/non-null `!`** in source or tests
  (`as const` allowed). Use type annotations, type guards, `satisfies`, ISP-narrowed
  params, and typed `querySelector<T>()`.
- **SSR:** never read `window`/`document` during render.
- Pure logic → node `*.test.ts`; DOM/resize/matchMedia/geometry → `*.browser.test.tsx`.
- Headless: no hard-coded colors, no required styling system.

## Breaking-change posture

Pre-1.0 (`0.1.0`). Breaking public-API changes are acceptable when they produce a
cleaner, more honest contract. All breaks are listed explicitly per phase.

---

## Phase B — Decompose `use-slider.ts` (do first; pure refactor)

**Why first:** lowest risk (existing tests are the safety net), and it makes Phases A
and C land against a clean controller.

**Problem:** `use-slider.ts` is 272 lines doing four distinct jobs, with the same page
geometry read — `querySelectorAll('[data-carousel-page="true"]')` + `scrollWidth -
clientWidth` + `getReachablePageCount(...)` — duplicated in three places (`measure`,
`goTo`, scroll-sync). The `grid ? 1 : perMove` ternary is duplicated with two
`v8 ignore` coverage-fudge comments.

**Changes:**

1. Extract a single page-geometry reader (DOM-reading, pure given an element):
   `readPageGeometry(scrollEl) → { pages, offsets, maxScrollLeft, reachableCount, maxIndex }`.
   Lives in a new module (e.g. `src/page-geometry.ts`), browser-tested directly.
   `measure`, `goTo`, and scroll-sync all call it — single source of truth for the
   geometry math.
2. Extract `resolvePerStep(options) → number` (the `grid ? 1 : perMove ?? 1` logic)
   into `core` and unit-test it in node, removing both `v8 ignore` comments and the
   "unreliable branch coverage" workaround.
3. Split the four effects into focused, independently-tested hooks (own files):
   - `useReachableCount(scrollRef, deps)` → `reachableCount` + `measure`
     (mount measure + `ResizeObserver`/`resize` fallback).
   - `useScrollSync(scrollRef, emitMoved)` → debounced settle → emit nearest reachable.
   - `useLastChildVisibility(scrollRef, pageCount)` → `isLastChildVisible`
     (`IntersectionObserver` + fallback).
   - `useImperativeApi(scrollRef, goTo, listenersRef, onMounted, onDestroy)`.
4. `useSlider` becomes a thin composer (~80 lines) wiring those hooks + derived state.

**Behavior:** identical. No public-API change in this phase. Existing browser tests for
`use-slider` must stay green unmodified (proof the refactor preserved behavior); new
unit/browser tests are added for each extracted unit.

**Risk:** medium-low. Mitigation: keep existing `use-slider.browser.test.tsx`
unchanged as the behavioral oracle; extract one unit at a time, green between each.

---

## Phase A — Resize render perf (`responsive-store.ts`)

**Problem:** `getSnapshot()` returns raw `window.innerWidth`. Because that value changes
every resize frame, `useSyncExternalStore` re-renders the whole tree and re-runs
`resolveOptions` on every frame — even when no breakpoint boundary is crossed.

**Approach (chosen):** `matchMedia`-backed store that re-renders **only on breakpoint
crossings** and returns a referentially-stable snapshot between them.

- `createResponsiveStore(breakpoints?, mediaQuery?)` builds one `MediaQueryList` per
  breakpoint width (query direction from `mediaQuery`: `'max'` → `max-width`, `'min'` →
  `min-width`; default `'max'`).
- Internal `cachedWidth: number | null`, updated **only** inside MQ `change` handlers
  (and once lazily on first client snapshot). `getSnapshot()` returns `cachedWidth`,
  so it is stable between crossings → no `useSyncExternalStore` churn / loop warnings.
- `subscribe(cb)` adds `change` listeners to every MQL; each handler refreshes
  `cachedWidth = window.innerWidth` then calls `cb`. Unsubscribe removes all listeners.
- `getServerSnapshot()` stays `null` (**SSR behavior unchanged**).
- No `breakpoints` (or empty) → zero queries → snapshot never changes → effectively no
  resize re-renders at all.

**Key property:** `core/options.ts` / `resolveOptions(options, width)` are **untouched**.
Passing the representative `innerWidth` captured at crossing time is correct because
resolution only changes at thresholds — any width within a band resolves identically.

**Wiring:** `use-slider.ts` passes `options.breakpoints` and `options.mediaQuery` into
`createResponsiveStore` (memoized on those inputs).

**Fallback:** if `matchMedia` is undefined (very old/jsdom), fall back to the current
`resize` + `innerWidth` behavior so nothing regresses.

**Tests:** browser tests asserting (a) re-render fires when a breakpoint MQ toggles,
(b) it does **not** fire on within-band resizes, (c) SSR snapshot is `null`,
(d) `matchMedia`-absent fallback path.

---

## Phase C — Tighten public API (breaking)

1. **Un-leak `useSlider`.** Move `pageCount`/`setPageCount` *state* inside the hook
   (`useState` there). Drop them from `UseSliderParams`. `Slider.tsx` no longer owns
   that `useState` — it just renders the provider with the hook's context. The context
   still exposes `setPageCount` (so `SliderTrack` keeps reporting child count) and
   `pageCount`. **Break:** the exported `useSlider` signature changes (advanced/headless
   consumers no longer pass `pageCount`/`setPageCount`).

2. **Typed events.** Introduce `SliderEventMap = { moved: (index: number) => void }`.
   Narrow `SliderApi.on` to `on<E extends keyof SliderEventMap>(event: E, cb:
   SliderEventMap[E]): () => void`. Keep the runtime `if (event !== 'moved')` guard for
   JS callers (returns a noop unsubscribe). **Break:** TS callers passing unknown event
   strings now fail to compile (intended).

3. **Remove dead `keyboard` option.** Delete `keyboard?: boolean` from `SliderOptions`
   (read nowhere). **Break:** TS callers setting `keyboard` fail to compile.

4. **Make `drag` real (wire `touch-action`).** `drag` is currently a no-op. Implement:
   the scroll element in `SliderTrack` sets `touchAction: 'pan-y'` when
   `options.drag === false` (disables horizontal touch/trackpad panning), and the
   browser default (horizontal pan allowed) when `drag !== false`. Scope is limited to
   touch/trackpad panning via `touch-action`; **native mouse drag-to-scroll is
   explicitly out of scope** (would require pointer-event handlers and a JS drag loop,
   against the package's no-JS-animation ethos — future spec if ever wanted).
   `drag` stays in `SliderOptions` and `DEFAULTS` (default `true`). Browser test:
   `drag: false` → `touch-action: pan-y` on the scroll element; default → not pan-y.

**Docs:** README/examples updated for the new `useSlider` signature and the now-real
`drag` semantics; `keyboard` references removed.

---

## Phase D — Bundle-size budget (do last)

**Why last:** so it measures the final, smaller bundle.

- Add dev deps `size-limit` + `@size-limit/preset-small-lib`.
- `.size-limit.json` (or `package.json` field) with entries for `dist/index.js`
  (gzip) and `dist/styles.css`. Measure current gzip first, then set each limit at
  current + small headroom (exact numbers chosen at implementation time from real
  measurement; recorded in the config).
- Add `"size": "size-limit"` script; wire into `check`
  (`lint && typecheck && test:cov && size`) and CI so regressions fail the build.
- Build must run before size (size-limit reads `dist`).

**Tests:** none (it's a CI gate, not runtime code). Verification = `pnpm build && pnpm
size` passes locally and the limit is set sanely above measured size.

---

## Sequencing & integration

B → A → C → D. Each phase is independently shippable and committed separately; coverage
gate and `pnpm check` stay green at every commit. The existing
`use-slider.browser.test.tsx` serves as the behavioral oracle for the Phase B refactor
and must remain green through A and C as well (except where C intentionally changes the
`useSlider` signature, at which point its setup is updated in the same commit).

## Out of scope (explicit YAGNI)

- All-in-one `<Carousel>` convenience component (composition stays explicit).
- Mouse drag-to-scroll / JS drag loop.
- Context selector / render-bailout optimizations beyond the resize-store fix.
- Vertical sliders, fade/loop types, autoplay.

## Success criteria

- Resize within a breakpoint band triggers **zero** slider re-renders (asserted in test).
- `use-slider.ts` ≤ ~100 lines; geometry read exists in exactly one place.
- `keyboard` gone; `drag: false` measurably sets `touch-action: pan-y`; `on()` is typed.
- `useSlider` callable without passing `pageCount`/`setPageCount`.
- `pnpm size` gate green and wired into `check`/CI.
- Coverage ≥99%, `pnpm check` green, no `any`/`as`/`!` introduced.
