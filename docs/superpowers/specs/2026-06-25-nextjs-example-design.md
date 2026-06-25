# Next.js example — design

Date: 2026-06-25

## Goal

Add a runnable Next.js example under `examples/next-demo` that exercises
`light-splide-slide` and proves it is SSR-ready: no hydration warnings, no flash
of mis-rendered layout, identical server and first-client markup. Demonstrate the
client-boundary pattern in **both** the App Router and the Pages Router from a
single Next.js project.

## Why it is already SSR-safe (library side)

- All components and the `useSlider` hook carry `'use client'`.
- Viewport width resolves via `useSyncExternalStore` with a `getServerSnapshot`
  that returns `null`. While width is `null` (server + first client paint before
  hydration) no `breakpoints` overrides are applied, so the slider renders the
  base `options`. After hydration it reads real `window.innerWidth` and
  re-resolves. Server and first-client markup are therefore identical.

The example must not reintroduce non-determinism: no `Date.now()`,
`Math.random()`, or `window`/`document` reads during render.

## Architecture

Single Next.js 15 app. App Router and Pages Router coexist (non-overlapping
routes), both rendering the **same** shared client component:

- `app/layout.tsx` (Server Component) — root layout, imports `globals.css`.
- `app/page.tsx` (Server Component) — `/`, renders `<Demos />` (the client
  boundary) + a link to the Pages Router route.
- `pages/pages-router.tsx` — `/pages-router`, classic SSR, renders the same
  `<Demos />` + a link back to `/`.
- `components/Demos.tsx` (`'use client'`) — ports the 4 vite demos:
  1. Baseline theme (`light-splide-slide/styles.css`, fixed-width peeking cards).
  2. Responsive `perPage` (3-up desktop, 1-up < 640px via `breakpoints`),
     arrows styled via `className`.
  3. Grid pages (`grid.dimensions = [[2, 3]]`).
  4. Fully custom headless nav via `useSliderContext()`.
- `components/Card.tsx`, `components/CustomNav.tsx` — deterministic content only.

## Library linking (no publish/build step)

Mirror the vite-demo source-alias approach so the example runs against this
repo's `src/` directly:

- `next.config.mjs`:
  - webpack alias `light-splide-slide` → `../../src/index.ts`,
    `light-splide-slide/styles.css` → `../../src/styles.css`.
  - `experimental: { externalDir: true }` so Next's SWC transpiles the
    out-of-root TS source.
  - Stay on webpack (no Turbopack) so the alias applies to both `dev` and
    `build`.

## Styling

Port `examples/vite-demo/src/app.css` → `app/globals.css`, imported once in
`app/layout.tsx`. Baseline demo additionally pulls
`light-splide-slide/styles.css`.

## Files

`package.json`, `next.config.mjs`, `tsconfig.json`, `next-env.d.ts`,
`app/{layout.tsx,page.tsx,globals.css}`, `pages/pages-router.tsx`,
`components/{Demos,Card,CustomNav}.tsx`, `README.md`.

Add `examples/next-demo` to the root `tsconfig.json` `exclude` (alongside
`examples/vite-demo`) so the library's `tsc` does not type-check the example.

## Verification

1. `pnpm install` in `examples/next-demo`.
2. `pnpm build` (`next build`) succeeds with no errors.
3. `next dev`, then a Playwright navigation to `/` and `/pages-router`; assert the
   browser console contains no hydration / React `did not match` warnings and the
   sliders render.

## Out of scope

- No unit tests for the example (examples are excluded from the library coverage
  gate). Correctness is verified by build + runtime console check.
- No Turbopack-specific config.
