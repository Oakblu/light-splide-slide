# light-splide-slide

Headless, SSR-safe React slider/carousel built on native scroll-snap.

- **Headless** — no bundled colors, no required CSS classes; style with Tailwind, CSS Modules, styled-components, vanilla CSS, or inline styles.
- **SSR-safe** — `window`/`document` are never read during render; viewport width is resolved via `useSyncExternalStore` with a `getServerSnapshot`.
- **Dependency-light** — React 18+ only; zero runtime dependencies beyond React itself.
- **TypeScript-first** — strict types, full `d.ts` output, no `any`.

---

## Install

```bash
npm install light-splide-slide
# or
pnpm add light-splide-slide
# or
yarn add light-splide-slide
```

Peer dependencies: `react >= 18`, `react-dom >= 18`.

---

## Quickstart

```tsx
import { Slider, SliderArrows, SliderPagination, SliderSlide, SliderTrack } from 'light-splide-slide';

const items = ['Slide 1', 'Slide 2', 'Slide 3'];

export function MySlider() {
  return (
    <Slider
      aria-label="My slider"
      options={{ perPage: 1, pagination: true, gap: '1rem' }}
    >
      <SliderArrows />
      <SliderTrack>
        {items.map((item) => (
          <SliderSlide key={item}>
            <div>{item}</div>
          </SliderSlide>
        ))}
      </SliderTrack>
      <SliderPagination />
    </Slider>
  );
}
```

---

## Styling

The slider is fully headless. Pick any styling approach, or mix them.

### Tailwind (via `className`)

```tsx
<Slider aria-label="Tailwind slider" options={{ perPage: 2, gap: '1rem' }}>
  <SliderArrows className="absolute inset-x-0 top-1/2 -translate-y-1/2" />
  <SliderTrack>
    <SliderSlide className="rounded-lg bg-gray-100 p-4">Slide 1</SliderSlide>
    <SliderSlide className="rounded-lg bg-gray-100 p-4">Slide 2</SliderSlide>
  </SliderTrack>
  <SliderPagination className="flex justify-center gap-2 mt-4" />
</Slider>
```

### CSS Modules

```tsx
import styles from './Slider.module.css';

<Slider aria-label="CSS Modules slider" options={{ perPage: 1 }}>
  <SliderArrows className={styles.arrows} />
  <SliderTrack className={styles.track}>
    <SliderSlide className={styles.slide}>Slide 1</SliderSlide>
  </SliderTrack>
  <SliderPagination className={styles.pagination} dotClassName={styles.dot} />
</Slider>
```

### styled-components (render props)

```tsx
import styled from 'styled-components';
import { SliderArrows } from 'light-splide-slide';

const StyledBtn = styled.button`
  background: navy;
  color: white;
  border-radius: 50%;
  width: 2rem;
  height: 2rem;
`;

<SliderArrows
  renderPrev={({ disabled, onClick }) => (
    <StyledBtn disabled={disabled} onClick={onClick} aria-label="Previous">
      &#8249;
    </StyledBtn>
  )}
  renderNext={({ disabled, onClick }) => (
    <StyledBtn disabled={disabled} onClick={onClick} aria-label="Next">
      &#8250;
    </StyledBtn>
  )}
/>
```

### Vanilla CSS (via `data-*` attributes)

Every structural element emits `data-*` attributes you can target in plain CSS:

```css
[data-slider-arrows] { position: absolute; inset-inline: 0; top: 50%; }
[data-slider-arrows] button[data-direction="prev"] { left: 0; }
[data-slider-arrows] button[data-direction="next"] { right: 0; }
[data-slider-arrows] button[data-disabled="true"] { opacity: 0; }
[data-slider-pagination] { display: flex; justify-content: center; gap: 0.5rem; }
[data-slider-dot][data-current="true"] { background: royalblue; }
```

### Inline styles

```tsx
<Slider
  aria-label="Inline slider"
  style={{ position: 'relative' }}
  options={{ perPage: 1 }}
>
  <SliderArrows
    style={{ position: 'absolute', top: '50%', width: '100%' }}
    prevStyle={{ position: 'absolute', left: 0 }}
    nextStyle={{ position: 'absolute', right: 0 }}
  />
  <SliderTrack>
    <SliderSlide style={{ background: '#f5f5f5', padding: 16 }}>Slide 1</SliderSlide>
  </SliderTrack>
</Slider>
```

---

## Optional baseline stylesheet

The package ships a minimal, zero-specificity baseline that wires up arrow and dot visuals via CSS custom properties. Import it only if you want it:

```ts
import 'light-splide-slide/styles.css';
```

Once imported, override custom properties on any ancestor element to retheme:

```css
.my-slider {
  --slider-arrow-size: 3rem;
  --slider-arrow-bg: #0050ff;
  --slider-arrow-color: #fff;
  --slider-arrow-radius: 50%;
  --slider-dot-size: 8px;
  --slider-dot-color: #ccc;
  --slider-dot-active-color: #0050ff;
}
```

### CSS custom property reference

| Property | Default | Description |
|---|---|---|
| `--slider-arrow-size` | `2.75rem` | Arrow button width and height |
| `--slider-arrow-bg` | `#3a3a3c` | Arrow button background color |
| `--slider-arrow-color` | `#ffffff` | Arrow button icon color |
| `--slider-arrow-radius` | `0.5rem` | Arrow button corner border-radius |
| `--slider-dot-size` | `0.625rem` | Pagination dot width and height |
| `--slider-dot-color` | `#c7c7cc` | Inactive dot background color |
| `--slider-dot-active-color` | `#0a84ff` | Active dot background color |

---

## Components & props

### `<Slider>`

Root component. Provides context to all child components.

| Prop | Type | Required | Description |
|---|---|---|---|
| `aria-label` | `string` | Yes | Accessible label for the slider region |
| `options` | `SliderOptions` | No | Slider configuration (see below) |
| `className` | `string` | No | Class forwarded to the outer `<section>` |
| `style` | `CSSProperties` | No | Style forwarded to the outer `<section>` |
| `onMounted` | `(api: SliderApi) => void` | No | Called once when the slider mounts with the imperative API |
| `onDestroy` | `() => void` | No | Called when the slider unmounts |
| `...rest` | `HTMLAttributes<HTMLElement>` | No | Forwarded to `<section>` (except `aria-label`) |

### `<SliderTrack>`

Scroll container. Renders `data-slider-scroll` (the actual scroll element) inside a hidden-overflow wrapper.

| Prop | Type | Description |
|---|---|---|
| `className` | `string` | Class on the outer overflow wrapper |
| `style` | `CSSProperties` | Style on the outer overflow wrapper |
| `scrollClassName` | `string` | Class on the inner scroll element |
| `gridClassName` | `string` | Class on each grouped page element (grid mode) |
| `cssGridRows` | `number` | Group slides into CSS grid columns of this many rows |
| `children` | `ReactNode` | `<SliderSlide>` elements |

### `<SliderSlide>`

One slide. Computes `width` from `fixedWidth` / `perPage` / `gap` options. Forwards all `HTMLDivElement` props.

| Prop | Type | Description |
|---|---|---|
| `className` | `string` | Class on the slide `<div>` |
| `style` | `CSSProperties` | Merged with computed slide styles (user styles win) |
| `children` | `ReactNode` | Slide content |

### `<SliderArrows>`

Prev/next navigation. Renders `null` when `options.arrows` is `false` and no `onPrev`/`onNext` override is provided.

| Prop | Type | Default | Description |
|---|---|---|---|
| `className` | `string` | — | Class on the wrapper `<div>` |
| `style` | `CSSProperties` | — | Style on the wrapper `<div>` |
| `prevClassName` | `string` | — | Class on the prev `<button>` |
| `nextClassName` | `string` | — | Class on the next `<button>` |
| `prevStyle` | `CSSProperties` | — | Style on the prev `<button>` |
| `nextStyle` | `CSSProperties` | — | Style on the next `<button>` |
| `prevLabel` | `string` | `'Previous slide'` | `aria-label` for the prev button |
| `nextLabel` | `string` | `'Next slide'` | `aria-label` for the next button |
| `placement` | `'default' \| 'top'` | `'default'` | Sets `data-placement`; used for CSS targeting |
| `hideOnMobile` | `boolean` | `false` | Sets `data-hide-on-mobile`; hide/show via CSS |
| `onPrev` | `() => void` | — | Override prev handler (bypasses slider state) |
| `onNext` | `() => void` | — | Override next handler (bypasses slider state) |
| `renderPrev` | `(p: { disabled: boolean; onClick: () => void }) => ReactNode` | — | Render prop for a fully custom prev button |
| `renderNext` | `(p: { disabled: boolean; onClick: () => void }) => ReactNode` | — | Render prop for a fully custom next button |

### `<SliderPagination>`

Dot indicators. Renders `null` when `options.pagination` is `false` or unset.

| Prop | Type | Description |
|---|---|---|
| `className` | `string` | Class on the pagination wrapper `<div>` |
| `style` | `CSSProperties` | Style on the pagination wrapper `<div>` |
| `dotClassName` | `string` | Class on each dot `<span>` |
| `dotStyle` | `CSSProperties` | Style on each dot `<span>` |
| `renderDot` | `(p: { index: number; current: boolean }) => ReactNode` | Render prop for a fully custom dot |

---

## `SliderOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `arrows` | `boolean` | `true` | Show/hide the default arrow buttons |
| `drag` | `boolean` | `true` | Enable drag-to-scroll (native scroll behavior) |
| `pagination` | `boolean` | `false` | Show pagination dots |
| `perPage` | `number` | `1` | Slides visible per page |
| `perMove` | `number` | `1` | Slides to advance per arrow click |
| `fixedWidth` | `string \| number` | — | Fixed slide width (e.g. `'14rem'`, `224`); overrides `perPage` |
| `fixedHeight` | `string \| number` | — | Fixed slide height |
| `gap` | `string \| number` | `0` | Gap between slides (e.g. `'1rem'`, `16`) |
| `padding` | `{ left?: string \| number; right?: string \| number } \| string \| number` | — | Scroll container padding (for peeking edges) |
| `grid` | `SliderGrid` | — | Group slides into a CSS grid |
| `mediaQuery` | `'max' \| 'min'` | `'min'` | Direction for breakpoint matching |
| `breakpoints` | `Record<number, Partial<SliderOptions>>` | — | Responsive overrides keyed by viewport width |
| `keyboard` | `boolean` | `false` | Enable arrow-key navigation |
| `type` | `'slide'` | `'slide'` | Slider mode; only `'slide'` is supported |

### Responsive breakpoints example

```tsx
options={{
  perPage: 1,
  mediaQuery: 'min',
  breakpoints: {
    640: { perPage: 2 },
    1024: { perPage: 3, gap: '1.5rem' },
  },
}}
```

---

## `data-*` attribute reference

| Attribute | Element | Values | Purpose |
|---|---|---|---|
| `data-slider-arrows` | Arrows wrapper `<div>` | `""` | CSS hook for the arrows container |
| `data-placement` | Arrows wrapper `<div>` | `'default' \| 'top'` | Placement variant for CSS |
| `data-hide-on-mobile` | Arrows wrapper `<div>` | `'true' \| 'false'` | Hide arrows on mobile via CSS |
| `data-direction` | Prev/next `<button>` | `'prev' \| 'next'` | CSS hook for individual arrow buttons |
| `data-disabled` | Prev/next `<button>` | `'true' \| 'false'` | Disabled state for CSS styling |
| `data-slider-pagination` | Pagination wrapper `<div>` | `""` | CSS hook for the dots container |
| `data-slider-dot` | Each dot `<span>` | `""` | CSS hook for individual dot |
| `data-current` | Each dot `<span>` | `'true' \| 'false'` | Active/inactive dot state |
| `data-slider-scroll` | Inner scroll `<div>` | `""` | CSS hook for the scroll element |
| `data-carousel-page` | Each page/slide `<div>` | `'true'` | Used internally for scroll-snap targeting |

---

## Imperative API

`onMounted` receives a `SliderApi` object after the slider mounts:

```tsx
import type { SliderApi } from 'light-splide-slide';

<Slider
  aria-label="Imperative example"
  options={{ perPage: 1 }}
  onMounted={(api: SliderApi) => {
    // navigate programmatically
    api.go('+1');   // next slide
    api.go('-1');   // prev slide
    api.go(2);      // go to index 2
    api.go('>');    // last slide
    api.go('<');    // first slide

    // listen to slide changes
    const unsubscribe = api.on('moved', (newIndex) => {
      console.log('slide changed to', newIndex);
    });

    // read current index
    console.log(api.index);

    // unsubscribe manually if needed
    unsubscribe();

    // destroy is called automatically on unmount
  }}
>
  ...
</Slider>
```

### `SliderApi`

| Member | Type | Description |
|---|---|---|
| `go` | `(control: SliderControl) => void` | Navigate to a slide |
| `on` | `(event: 'moved', callback: (newIndex: number) => void) => () => void` | Subscribe to slide changes; returns an unsubscribe function |
| `index` | `number` | Current slide index (getter) |
| `destroy` | `() => void` | Remove all listeners; called automatically on unmount |

### `SliderControl` values

| Value | Meaning |
|---|---|
| `number` or `"${number}"` | Go to absolute index |
| `'+${number}'` | Advance by N slides |
| `'-${number}'` | Go back by N slides |
| `'>'` | Go to last slide |
| `'<'` | Go to first slide |
| `'next'` / `'prev'` | Forward/backward one `perMove` step |

---

## Custom build with `useSlider`

If you want a fully custom shell (no `<Slider>`) you can drive the hook directly:

```tsx
import { useSlider, SliderContext } from 'light-splide-slide';
import { useState } from 'react';

function CustomShell({ children }: { children: React.ReactNode }) {
  const [pageCount, setPageCount] = useState(0);
  const ctx = useSlider({
    options: { perPage: 2, gap: '1rem' },
    pageCount,
    setPageCount,
  });

  return (
    <SliderContext.Provider value={ctx}>
      <div style={{ position: 'relative' }} aria-label="Custom slider" role="region">
        {children}
      </div>
    </SliderContext.Provider>
  );
}
```

`useSlider` params:

| Param | Type | Description |
|---|---|---|
| `options` | `SliderOptions` | Slider configuration |
| `pageCount` | `number` | Number of pages (provided by `<SliderTrack>`) |
| `setPageCount` | `(n: number) => void` | Setter for `pageCount` (from `useState`) |
| `onMounted` | `(api: SliderApi) => void` | Optional imperative API callback |
| `onDestroy` | `() => void` | Optional cleanup callback |

`useSlider` returns a `SliderContextValue` which matches exactly what `SliderContext.Provider` expects.

---

## SSR notes

- **No `window`/`document` during render.** `useSlider` resolves viewport width via `useSyncExternalStore` with a `getServerSnapshot` that returns `0`, so breakpoints start at their narrowest breakpoint on the server and hydrate on the client.
- **`use client` directive.** All components and the hook are marked `'use client'` because they use React state and effects. In a Next.js app, wrap the slider in a client component boundary:

```tsx
// app/page.tsx  (Server Component)
import { MySlider } from './MySlider'; // MySlider.tsx is 'use client'

export default function Page() {
  return <MySlider />;
}
```

---

## License

MIT
