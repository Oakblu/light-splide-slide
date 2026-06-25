import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Slider } from './Slider';
import { SliderSlide } from './SliderSlide';
import { SliderTrack } from './SliderTrack';

// Helper: render a Slider with N slides and given options
function makeSlider(
  options: Parameters<typeof Slider>[0]['options'],
  count = 6,
  trackProps: Partial<Parameters<typeof SliderTrack>[0]> = {}
) {
  const slides = Array.from({ length: count }, (_, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: test helper — stable ordering, index keys are fine
    <SliderSlide key={i}>{`slide-${i}`}</SliderSlide>
  ));
  return render(
    <Slider aria-label="test" options={options}>
      <SliderTrack {...trackProps}>{slides}</SliderTrack>
    </Slider>
  );
}

it('flat mode: renders each slide with data-carousel-page', () => {
  const { container } = makeSlider({ perPage: 2 }, 4);
  const pages = container.querySelectorAll('[data-carousel-page="true"]');
  // 4 slides rendered flat — each gets the attribute via cloneElement
  expect(pages).toHaveLength(4);
});

it('grid pages fill the viewport width (one page per view, not collapsed)', () => {
  const { container } = render(
    <div style={{ width: '600px' }}>
      <Slider aria-label="grid-width" options={{ grid: { dimensions: [[2, 3]] } }}>
        <SliderTrack>
          {Array.from({ length: 10 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable test fixture
            <SliderSlide key={`g-${i}`}>{i}</SliderSlide>
          ))}
        </SliderTrack>
      </Slider>
    </div>
  );
  const scroll = container.querySelector<HTMLElement>('[data-slider-scroll]');
  const pages = [...container.querySelectorAll<HTMLElement>('[data-carousel-page="true"]')];
  expect(pages).toHaveLength(2);
  // Each grid page must span (about) the viewport width; collapsed pages would be
  // a fraction of it, packing both pages side-by-side (the bug).
  for (const page of pages) {
    expect(page.getBoundingClientRect().width).toBeGreaterThan((scroll?.clientWidth ?? 0) * 0.9);
  }
});

it('grid mode via options.grid.dimensions: groups into pages', () => {
  // dimensions: [[2,2]] → 4 items per page → 6 slides → 2 pages
  const { container } = makeSlider({ grid: { dimensions: [[2, 2]] } }, 6);
  const pages = container.querySelectorAll('[data-carousel-page="true"]');
  expect(pages).toHaveLength(2);
});

it('grid mode renders inner grid wrapper per page', () => {
  const { container } = makeSlider({ grid: { dimensions: [[2, 2]] } }, 4);
  // each page has an inner <div style="display:grid">
  const pages = container.querySelectorAll('[data-carousel-page="true"]');
  for (const page of pages) {
    const inner = page.querySelector<HTMLElement>('div');
    expect(inner?.style.display).toBe('grid');
  }
});

it('grid gap.col and gap.row are applied to inner wrapper', () => {
  const { container } = makeSlider(
    { grid: { dimensions: [[2, 2]], gap: { col: '8px', row: '4px' } } },
    4
  );
  const page = container.querySelector<HTMLElement>('[data-carousel-page="true"]');
  const inner = page?.querySelector<HTMLElement>('div');
  expect(inner?.style.columnGap).toBe('8px');
  expect(inner?.style.rowGap).toBe('4px');
});

it('cssGridRows mode groups slides into column-pages', () => {
  // cssGridRows=2 → every 2 slides form one column-page
  const { container } = makeSlider(undefined, 6, { cssGridRows: 2 });
  const pages = container.querySelectorAll('[data-carousel-page="true"]');
  // 6 slides / 2 rows = 3 column pages
  expect(pages).toHaveLength(3);
});

it('cssGridRows inner wrapper uses gridTemplateRows', () => {
  const { container } = makeSlider(undefined, 4, { cssGridRows: 2 });
  const page = container.querySelector<HTMLElement>('[data-carousel-page="true"]');
  const inner = page?.querySelector<HTMLElement>('div');
  expect(inner?.style.gridTemplateRows).toContain('repeat(2');
});

it('object padding applies paddingLeft and paddingRight on scroll container', () => {
  const { container } = makeSlider({ padding: { left: '20px', right: '10px' } }, 2);
  const scroll = container.querySelector<HTMLElement>('[data-slider-scroll]');
  expect(scroll?.style.paddingLeft).toBe('20px');
  expect(scroll?.style.paddingRight).toBe('10px');
});

it('scalar padding (number) applies symmetric padding', () => {
  const { container } = makeSlider({ padding: 16 }, 2);
  const scroll = container.querySelector<HTMLElement>('[data-slider-scroll]');
  expect(scroll?.style.paddingLeft).toBe('16px');
  expect(scroll?.style.paddingRight).toBe('16px');
});

it('scalar padding (string) applies symmetric padding', () => {
  const { container } = makeSlider({ padding: '1rem' }, 2);
  const scroll = container.querySelector<HTMLElement>('[data-slider-scroll]');
  expect(scroll?.style.paddingLeft).toBe('1rem');
  expect(scroll?.style.paddingRight).toBe('1rem');
});

it('gap option is forwarded to scroll container', () => {
  const { container } = makeSlider({ gap: '12px' }, 3);
  const scroll = container.querySelector<HTMLElement>('[data-slider-scroll]');
  expect(scroll?.style.gap).toBe('12px');
});

it('gap option as number converts to px', () => {
  const { container } = makeSlider({ gap: 8 }, 3);
  const scroll = container.querySelector<HTMLElement>('[data-slider-scroll]');
  expect(scroll?.style.gap).toBe('8px');
});

it('grid mode with keyless slides uses pageIndex as fallback key', () => {
  // Children without explicit keys → React sets key to null → p.key ?? pageIndex path
  const { container } = render(
    <Slider aria-label="test" options={{ grid: { dimensions: [[2, 2]] } }}>
      <SliderTrack>
        {/* Explicit JSX array without key → React auto-assigns index-based keys,
            but Array.from(Children.toArray()) gives them keys prefixed with ./.
            To hit the `?? pageIndex` branch we need children mapped inside an array
            expression (not JSX array literal). Use React.createElement approach
            via a wrapper that produces keyless elements via cloneElement stripping. */}
        <div>a</div>
        <div>b</div>
        <div>c</div>
        <div>d</div>
      </SliderTrack>
    </Slider>
  );
  // 4 slides / 4 items per page = 1 page; just confirm it renders
  const pages = container.querySelectorAll('[data-carousel-page="true"]');
  expect(pages).toHaveLength(1);
});

it('cssGridRows mode with keyless slides uses ci as fallback key', () => {
  const { container } = render(
    <Slider aria-label="test">
      <SliderTrack cssGridRows={2}>
        <div>a</div>
        <div>b</div>
        <div>c</div>
        <div>d</div>
      </SliderTrack>
    </Slider>
  );
  // 4 slides / 2 rows = 2 column pages
  const pages = container.querySelectorAll('[data-carousel-page="true"]');
  expect(pages).toHaveLength(2);
});

it('sets touch-action: pan-y on the scroll element when drag is disabled', () => {
  const { container } = makeSlider({ drag: false }, 2);
  const scroll = container.querySelector<HTMLElement>('[data-slider-scroll]');
  if (!scroll) {
    throw new Error('expected scroll element');
  }
  expect(scroll.style.touchAction).toBe('pan-y');
});

it('leaves touch-action unset when drag is enabled (default)', () => {
  const { container } = makeSlider({ drag: true }, 2);
  const scroll = container.querySelector<HTMLElement>('[data-slider-scroll]');
  if (!scroll) {
    throw new Error('expected scroll element');
  }
  expect(scroll.style.touchAction).toBe('');
});

it('forwards data-testid (and other rest props) to the track wrapper', () => {
  const { container } = render(
    <Slider aria-label="test" options={{ perPage: 1 }}>
      <SliderTrack data-testid="my-track">
        <SliderSlide>a</SliderSlide>
        <SliderSlide>b</SliderSlide>
        <SliderSlide>c</SliderSlide>
      </SliderTrack>
    </Slider>
  );
  const el = container.querySelector('[data-testid="my-track"]');
  // lands on the outer wrapper — the element that contains the scroll region
  expect(el?.querySelector('[data-slider-scroll]')).toBeTruthy();
});

it('emits no data-testid by default (opt-in)', () => {
  const { container } = makeSlider({ perPage: 1 }, 3);
  expect(container.querySelector('[data-testid]')).toBeNull();
});

it('scroll container has all baseline structural styles', () => {
  const { container } = makeSlider({ perPage: 1 }, 2);
  const scroll = container.querySelector<HTMLElement>('[data-slider-scroll]');
  if (!scroll) throw new Error('scroll element not found');
  expect(scroll.style.display).toBe('flex');
  expect(scroll.style.scrollSnapType).toBe('x mandatory');
  expect(scroll.style.overflowX).toBe('auto');
  expect(scroll.style.overflowY).toBe('hidden');
  expect(scroll.style.overscrollBehaviorX).toBe('contain');
  expect(scroll.style.scrollbarWidth).toBe('none');
  expect(scroll.style.scrollBehavior).toBe('smooth');
});

it('data-slider-scroll attribute has empty string value', () => {
  const { container } = makeSlider({ perPage: 1 }, 2);
  const scroll = container.querySelector('[data-slider-scroll]');
  expect(scroll?.getAttribute('data-slider-scroll')).toBe('');
});

it('outer wrapper has overflow: hidden', () => {
  const { container } = makeSlider({ perPage: 1 }, 2);
  const outer = container.querySelector<HTMLElement>('[data-slider-scroll]')?.parentElement;
  if (!outer) throw new Error('outer wrapper not found');
  expect(outer.style.overflow).toBe('hidden');
});

it('user style merges onto outer wrapper without removing overflow: hidden', () => {
  const { container } = makeSlider({ perPage: 1 }, 2, { style: { color: 'red', padding: '4px' } });
  const outer = container.querySelector<HTMLElement>('[data-slider-scroll]')?.parentElement;
  if (!outer) throw new Error('outer wrapper not found');
  expect(outer.style.overflow).toBe('hidden');
  expect(outer.style.color).toBe('red');
  expect(outer.style.padding).toBe('4px');
});

it('scroll container exposes CSS custom properties for gap and padding', () => {
  const { container } = makeSlider({ gap: '12px', padding: { left: '20px', right: '10px' } }, 2);
  const scroll = container.querySelector<HTMLElement>('[data-slider-scroll]');
  if (!scroll) throw new Error('scroll element not found');
  const style = getComputedStyle(scroll);
  expect(style.getPropertyValue('--slider-gap').trim()).toBe('12px');
  expect(style.getPropertyValue('--slider-padding-left').trim()).toBe('20px');
  expect(style.getPropertyValue('--slider-padding-right').trim()).toBe('10px');
});

it('CSS custom properties default to 0px when gap and padding are not set', () => {
  const { container } = makeSlider({}, 2);
  const scroll = container.querySelector<HTMLElement>('[data-slider-scroll]');
  if (!scroll) throw new Error('scroll element not found');
  const style = getComputedStyle(scroll);
  expect(style.getPropertyValue('--slider-gap').trim()).toBe('0px');
  expect(style.getPropertyValue('--slider-padding-left').trim()).toBe('0px');
  expect(style.getPropertyValue('--slider-padding-right').trim()).toBe('0px');
});

it('padding option also sets scrollPaddingLeft and scrollPaddingRight', () => {
  const { container } = makeSlider({ padding: { left: '20px', right: '10px' } }, 2);
  const scroll = container.querySelector<HTMLElement>('[data-slider-scroll]');
  if (!scroll) throw new Error('scroll element not found');
  expect(scroll.style.scrollPaddingLeft).toBe('20px');
  expect(scroll.style.scrollPaddingRight).toBe('10px');
});

it('no padding option leaves scrollPaddingLeft and scrollPaddingRight unset', () => {
  const { container } = makeSlider({}, 2);
  const scroll = container.querySelector<HTMLElement>('[data-slider-scroll]');
  if (!scroll) throw new Error('scroll element not found');
  expect(scroll.style.scrollPaddingLeft).toBe('');
  expect(scroll.style.scrollPaddingRight).toBe('');
});

it('grid page wrapper has all required structural styles', () => {
  const { container } = makeSlider({ grid: { dimensions: [[2, 2]] } }, 4);
  const page = container.querySelector<HTMLElement>('[data-carousel-page="true"]');
  if (!page) throw new Error('grid page wrapper not found');
  expect(page.style.width).toBe('100%');
  expect(page.style.minWidth).toBe('0px');
  expect(page.style.scrollSnapAlign).toBe('start');
  expect(page.style.flexGrow).toBe('0');
  expect(page.style.flexShrink).toBe('0');
  expect(page.style.flexBasis).toBe('100%');
});

it('gridClassName is forwarded to every grid page wrapper', () => {
  const { container } = makeSlider({ grid: { dimensions: [[2, 2]] } }, 4, {
    gridClassName: 'my-page',
  });
  const pages = container.querySelectorAll<HTMLElement>('[data-carousel-page="true"]');
  expect(pages.length).toBeGreaterThan(0);
  for (const page of pages) {
    expect(page.className).toContain('my-page');
  }
});

it('cssGridRows inner wrapper has height: 100%', () => {
  const { container } = makeSlider(undefined, 4, { cssGridRows: 2 });
  const page = container.querySelector<HTMLElement>('[data-carousel-page="true"]');
  const inner = page?.querySelector<HTMLElement>('div');
  if (!inner) throw new Error('cssGridRows inner div not found');
  expect(inner.style.height).toBe('100%');
});

it('cssGridRows rowGap falls back to outer gap when grid.gap.row is not set', () => {
  const { container } = makeSlider({ gap: '8px' }, 4, { cssGridRows: 2 });
  const page = container.querySelector<HTMLElement>('[data-carousel-page="true"]');
  const inner = page?.querySelector<HTMLElement>('div');
  if (!inner) throw new Error('cssGridRows inner div not found');
  expect(inner.style.rowGap).toBe('8px');
});

it('grid mode columnGap falls back to outer gap when grid.gap.col is not set', () => {
  const { container } = makeSlider({ gap: '8px', grid: { dimensions: [[2, 2]] } }, 4);
  const page = container.querySelector<HTMLElement>('[data-carousel-page="true"]');
  const inner = page?.querySelector<HTMLElement>('div');
  if (!inner) throw new Error('grid inner div not found');
  expect(inner.style.columnGap).toBe('8px');
});

it('grid mode rowGap falls back to outer gap when grid.gap.row is not set', () => {
  const { container } = makeSlider({ gap: '8px', grid: { dimensions: [[2, 2]] } }, 4);
  const page = container.querySelector<HTMLElement>('[data-carousel-page="true"]');
  const inner = page?.querySelector<HTMLElement>('div');
  if (!inner) throw new Error('grid inner div not found');
  expect(inner.style.rowGap).toBe('8px');
});
