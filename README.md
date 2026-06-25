# @luxauto/slider

A lightweight, dependency-free React carousel/slider with a **Splide-like API**.

Instead of wrapping `@splidejs/splide`, this implementation is built directly on
native CSS **scroll-snap** + a small React controller. That makes it:

- **SSR-friendly** — renders markup on the server, hydrates without layout shift.
- **Tiny** — the only runtime dependency is [`tailwind-merge`](https://github.com/dcastil/tailwind-merge).
- **Touch / drag native** — horizontal scroll + snap is handled by the browser.
- **Accessible** — arrows are real `<button>`s with `aria-label`s and disabled states.

It is extracted from the `MostFrequentlyUsedSearches` component so it can be
reused in any React project and, later, published as a standalone package.

## Install

```bash
# once published
pnpm add @luxauto/slider tailwind-merge
```

Peer deps: `react` and `react-dom` (>= 18).

> The styling uses Tailwind utility classes. The slider works without Tailwind —
> just override the `className` props with your own CSS.

## Usage

```tsx
import { NavCustomSplide, SplideSlide, SplideTrack, SplideWrapper } from '@luxauto/slider';

export function MySlider({ items }) {
  return (
    <SplideWrapper
      aria-label="My slider"
      options={{
        type: 'slide',
        drag: true,
        pagination: false,
        fixedWidth: '14rem',
        gap: '1rem',
        padding: { left: '1rem', right: '1rem' },
      }}
    >
      <NavCustomSplide />
      <SplideTrack>
        {items.map((item) => (
          <SplideSlide key={item.id}>{/* slide content */}</SplideSlide>
        ))}
      </SplideTrack>
    </SplideWrapper>
  );
}
```

See [`examples/BasicSliderExample.tsx`](./examples/BasicSliderExample.tsx) for a
complete, self-contained example.

## Components

| Export | Description |
| --- | --- |
| `SplideWrapper` | Root component. Owns carousel state and provides context. Requires `aria-label`. |
| `SplideTrack` | The scrollable track. Wrap your slides in it. Supports `grid` / `cssGridRows` layouts. |
| `SplideSlide` | A single slide. Width derives from `fixedWidth` or `perPage`. |
| `NavCustomSplide` | Prev/next arrow navigation, wired to the carousel context. |
| `useCarouselContext` | Hook to read carousel state (build custom nav / pagination). |
| `IconArrowRight` | The default arrow icon used by `NavCustomSplide`. |

## Options (`CarouselOptions`)

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `type` | `'slide'` | `'slide'` | Only `slide` is supported. |
| `arrows` | `boolean` | `true` | Show/hide nav arrows. |
| `drag` | `boolean` | `true` | Native horizontal scroll/drag. |
| `pagination` | `boolean` | `false` | Render dot pagination. |
| `perPage` | `number` | `1` | Visible slides per page (when no `fixedWidth`). |
| `perMove` | `number` | `1` | Slides moved per arrow click. |
| `fixedWidth` | `string \| number` | — | Fixed slide width (overrides `perPage`). |
| `gap` | `string \| number` | `0` | Gap between slides. |
| `padding` | `CarouselPadding \| number \| string` | — | Track padding (peeking edges). |
| `grid` | `CarouselGrid` | — | Multi-row/column grid pages. |
| `mediaQuery` | `'min' \| 'max'` | `'max'` | How `breakpoints` are matched. |
| `breakpoints` | `Record<number, Partial<CarouselOptions>>` | — | Responsive overrides. |

## Imperative API

```tsx
<SplideWrapper
  aria-label="…"
  onMounted={(api) => {
    api.go('>');               // next page
    api.go(2);                 // go to index 2
    api.on('moved', (index) => console.log(index));
  }}
/>
```

## Files

```
slider/
├── package.json
├── tsconfig.json
├── README.md
├── examples/
│   └── BasicSliderExample.tsx   # framework-agnostic usage demo
└── src/
    ├── index.tsx                # public entry / barrel
    ├── carousel-context.ts      # React context + option types
    ├── NavCustomSplide.tsx      # arrow navigation
    ├── icons/
    │   └── IconArrowRight.tsx
    └── SplideWrapper/
        ├── index.tsx            # SplideWrapper, SplideTrack, SplideSlide
        ├── hooks.ts             # controller, scroll-sync, imperative API
        ├── types.ts             # public types
        └── utils.ts             # option resolving + geometry helpers
```
