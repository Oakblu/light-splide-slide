// Deterministic demo data — no Date.now()/Math.random()/window so server and
// first-client render produce identical markup (no hydration mismatch).
export type Item = { id: number; label: string; hue: number };

export const items: Item[] = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  label: `Slide ${i + 1}`,
  hue: (i * 36) % 360,
}));
