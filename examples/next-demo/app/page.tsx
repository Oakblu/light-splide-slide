import Link from 'next/link';
// app/page.tsx is a Server Component. <Demos /> is the 'use client' boundary —
// the canonical React Server Components pattern. The server renders the slider's
// base-options markup; the client hydrates it without a mismatch.
import { Demos } from '../components/Demos';

export default function Page() {
  return (
    <main className="page">
      <header className="page__header">
        <h1>light-splide-slide</h1>
        <p>Headless, SSR-safe React slider — Next.js App Router (this page).</p>
        <nav className="router-switch">
          <strong>App Router</strong>
          <span>·</span>
          <Link href="/pages-router">Pages Router →</Link>
        </nav>
      </header>
      <Demos />
    </main>
  );
}
