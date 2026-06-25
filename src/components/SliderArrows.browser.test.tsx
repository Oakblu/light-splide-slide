import { render } from '@testing-library/react';
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
  prevBtn?.click();
  expect(onPrev).toHaveBeenCalledTimes(1);
});

it('custom onNext handler makes next always enabled and calls handler on click', () => {
  const onNext = vi.fn();
  const { container } = setup({ onNext });
  const nextBtn = container.querySelector<HTMLButtonElement>('[data-direction="next"]');
  // when onNext is provided, canNext is forced true
  expect(nextBtn?.disabled).toBe(false);
  nextBtn?.click();
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

it('forwards data-testid (and other rest props) to the arrows container', () => {
  const { container } = setup({ 'data-testid': 'my-arrows' });
  const el = container.querySelector('[data-testid="my-arrows"]');
  // lands on the arrows container — the element carrying the contract attribute
  expect(el?.hasAttribute('data-slider-arrows')).toBe(true);
});

it('emits no data-testid by default (opt-in)', () => {
  const { container } = setup();
  expect(container.querySelector('[data-testid]')).toBeNull();
});

it('rest props do not override the component’s own contract attributes', () => {
  const { container } = setup({ 'data-slider-arrows': 'hacked', 'data-testid': 'arrows' });
  const el = container.querySelector('[data-testid="arrows"]');
  expect(el?.getAttribute('data-slider-arrows')).toBe('');
});

it('data-slider-arrows attribute has empty string value', () => {
  const { container } = setup();
  const el = container.querySelector('[data-slider-arrows]');
  expect(el?.getAttribute('data-slider-arrows')).toBe('');
});

it('both default buttons have the correct data-direction attribute', () => {
  const { container } = setup();
  expect(container.querySelector('[data-direction="prev"]')).toBeTruthy();
  expect(container.querySelector('[data-direction="next"]')).toBeTruthy();
});

it('next button has data-disabled="false" at start when canGoNext is true', () => {
  const { container } = setup();
  const next = container.querySelector<HTMLButtonElement>('[data-direction="next"]');
  expect(next?.getAttribute('data-disabled')).toBe('false');
  expect(next?.disabled).toBe(false);
});

it('data-hide-on-mobile defaults to "false"', () => {
  const { container } = setup();
  expect(container.querySelector('[data-hide-on-mobile="false"]')).toBeTruthy();
});

it('forwards prevClassName and nextClassName to the respective buttons', () => {
  const { container } = setup({ prevClassName: 'btn-prev', nextClassName: 'btn-next' });
  expect(container.querySelector('[data-direction="prev"]')?.className).toContain('btn-prev');
  expect(container.querySelector('[data-direction="next"]')?.className).toContain('btn-next');
});

it('forwards prevStyle and nextStyle to the respective buttons', () => {
  const { container } = setup({
    prevStyle: { color: 'red' },
    nextStyle: { color: 'blue' },
  });
  const prev = container.querySelector<HTMLElement>('[data-direction="prev"]');
  const next = container.querySelector<HTMLElement>('[data-direction="next"]');
  if (!prev || !next) throw new Error('buttons not found');
  expect(prev.style.color).toBe('red');
  expect(next.style.color).toBe('blue');
});

it('forwards className and style to the arrows container', () => {
  const { container } = setup({ className: 'my-arrows', style: { gap: '8px' } });
  const el = container.querySelector<HTMLElement>('[data-slider-arrows]');
  if (!el) throw new Error('arrows container not found');
  expect(el.className).toContain('my-arrows');
  expect(el.style.gap).toBe('8px');
});

it('renders with noop handlers when rendered outside a Slider context', () => {
  // carousel is null → arrowsEnabled defaults to true, handlers fall back to noop
  const { container } = render(<SliderArrows />);
  const buttons = container.querySelectorAll<HTMLButtonElement>('button');
  expect(buttons).toHaveLength(2);
  // clicking the (disabled) buttons must not throw
  expect(() => buttons[0].click()).not.toThrow();
  expect(() => buttons[1].click()).not.toThrow();
});
