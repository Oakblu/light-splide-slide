import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Slider } from './Slider';
import { SliderSlide } from './SliderSlide';
import { SliderTrack } from './SliderTrack';

it('renders plain div without a Slider context', () => {
  const { container } = render(<SliderSlide className="solo">x</SliderSlide>);
  expect(container.querySelector('.solo')?.textContent).toBe('x');
});

it('applies fixedWidth', () => {
  const { container } = render(
    <Slider aria-label="d" options={{ fixedWidth: '10rem' }}>
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
      </SliderTrack>
    </Slider>
  );
  const page = container.querySelector<HTMLElement>('[data-carousel-page="true"]');
  expect(page?.style.width).toBe('10rem');
});

it('forwards className and style', () => {
  const { container } = render(
    <Slider aria-label="d">
      <SliderTrack>
        <SliderSlide className="slide" style={{ color: 'rgb(0, 128, 0)' }}>
          a
        </SliderSlide>
      </SliderTrack>
    </Slider>
  );
  const el = container.querySelector<HTMLElement>('.slide');
  expect(el?.style.color).toBe('rgb(0, 128, 0)');
});

it('uses calc width when perPage > 1 (no fixedWidth)', () => {
  const { container } = render(
    <Slider aria-label="d" options={{ perPage: 3 }}>
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
        <SliderSlide>b</SliderSlide>
        <SliderSlide>c</SliderSlide>
      </SliderTrack>
    </Slider>
  );
  const slide = container.querySelector<HTMLElement>('[data-carousel-page="true"]');
  // width should be calc-based (not a plain px/rem value)
  expect(slide?.style.width).toContain('calc(');
});

it('uses calc width with default perPage (no perPage option set)', () => {
  // exercises the `perPage ?? 1` fallback on SliderSlide line 22
  const { container } = render(
    <Slider aria-label="d" options={{}}>
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
      </SliderTrack>
    </Slider>
  );
  const slide = container.querySelector<HTMLElement>('[data-carousel-page="true"]');
  // perPage defaults to 1 → calc((100% - (0px * 0)) / 1)
  expect(slide?.style.width).toContain('calc(');
});

it('applies all base structural styles within a slider context', () => {
  const { container } = render(
    <Slider aria-label="d">
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
      </SliderTrack>
    </Slider>
  );
  const slide = container.querySelector<HTMLElement>('[data-carousel-page="true"]');
  if (!slide) throw new Error('slide not found');
  expect(slide.style.minWidth).toBe('0px');
  expect(slide.style.flexShrink).toBe('0');
  expect(slide.style.scrollSnapAlign).toBe('start');
});

it('skips inline width when a CSS scope id is injected (breakpoints case)', () => {
  // When Slider has breakpoints it injects __cssId so CSS media queries drive width.
  // Inline width must be absent or the media queries can never override it.
  const { container } = render(
    <Slider aria-label="d" options={{ perPage: 3, breakpoints: { 9999: { perPage: 1 } } }}>
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
      </SliderTrack>
    </Slider>
  );
  const slide = container.querySelector<HTMLElement>('[data-carousel-page="true"]');
  expect(slide?.style.width).toBe('');
});

it('still sets structural styles (minWidth, flexShrink, scrollSnapAlign) when __cssId is present', () => {
  const { container } = render(
    <Slider aria-label="d" options={{ perPage: 3, breakpoints: { 9999: { perPage: 1 } } }}>
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
      </SliderTrack>
    </Slider>
  );
  const slide = container.querySelector<HTMLElement>('[data-carousel-page="true"]');
  if (!slide) throw new Error('slide not found');
  expect(slide.style.minWidth).toBe('0px');
  expect(slide.style.flexShrink).toBe('0');
  expect(slide.style.scrollSnapAlign).toBe('start');
});

it('user style prop overrides base styles and additional props are merged', () => {
  const { container } = render(
    <Slider aria-label="d">
      <SliderTrack>
        <SliderSlide style={{ scrollSnapAlign: 'end', color: 'blue' }}>a</SliderSlide>
      </SliderTrack>
    </Slider>
  );
  const slide = container.querySelector<HTMLElement>('[data-carousel-page="true"]');
  if (!slide) throw new Error('slide not found');
  // user override wins
  expect(slide.style.scrollSnapAlign).toBe('end');
  expect(slide.style.color).toBe('blue');
  // base styles that were not overridden are still present
  expect(slide.style.minWidth).toBe('0px');
  expect(slide.style.flexShrink).toBe('0');
});
