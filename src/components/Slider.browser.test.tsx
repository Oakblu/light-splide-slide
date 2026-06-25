import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
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
