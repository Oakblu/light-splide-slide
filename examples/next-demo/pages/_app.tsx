import type { AppProps } from 'next/app';
// In the Pages Router, global stylesheets may ONLY be imported from _app.
// Both the library's baseline theme and the demo's own CSS are global.
import 'light-splide-slide/styles.css';
import '../app/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
