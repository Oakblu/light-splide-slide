import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Slider } from './Slider';
import { SliderPagination } from './SliderPagination';
import { SliderSlide } from './SliderSlide';
import { SliderTrack } from './SliderTrack';

it('renders one dot per page with first current', () => {
  const { container } = render(
    <Slider aria-label="d" options={{ perPage: 1, pagination: true }}>
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
        <SliderSlide>b</SliderSlide>
        <SliderSlide>c</SliderSlide>
      </SliderTrack>
      <SliderPagination />
    </Slider>
  );
  const dots = container.querySelectorAll('[data-slider-dot]');
  expect(dots).toHaveLength(3);
  expect(dots[0].getAttribute('data-current')).toBe('true');
  expect(dots[1].getAttribute('data-current')).toBe('false');
});

it('renders nothing when pagination disabled', () => {
  const { container } = render(
    <Slider aria-label="d" options={{ pagination: false }}>
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
      </SliderTrack>
      <SliderPagination />
    </Slider>
  );
  expect(container.querySelectorAll('[data-slider-dot]')).toHaveLength(0);
});

it('forwards data-testid (and other rest props) to the pagination container', () => {
  const { container } = render(
    <Slider aria-label="d" options={{ perPage: 1, pagination: true }}>
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
      </SliderTrack>
      <SliderPagination data-testid="my-pagination" />
    </Slider>
  );
  const el = container.querySelector('[data-testid="my-pagination"]');
  // lands on the pagination container — the element carrying the contract attribute
  expect(el?.hasAttribute('data-slider-pagination')).toBe(true);
});

it('emits no data-testid by default (opt-in)', () => {
  const { container } = render(
    <Slider aria-label="d" options={{ perPage: 1, pagination: true }}>
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
      </SliderTrack>
      <SliderPagination />
    </Slider>
  );
  expect(container.querySelector('[data-testid]')).toBeNull();
});

it('data-slider-pagination attribute has empty string value', () => {
  const { container } = render(
    <Slider aria-label="d" options={{ perPage: 1, pagination: true }}>
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
      </SliderTrack>
      <SliderPagination />
    </Slider>
  );
  const el = container.querySelector('[data-slider-pagination]');
  expect(el?.getAttribute('data-slider-pagination')).toBe('');
});

it('dots have aria-hidden="true"', () => {
  const { container } = render(
    <Slider aria-label="d" options={{ perPage: 1, pagination: true }}>
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
        <SliderSlide>b</SliderSlide>
      </SliderTrack>
      <SliderPagination />
    </Slider>
  );
  const dots = container.querySelectorAll('[data-slider-dot]');
  expect(dots.length).toBeGreaterThan(0);
  for (const dot of dots) {
    expect(dot.getAttribute('aria-hidden')).toBe('true');
  }
});

it('forwards dotClassName and dotStyle to each dot', () => {
  const { container } = render(
    <Slider aria-label="d" options={{ perPage: 1, pagination: true }}>
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
        <SliderSlide>b</SliderSlide>
      </SliderTrack>
      <SliderPagination dotClassName="my-dot" dotStyle={{ background: 'red' }} />
    </Slider>
  );
  const dots = container.querySelectorAll('[data-slider-dot]');
  expect(dots.length).toBeGreaterThan(0);
  for (const dot of dots) {
    expect(dot.className).toContain('my-dot');
    expect((dot as HTMLElement).style.background).toBe('red');
  }
});

it('forwards className and style to the pagination container', () => {
  const { container } = render(
    <Slider aria-label="d" options={{ perPage: 1, pagination: true }}>
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
      </SliderTrack>
      <SliderPagination className="my-pagination" style={{ color: 'blue' }} />
    </Slider>
  );
  const el = container.querySelector<HTMLElement>('[data-slider-pagination]');
  if (!el) throw new Error('pagination container not found');
  expect(el.className).toContain('my-pagination');
  expect(el.style.color).toBe('blue');
});

it('renderDot render prop is called for each dot', () => {
  const { container } = render(
    <Slider aria-label="d" options={{ perPage: 1, pagination: true }}>
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
        <SliderSlide>b</SliderSlide>
      </SliderTrack>
      <SliderPagination
        renderDot={({ index, current }: { index: number; current: boolean }) => (
          <button type="button" data-dot-index={index} data-dot-current={current}>
            {index}
          </button>
        )}
      />
    </Slider>
  );
  const dots = container.querySelectorAll('[data-dot-index]');
  expect(dots).toHaveLength(2);
  expect(dots[0].getAttribute('data-dot-current')).toBe('true');
  expect(dots[1].getAttribute('data-dot-current')).toBe('false');
});
