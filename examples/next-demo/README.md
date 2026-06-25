# light-splide-slide — Next.js demo

A standalone Next.js 15 app that exercises the slider straight from source, in a
single project that hosts **both** routers:

- **App Router** at `/` — `app/page.tsx` is a Server Component that renders the
  slider inside a `'use client'` boundary (`components/Demos.tsx`).
- **Pages Router** at `/pages-router` — classic SSR (`getServerSideProps`) that
  renders the **same** `<Demos />` component.

Both render identical server and first-client markup, so there are **no
hydration warnings**.

## Run it

```bash
cd examples/next-demo
pnpm install   # or npm install / yarn
pnpm dev       # http://localhost:3000
```

Production build:

```bash
pnpm build && pnpm start
```

## What it shows

1. **Baseline theme** — the optional `light-splide-slide/styles.css`, arrows + dot pagination.
2. **Responsive `perPage`** — 3-up on desktop, 1-up under 640px via `breakpoints`, arrows styled purely through `className`.
3. **Grid pages** — `grid.dimensions = [[2, 3]]` (2 rows × 3 columns per page).
4. **Fully custom controls** — built-in arrows off; navigation built from `useSliderContext()`.

## Why it is SSR-safe (no hydration mismatch)

- Every component and the `useSlider` hook are marked `'use client'`, so they run
  in a client boundary while the surrounding `app/page.tsx` stays a Server
  Component.
- `useSlider` resolves viewport width via `useSyncExternalStore` with a
  `getServerSnapshot` that returns `null`. On the server and during the first
  client paint, no `breakpoints` overrides are applied — the slider renders the
  base `options`. Server and first-client markup are therefore byte-for-byte
  identical; breakpoints kick in only after hydration.
- The demo content is fully deterministic (no `Date.now()`, `Math.random()`, or
  `window`/`document` reads during render), so the example adds no mismatch of
  its own.

## How the import works

`next.config.mjs` aliases `light-splide-slide` → `../../src/index.ts` and
`light-splide-slide/styles.css` → `../../src/styles.css`, with
`experimental.externalDir` so Next's SWC compiler transpiles the out-of-root TS
source. In a real project you would instead `pnpm add light-splide-slide` and
import the exact same specifiers — the demo code is identical to real consumer
code.

> Global CSS is imported from `app/layout.tsx` (App Router) and `pages/_app.tsx`
> (Pages Router) — Next only allows global stylesheet imports from those
> entry points.
