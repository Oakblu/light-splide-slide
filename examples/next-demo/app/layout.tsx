import type { Metadata } from 'next';
import type { ReactNode } from 'react';
// Global stylesheets — only valid in the App Router root layout (and pages/_app
// for the Pages Router). The library's optional baseline theme is plain global
// CSS, so it is imported here rather than inside a component.
import 'light-splide-slide/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'light-splide-slide — Next.js demo',
  description: 'Headless, SSR-safe React slider running under the Next.js App + Pages Router.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
