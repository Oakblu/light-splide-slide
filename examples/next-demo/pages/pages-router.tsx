import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { Demos } from '../components/Demos';

// getServerSideProps forces this route to be server-rendered on every request
// (opting out of static optimization), making the SSR path explicit. The same
// <Demos /> client component used by the App Router hydrates here without a
// mismatch.
export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} };
};

export default function PagesRouterDemo() {
  return (
    <main className="page">
      <header className="page__header">
        <h1>light-splide-slide</h1>
        <p>Headless, SSR-safe React slider — Next.js Pages Router (this page).</p>
        <nav className="router-switch">
          <Link href="/">← App Router</Link>
          <span>·</span>
          <strong>Pages Router</strong>
        </nav>
      </header>
      <Demos />
    </main>
  );
}
