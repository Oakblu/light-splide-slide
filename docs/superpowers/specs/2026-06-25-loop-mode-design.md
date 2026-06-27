# Loop Mode Design — `type: 'loop'`

**Date:** 2026-06-25
**Status:** Approved

---

## Summary

Add `type: 'loop'` to `SliderOptions`. When active, pressing Next at the last slide instantly jumps to the first, and pressing Prev at the first instantly jumps to the last. Arrows are always enabled (as long as there is more than one page). No DOM cloning, no CSS tricks — pure navigation-index wrapping.

---

## Motivation

The current `type: 'slide'` mode clamps navigation at both ends and disables the arrow at the boundary. Users want the slider to cycle continuously. The navigation-wrap approach is the correct fit for a scroll-snap–based headless library: it is simple, reliable, and avoids the fragile scroll-position-reset hacks required for true clone-based infinite loops.

---

## Design

### 1. Type extension — `src/types.ts`

```ts
// Before
type?: 'slide';

// After
type?: 'slide' | 'loop';
```

No other type changes. `SliderOptions`, `SliderContextValue`, and `SliderApi` are unaffected.

---

### 2. `goTo` — wrap instead of clamp — `src/use-slider.ts`

Current logic:
```ts
const clamped = Math.max(0, Math.min(next, maxIndex));
if (clamped === currentIndexRef.current) return;
// ...
scrollElement.scrollTo({ behavior: 'smooth', left: targetLeft });
```

New logic when `resolvedOptions.type === 'loop'`:

| Condition | Target index | `scrollBehavior` |
|---|---|---|
| `next < 0` | `maxIndex` | `'instant'` |
| `next > maxIndex` | `0` | `'instant'` |
| otherwise | `next` (unchanged) | `'smooth'` |

Wrap uses `behavior: 'instant'` because smooth-scrolling across the full track in reverse looks wrong. Mid-track moves keep `'smooth'`.

The no-op guard `if (targetIndex === currentIndexRef.current) return` remains. In loop mode this only fires if `maxIndex === 0` (single page — nothing to move).

---

### 3. `canGoNext` / `canGoPrev` — `src/use-slider.ts`

```ts
const isLoop = resolvedOptions.type === 'loop';

canGoNext: isLoop ? maxIndex > 0 : (currentIndex < maxIndex && !isLastChildVisible),
canGoPrev: isLoop ? maxIndex > 0 : currentIndex > 0,
```

`maxIndex > 0` is the single guard: if there is only one navigable position (e.g. 3 slides with `perPage: 3`) the arrows stay disabled even in loop mode — there is nothing to wrap to.

---

## Behaviour by scenario

| Scenario | Expected |
|---|---|
| Last slide, Next pressed | Instant jump to index 0 |
| First slide, Prev pressed | Instant jump to `maxIndex` |
| Mid-track, any nav | Smooth scroll as normal |
| `maxIndex === 0` | Arrows disabled; no-op on `goTo` |
| `perMove: 3`, 8 slides, at index 5 (last), Next | Instant jump to 0 |
| Pagination dots | Unchanged — maps to real page indices |
| `api.go('>') / api.go('<')` | Same wrap rules apply |
| `api.go(99)` (absolute past end) | Wraps to 0 (instant) |
| SSR | No change — `type` is a plain string option |

---

## Out of scope

- Clone-based true-infinite scroll (no DOM changes, no scroll-position reset)
- Loop during free drag/touch (native scroll-snap controls that; no override)
- `autoplay` / timer-driven loop (separate feature)

---

## Files changed

| File | Change |
|---|---|
| `src/types.ts` | Add `'loop'` to `type` union |
| `src/use-slider.ts` | Wrap logic in `goTo`; update `canGoNext`/`canGoPrev` |

No other files need changes. `SliderArrows`, `SliderPagination`, `SliderTrack`, `SliderSlide`, and all context/store files are untouched.

---

## Testing

All tests follow the project's TDD rule: failing test first, then minimal implementation.

- **Unit** (`src/core/geometry.test.ts`) — none needed; `resolveNextIndex` is unchanged.
- **Browser** (`src/use-slider.browser.test.tsx` or a new `loop.browser.test.tsx`) — cover:
  - Next at last index wraps to 0 (scroll position = 0)
  - Prev at index 0 wraps to `maxIndex` (scroll position = maxScrollLeft)
  - `canGoNext` and `canGoPrev` are both `true` mid-track and at edges in loop mode
  - `canGoNext` and `canGoPrev` are both `false` when `maxIndex === 0`
  - `api.go(99)` wraps correctly
  - `type: 'slide'` behaviour is unaffected (regression)
