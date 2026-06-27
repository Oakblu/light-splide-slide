import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { readPageGeometry } from './page-geometry';

it('reads pages, offsets, reachable count and maxIndex', () => {
  const { container } = render(
    <div style={{ display: 'flex', width: 200, overflowX: 'auto' }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          data-carousel-page="true"
          style={{ flex: '0 0 200px', width: 200, height: 50 }}
        >
          {i}
        </div>
      ))}
    </div>
  );
  const el = container.firstElementChild;
  if (!(el instanceof HTMLElement)) {
    throw new Error('expected a scroll element');
  }
  const geo = readPageGeometry(el);
  expect(geo.pages.length).toBe(3);
  expect(geo.reachableCount).toBeGreaterThanOrEqual(1);
  expect(geo.maxIndex).toBe(geo.reachableCount - 1);
  expect(geo.maxScrollLeft).toBeGreaterThanOrEqual(0);
});

it('returns empty pages and reachableCount 1 when there are no page elements', () => {
  const { container } = render(<div style={{ width: 200 }} />);
  const el = container.firstElementChild;
  if (!(el instanceof HTMLElement)) {
    throw new Error('expected an element');
  }
  const geo = readPageGeometry(el);
  expect(geo.pages.length).toBe(0);
  expect(geo.reachableCount).toBe(1);
  expect(geo.maxIndex).toBe(0);
});
