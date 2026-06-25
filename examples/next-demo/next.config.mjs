import { fileURLToPath } from 'node:url';

// Resolve the library straight from source (like examples/vite-demo) so the demo
// runs with no build/publish step. `externalDir` lets Next's SWC compiler
// transpile the out-of-root TS source under ../../src. In a real app you would
// instead `pnpm add light-splide-slide` and import the exact same specifiers.
const fromHere = (path) => fileURLToPath(new URL(path, import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // This demo has its own lockfile but lives inside the library repo; pin the
  // tracing root to silence Next's multi-lockfile workspace-root warning.
  outputFileTracingRoot: fromHere('.'),
  experimental: {
    externalDir: true,
  },
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      'light-splide-slide/styles.css': fromHere('../../src/styles.css'),
      'light-splide-slide': fromHere('../../src/index.ts'),
    };
    // The library is aliased to out-of-root source, so its bare `react` import
    // would otherwise resolve to the repo-root node_modules — a SECOND React
    // copy, which breaks hooks ("Invalid hook call"). Scope a react/react-dom
    // alias to ONLY the library source files (a global alias would also rewrite
    // React inside Next's own RSC/devtools layers and break them). A real
    // consumer installing from npm gets this dedupe for free.
    config.module.rules.push({
      test: /\.tsx?$/,
      include: [fromHere('../../src')],
      resolve: {
        alias: {
          react: fromHere('./node_modules/react'),
          'react-dom': fromHere('./node_modules/react-dom'),
        },
      },
    });
    return config;
  },
};

export default nextConfig;
