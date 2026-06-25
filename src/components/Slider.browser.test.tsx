import { render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Slider } from './Slider';
import { SliderSlide } from './SliderSlide';
import { SliderTrack } from './SliderTrack';

it('renders a labelled section and forwards className/style', () => {
  const { container } = render(
    <Slider aria-label="demo" className="my-slider" style={{ background: 'red' }}>
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
        <SliderSlide>b</SliderSlide>
      </SliderTrack>
    </Slider>
  );
  const section = container.querySelector<HTMLElement>('section');
  expect(section?.getAttribute('aria-label')).toBe('demo');
  expect(section?.className).toContain('my-slider');
  expect(section?.style.background).toBe('red');
});

it('marks pages with data-carousel-page', () => {
  const { container } = render(
    <Slider aria-label="demo">
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
        <SliderSlide>b</SliderSlide>
        <SliderSlide>c</SliderSlide>
      </SliderTrack>
    </Slider>
  );
  expect(container.querySelectorAll('[data-carousel-page="true"]')).toHaveLength(3);
});

it('forwards scrollClassName to the scroll container', () => {
  const { container } = render(
    <Slider aria-label="demo">
      <SliderTrack scrollClassName="scroller">
        <SliderSlide>a</SliderSlide>
      </SliderTrack>
    </Slider>
  );
  expect(container.querySelector('.scroller')).toBeTruthy();
});

it('section has position: relative', () => {
  const { container } = render(
    <Slider aria-label="test">
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
      </SliderTrack>
    </Slider>
  );
  const section = container.querySelector<HTMLElement>('section');
  if (!section) throw new Error('section not found');
  expect(section.style.position).toBe('relative');
});

it('breakpoint overrides slide width: SliderRuntime must re-inject responsive options', async () => {
  // max-width: 99999px always matches → breakpoint perPage=2 overrides base perPage=4.
  // If Slider only injects base options (null viewport), slides stay at 25% (perPage=4).
  // After the fix, SliderRuntime re-injects resolvedOptions and slides are 50% (perPage=2).
  const { container } = render(
    <div style={{ width: '400px' }}>
      <Slider
        aria-label="bp"
        options={{ perPage: 4, gap: 0, breakpoints: { 99999: { perPage: 2 } } }}
      >
        <SliderTrack>
          <SliderSlide>a</SliderSlide>
          <SliderSlide>b</SliderSlide>
          <SliderSlide>c</SliderSlide>
          <SliderSlide>d</SliderSlide>
        </SliderTrack>
      </Slider>
    </div>
  );
  const slide = container.querySelector<HTMLElement>('[data-carousel-page]');
  if (!slide) throw new Error('no slide');
  // perPage=2 → each slide fills 50% of the 400px container → ≈200px
  // perPage=4 (bug: base injected, never updated) → 25% → ≈100px
  await vi.waitFor(() => {
    expect(slide.getBoundingClientRect().width).toBeGreaterThan(150);
  });
});

it('user style merges into section alongside position: relative', () => {
  const { container } = render(
    <Slider aria-label="test" style={{ color: 'blue', padding: '10px' }}>
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
      </SliderTrack>
    </Slider>
  );
  const section = container.querySelector<HTMLElement>('section');
  if (!section) throw new Error('section not found');
  expect(section.style.position).toBe('relative');
  expect(section.style.color).toBe('blue');
  expect(section.style.padding).toBe('10px');
});
