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
