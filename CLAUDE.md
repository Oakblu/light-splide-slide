# CLAUDE.md — light-splide-slide

Headless, SSR-safe React slider on native scroll-snap.

## Architecture (strict dependency direction: presentation -> controller -> core)

- `src/core/` — pure, DOM-free option/geometry math. No React. ~100% unit-tested in node.
- `src/use-slider.ts` — the single controller hook: state, prop-getters, imperative API,
  SSR-safe responsive resolution via `useSyncExternalStore` + `getServerSnapshot`.
- `src/components/` — thin, side-effect-free-during-render components consuming the
  controller via `src/slider-context.ts`. Structural inline styles only; forward
  `className`/`style`/`...rest`; emit `data-*` state. No colors in JS.

## Rules

- TDD-first: failing test -> minimal impl -> pass -> commit. No exceptions.
- **No `any`, no `unknown`, no type assertions** (`as`, `<T>x`) — except `as const` — and no
  non-null assertions (`!`), in source AND tests. Use type annotations, user-defined type
  guards, `satisfies`, ISP-narrowed parameter types, and the typed `querySelector<T>()` form
  instead. Biome errors on `noExplicitAny`/`noNonNullAssertion`; the `as`/`unknown` ban is
  enforced in review.
- Coverage gate >=99% (lines/statements/functions/branches), enforced in `vitest.config.ts`.
- Pure logic -> `*.test.ts` (node). DOM/geometry -> `*.browser.test.tsx` (Vitest Browser Mode, Chromium).
- Headless contract: any styling system must work (Tailwind, CSS Modules, styled-components,
  vanilla CSS, inline). Never hard-code colors or require Tailwind.
- SSR: never read `window`/`document` during render.

## Commands

- `pnpm test` / `pnpm test:cov` — run tests / with coverage gate
- `pnpm typecheck` — tsc --noEmit
- `pnpm build` — tsup (ESM+CJS+d.ts) + copy styles.css
- `pnpm check` — lint + typecheck + test:cov (CI + prepublish gate)
- `pnpm release:patch|minor|major` — check + build + npm version + publish + push tags

## Local lint/format gotcha

`pnpm lint` and `pnpm format` may be hijacked by an RTK proxy that runs eslint instead of
Biome. Use the binary directly for reliable results:

```bash
./node_modules/.bin/biome check .
./node_modules/.bin/biome check --write <file>
```

CI runs `pnpm lint` against the real script and is not affected by the RTK proxy.
