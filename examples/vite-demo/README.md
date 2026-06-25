# light-splide-slide — Vite demo

A standalone Vite + React app that exercises the slider straight from source
(via a Vite alias), so you can see it working without publishing or building the
package first.

## Run it

```bash
cd examples/vite-demo
pnpm install   # or npm install / yarn
pnpm dev
```

Open the printed `http://localhost:5173`.

## What it shows

1. **Baseline theme** — the optional `light-splide-slide/styles.css`, arrows + dot pagination.
2. **Responsive `perPage`** — 3-up on desktop, 1-up under 640px via `breakpoints`, arrows styled purely through `className`.
3. **Grid pages** — `grid.dimensions = [[2, 3]]` (2 rows × 3 columns per page).
4. **Fully custom controls** — built-in arrows off; navigation built from `useSliderContext()`.

## How the import works

`vite.config.ts` aliases `light-splide-slide` → `../../src/index.ts` and
`light-splide-slide/styles.css` → `../../src/styles.css`. In a real project you
would instead `pnpm add light-splide-slide` and import the same way — the demo
code is identical to real consumer code.
