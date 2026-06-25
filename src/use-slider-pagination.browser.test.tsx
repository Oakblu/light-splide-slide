import { render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Slider } from './components/Slider';
import { SliderPagination } from './components/SliderPagination';
import { SliderSlide } from './components/SliderSlide';
import { SliderTrack } from './components/SliderTrack';
import type { SliderApi, SliderContextValue } from './types';
import { useSlider } from './use-slider';

// Regression tests for the fixed-width pagination bug: with slides narrower than
// the viewport, only some snap positions are reachable, so the dot count and the
// active dot must reflect REACHABLE positions, not the raw slide count.
function renderFixed(containerWidth: number, slideWidth: string, count: number) {
  return render(
    <div style={{ width: `${containerWidth}px` }}>
      <Slider aria-label="fw" options={{ fixedWidth: slideWidth, gap: 0, pagination: true }}>
        <SliderTrack>
          {Array.from({ length: count }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed test fixture with stable ordering
            <SliderSlide key={`s-${i}`}>{i}</SliderSlide>
          ))}
        </SliderTrack>
        <SliderPagination />
      </Slider>
    </div>
  );
}

it('renders ceil(slideCount/perMove) dots when perPage=perMove > 1', async () => {
  // 8 slides, perPage=3, perMove=3 → 3 pages: [0-2], [3-5], [6-7]
  // reachableCount=6 (slides 0-5 fit in scroll), but pagination should reflect
  // logical pages (ceil(8/3)=3), not ceil(reachable/perMove)=2.
  const { container } = render(
    <div style={{ width: '300px' }}>
      <Slider aria-label="perpage" options={{ perPage: 3, perMove: 3, gap: 0, pagination: true }}>
        <SliderTrack>
          {Array.from({ length: 8 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed test fixture with stable ordering
            <SliderSlide key={`s-${i}`}>{i}</SliderSlide>
          ))}
        </SliderTrack>
        <SliderPagination />
      </Slider>
    </div>
  );
  await vi.waitFor(() => {
    expect(container.querySelectorAll('[data-slider-dot]')).toHaveLength(3);
  });
});

it('renders one dot per REACHABLE snap position, not per slide', async () => {
  // 5 slides x 200px = 1000 scrollWidth; 500 viewport => maxScrollLeft 500.
  // Offsets 0,200,400,600,800 — reachable (<=500): 0,200,400 => 3 positions.
  const { container } = renderFixed(500, '200px', 5);
  await vi.waitFor(() => {
    expect(container.querySelectorAll('[data-slider-dot]')).toHaveLength(3);
  });
});

it('activates the last dot once scrolled to the end', async () => {
  const { container } = renderFixed(500, '200px', 5);
  const scroll = container.querySelector<HTMLElement>('[data-slider-scroll]');
  if (!scroll) {
    throw new Error('scroll container not found');
  }
  scroll.scrollLeft = scroll.scrollWidth - scroll.clientWidth;
  await vi.waitFor(() => {
    const dots = [...container.querySelectorAll('[data-slider-dot]')];
    expect(dots).toHaveLength(3);
    const active = dots.findIndex((d) => d.getAttribute('data-current') === 'true');
    expect(active).toBe(2);
  });
});

it('navigating to the last reachable page scrolls flush to the end', async () => {
  const api: { current: SliderApi | null } = { current: null };
  const { container } = render(
    <div style={{ width: '500px' }}>
      <Slider
        aria-label="flush"
        options={{ fixedWidth: '200px', gap: 0 }}
        onMounted={(a) => {
          api.current = a;
        }}
      >
        <SliderTrack>
          {Array.from({ length: 5 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed test fixture with stable ordering
            <SliderSlide key={`f-${i}`}>{i}</SliderSlide>
          ))}
        </SliderTrack>
      </Slider>
    </div>
  );
  const scroll = container.querySelector<HTMLElement>('[data-slider-scroll]');
  if (!scroll) {
    throw new Error('no scroll');
  }
  await vi.waitFor(() => expect(api.current).not.toBeNull());
  // 5 x 200 = 1000 content, 500 viewport => maxScrollLeft 500.
  // go past the end -> clamps to the last reachable page -> flush to maxScrollLeft,
  // not to the last reachable slide's start (which would cut off trailing slides).
  api.current?.go(99);
  await vi.waitFor(() => {
    const max = scroll.scrollWidth - scroll.clientWidth;
    expect(scroll.scrollLeft).toBeGreaterThanOrEqual(max - 1);
  });
});

it('a scroll that stays on the same page does not change the index', async () => {
  const captured: { ctx: SliderContextValue | null } = { ctx: null };
  function Probe() {
    const ctx = useSlider({ options: { fixedWidth: '200px', gap: 0 } });
    captured.ctx = ctx;
    return (
      <div style={{ width: '500px' }}>
        <div
          ref={ctx.registerScrollElement}
          data-slider-scroll=""
          style={{ display: 'flex', overflowX: 'auto', width: '100%' }}
        >
          {Array.from({ length: 5 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed test fixture with stable ordering
            <div key={`p-${i}`} data-carousel-page="true" style={{ flex: '0 0 200px', height: 20 }}>
              {i}
            </div>
          ))}
        </div>
      </div>
    );
  }
  const { container } = render(<Probe />);
  const scroll = container.querySelector<HTMLElement>('[data-slider-scroll]');
  if (!scroll) {
    throw new Error('no scroll');
  }
  // A few px — still nearest to page 0, so the settled index must remain 0.
  scroll.scrollLeft = 10;
  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(captured.ctx?.currentIndex).toBe(0);
});

it('a scroll with no pages present is a no-op (does not throw)', async () => {
  const captured: { ctx: SliderContextValue | null } = { ctx: null };
  function Probe() {
    const ctx = useSlider({ options: {} });
    captured.ctx = ctx;
    return (
      <div
        ref={ctx.registerScrollElement}
        data-slider-scroll=""
        style={{ display: 'flex', overflowX: 'auto', width: '100px' }}
      >
        {/* No data-carousel-page children */}
        <div style={{ flex: '0 0 400px', height: 20 }}>wide</div>
      </div>
    );
  }
  const { container } = render(<Probe />);
  const scroll = container.querySelector<HTMLElement>('[data-slider-scroll]');
  if (!scroll) {
    throw new Error('no scroll');
  }
  scroll.scrollLeft = 200;
  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(captured.ctx?.currentIndex).toBe(0);
});

it('measures reachable pages via window resize when ResizeObserver is unavailable', async () => {
  vi.stubGlobal('ResizeObserver', undefined);
  try {
    const { container } = renderFixed(500, '200px', 5);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-slider-dot]')).toHaveLength(3);
    });
  } finally {
    vi.unstubAllGlobals();
  }
});
