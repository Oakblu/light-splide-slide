import { fireEvent, render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
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

it('renderPrev render prop is called with disabled and onClick', () => {
  const { container } = setup({
    renderPrev: ({ disabled, onClick }: { disabled: boolean; onClick: () => void }) => (
      <button type="button" data-custom="prev" disabled={disabled} onClick={onClick}>
        prev
      </button>
    ),
  });
  expect(container.querySelector('[data-custom="prev"]')).toBeTruthy();
  // prev is disabled at start (no previous page)
  expect(container.querySelector<HTMLButtonElement>('[data-custom="prev"]')?.disabled).toBe(true);
});

it('custom onPrev handler makes prev always enabled and calls handler on click', () => {
  const onPrev = vi.fn();
  const { container } = setup({ onPrev });
  const prevBtn = container.querySelector<HTMLButtonElement>('[data-direction="prev"]');
  // when onPrev is provided, canPrev is forced true
  expect(prevBtn?.disabled).toBe(false);
  fireEvent.click(prevBtn as HTMLButtonElement);
  expect(onPrev).toHaveBeenCalledTimes(1);
});

it('custom onNext handler makes next always enabled and calls handler on click', () => {
  const onNext = vi.fn();
  const { container } = setup({ onNext });
  const nextBtn = container.querySelector<HTMLButtonElement>('[data-direction="next"]');
  // when onNext is provided, canNext is forced true
  expect(nextBtn?.disabled).toBe(false);
  fireEvent.click(nextBtn as HTMLButtonElement);
  expect(onNext).toHaveBeenCalledTimes(1);
});

it('placement="top" sets data-placement attribute', () => {
  const { container } = setup({ placement: 'top' });
  expect(container.querySelector('[data-placement="top"]')).toBeTruthy();
});

it('hideOnMobile sets data-hide-on-mobile="true"', () => {
  const { container } = setup({ hideOnMobile: true });
  expect(container.querySelector('[data-hide-on-mobile="true"]')).toBeTruthy();
});

it('arrows disabled but custom handlers present — buttons still render', () => {
  const onPrev = vi.fn();
  const onNext = vi.fn();
  const { container } = render(
    <Slider aria-label="d" options={{ arrows: false }}>
      <SliderArrows onPrev={onPrev} onNext={onNext} />
      <SliderTrack>
        <SliderSlide>a</SliderSlide>
      </SliderTrack>
    </Slider>
  );
  // arrows:false with custom handlers → still renders (handlers take priority)
  expect(container.querySelectorAll('button')).toHaveLength(2);
});

it('renders with noop handlers when rendered outside a Slider context', () => {
  // carousel is null → arrowsEnabled defaults to true, handlers fall back to noop
  const { container } = render(<SliderArrows />);
  const buttons = container.querySelectorAll('button');
  expect(buttons).toHaveLength(2);
  // clicking the prev button calls noop (no throw)
  expect(() => fireEvent.click(buttons[0])).not.toThrow();
  expect(() => fireEvent.click(buttons[1])).not.toThrow();
});
