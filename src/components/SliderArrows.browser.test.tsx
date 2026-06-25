import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Slider } from './Slider';
import { SliderArrows } from './SliderArrows';
import { SliderSlide } from './SliderSlide';
import { SliderTrack } from './SliderTrack';

function setup(arrowsProps = {}) {
  return render(
    <Slider aria-label="d" options={{ perPage: 1 }}>
      <SliderArrows {...arrowsProps} />
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
        <SliderSlide>b</SliderSlide>
        <SliderSlide>c</SliderSlide>
      </SliderTrack>
    </Slider>
  );
}

it('renders two labelled buttons; prev disabled at start', () => {
  const { container } = setup();
  const buttons = container.querySelectorAll('button');
  expect(buttons).toHaveLength(2);
  const prev = container.querySelector<HTMLButtonElement>('[aria-label="Previous slide"]');
  expect(prev?.disabled).toBe(true);
  expect(prev?.getAttribute('data-disabled')).toBe('true');
});

it('hidden entirely when arrows option is false and no handlers', () => {
  const { container } = render(
    <Slider aria-label="d" options={{ arrows: false }}>
      <SliderArrows />
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
      </SliderTrack>
    </Slider>
  );
  expect(container.querySelectorAll('button')).toHaveLength(0);
});

it('uses custom labels and placement data attribute', () => {
  const { container } = setup({ prevLabel: 'Back', nextLabel: 'Forward', placement: 'top' });
  expect(container.querySelector('[aria-label="Back"]')).toBeTruthy();
  expect(container.querySelector('[aria-label="Forward"]')).toBeTruthy();
  expect(container.querySelector('[data-placement="top"]')).toBeTruthy();
});

it('supports custom render props', () => {
  const { container } = setup({
    renderNext: ({ disabled, onClick }: { disabled: boolean; onClick: () => void }) => (
      <button type="button" data-custom="next" disabled={disabled} onClick={onClick}>
        next
      </button>
    ),
  });
  expect(container.querySelector('[data-custom="next"]')).toBeTruthy();
});
