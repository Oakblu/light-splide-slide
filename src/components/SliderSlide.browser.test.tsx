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
