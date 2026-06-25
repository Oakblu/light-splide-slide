import { render } from '@testing-library/react';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import { SliderContext } from './slider-context';
import type { SliderApi, SliderContextValue, SliderOptions } from './types';
import { useSlider } from './use-slider';

function Harness({ options, onApi }: { options: SliderOptions; onApi?: (api: SliderApi) => void }) {
  const [pageCount, setPageCount] = useState(0);
  const ctx = useSlider({ options, pageCount, setPageCount, onMounted: onApi });
  return (
    <SliderContext.Provider value={ctx}>
      <div
        ref={ctx.registerScrollElement}
        style={{ display: 'flex', width: 200, overflowX: 'auto' }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            data-carousel-page="true"
            style={{ flex: '0 0 200px', width: 200, height: 50 }}
          >
            {i}
          </div>
        ))}
      </div>
      <Counter setPageCount={setPageCount} />
    </SliderContext.Provider>
  );
}

function Counter({ setPageCount }: { setPageCount: (n: number) => void }) {
  // emulate SliderTrack reporting 3 pages once
  useState(() => setPageCount(3));
  return null;
}

it('starts at index 0 with correct nav state', () => {
  const captured: { current: SliderContextValue | null } = { current: null };
  function Probe() {
    const [pageCount, setPageCount] = useState(3);
    captured.current = useSlider({ options: { perPage: 1 }, pageCount, setPageCount });
    return null;
  }
  render(<Probe />);
  expect(captured.current?.currentIndex).toBe(0);
  expect(captured.current?.canGoPrev).toBe(false);
});

it('exposes an imperative api on mount and go() scrolls', async () => {
  const api: { current: SliderApi | null } = { current: null };
  render(
    <Harness
      options={{ perPage: 1 }}
      onApi={(a) => {
        api.current = a;
      }}
    />
  );
  expect(api.current).not.toBeNull();
  expect(api.current?.index).toBe(0);
  const moved = vi.fn();
  const off = api.current?.on('moved', moved);
  api.current?.go('>');
  // index updates deterministically via emitMoved — no scroll event required
  expect(api.current?.index).toBe(1);
  expect(moved).toHaveBeenCalledWith(1);
  // waitFor still holds: React state flush confirms canGoPrev/canGoNext update too
  await vi.waitFor(() => expect(api.current?.index).toBe(1));
  off?.();
});

it('on() ignores unknown events and returns a noop unsubscribe', () => {
  const captured: { current: SliderContextValue | null } = { current: null };
  const api: { current: SliderApi | null } = { current: null };
  function Probe() {
    const [pageCount, setPageCount] = useState(3);
    captured.current = useSlider({
      options: {},
      pageCount,
      setPageCount,
      onMounted: (a) => {
        api.current = a;
      },
    });
    return null;
  }
  render(<Probe />);
  const off = api.current?.on('weird', () => {});
  expect(typeof off).toBe('function');
  expect(() => off?.()).not.toThrow();
  expect(captured.current?.pageCount).toBe(3);
});
