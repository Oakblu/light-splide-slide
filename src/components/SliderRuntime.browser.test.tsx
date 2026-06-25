import { render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useSliderContext } from '../slider-context';
import type { SliderContextValue } from '../types';
import { SliderRuntime } from './SliderRuntime';

it('provides context and reports measured page count to consumers', async () => {
  const captured: { ctx: SliderContextValue | null } = { ctx: null };
  function Probe() {
    captured.ctx = useSliderContext();
    return null;
  }
  render(
    <SliderRuntime options={{ perPage: 1 }}>
      <Probe />
      <div data-slider-scroll="" style={{ display: 'flex', width: 200, overflowX: 'auto' }}>
        <div data-carousel-page="true" style={{ flex: '0 0 200px', width: 200 }}>
          a
        </div>
        <div data-carousel-page="true" style={{ flex: '0 0 200px', width: 200 }}>
          b
        </div>
      </div>
    </SliderRuntime>
  );
  await vi.waitFor(() => {
    expect(captured.ctx?.pageCount).toBe(2);
  });
});

it('calls onMounted with the imperative api', async () => {
  const onMounted = vi.fn();
  render(
    <SliderRuntime options={{ perPage: 1 }} onMounted={onMounted}>
      <div data-slider-scroll="">
        <div data-carousel-page="true">a</div>
      </div>
    </SliderRuntime>
  );
  await vi.waitFor(() => expect(onMounted).toHaveBeenCalledTimes(1));
});

it('wrapper uses display: contents so it is layout-transparent', () => {
  const { container } = render(
    <SliderRuntime options={{}}>
      <span>x</span>
    </SliderRuntime>
  );
  const wrapper = container.querySelector<HTMLElement>('[data-slider-runtime]');
  if (!wrapper) throw new Error('runtime wrapper not found');
  expect(wrapper.style.display).toBe('contents');
});
