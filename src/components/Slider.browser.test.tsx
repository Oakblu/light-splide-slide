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

it('injects a <style> tag with base and breakpoint CSS when breakpoints are configured', () => {
  // Two breakpoints ensure the sort comparator is exercised (needs 2+ entries).
  const { container } = render(
    <Slider
      aria-label="d"
      options={{
        perPage: 3,
        gap: '1rem',
        breakpoints: { 640: { perPage: 1 }, 950: { perPage: 2 } },
      }}
    >
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
      </SliderTrack>
    </Slider>
  );
  const styleEl = container.querySelector('style');
  const css = styleEl?.textContent ?? '';
  expect(css).toContain('[data-slider-scope=');
  expect(css).toContain('[data-carousel-page]');
  expect(css).toContain('@media');
  expect(css).toContain('max-width:640px');
  expect(css).toContain('max-width:950px');
  expect(css).toContain('/ 3)');
  expect(css).toContain('/ 1)');
  expect(css).toContain('/ 2)');
});

it('does not inject a <style> tag when no breakpoints are configured', () => {
  const { container } = render(
    <Slider aria-label="d" options={{ perPage: 3 }}>
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
      </SliderTrack>
    </Slider>
  );
  expect(container.querySelector('style')).toBeNull();
});

it('section gets data-slider-scope attribute only when breakpoints are configured', () => {
  const { container: withBP } = render(
    <Slider aria-label="d" options={{ perPage: 2, breakpoints: { 640: { perPage: 1 } } }}>
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
      </SliderTrack>
    </Slider>
  );
  expect(withBP.querySelector('section')?.hasAttribute('data-slider-scope')).toBe(true);

  const { container: noBP } = render(
    <Slider aria-label="d" options={{ perPage: 2 }}>
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
      </SliderTrack>
    </Slider>
  );
  expect(noBP.querySelector('section')?.hasAttribute('data-slider-scope')).toBe(false);
});

it('generates min-width media queries for mediaQuery: min', () => {
  // Two breakpoints exercise both the sort comparator and the a-b (ascending) branch.
  const { container } = render(
    <Slider
      aria-label="d"
      options={{
        perPage: 1,
        gap: '0.5rem',
        mediaQuery: 'min',
        breakpoints: { 768: { perPage: 3 }, 480: { perPage: 2 } },
      }}
    >
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
      </SliderTrack>
    </Slider>
  );
  const css = container.querySelector('style')?.textContent ?? '';
  expect(css).toContain('min-width:480px');
  expect(css).toContain('min-width:768px');
  expect(css).toContain('/ 2)');
  expect(css).toContain('/ 3)');
});

it('uses fixedWidth in base CSS when fixedWidth option is set', () => {
  const { container } = render(
    <Slider aria-label="d" options={{ fixedWidth: '14rem', breakpoints: { 640: { perPage: 1 } } }}>
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
      </SliderTrack>
    </Slider>
  );
  const css = container.querySelector('style')?.textContent ?? '';
  expect(css).toContain('14rem');
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
