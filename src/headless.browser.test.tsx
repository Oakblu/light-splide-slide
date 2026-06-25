import { render } from '@testing-library/react';
import { useState } from 'react';
import { expect, it } from 'vitest';
import { SliderTrack } from './components/SliderTrack';
import { SliderContext, useSliderContext } from './slider-context';
import type { SliderContextValue } from './types';
import { useSlider } from './use-slider';

it('builds a custom slider purely from useSlider', () => {
  function Custom() {
    const [pageCount, setPageCount] = useState(0);
    const ctx = useSlider({ options: { perPage: 1 }, pageCount, setPageCount });
    return (
      <SliderContext.Provider value={ctx}>
        <button type="button" aria-label="custom-next" onClick={ctx.next}>
          next
        </button>
        <div
          ref={ctx.registerScrollElement}
          style={{ display: 'flex', width: 100, overflow: 'auto' }}
        >
          <div data-carousel-page="true" style={{ flex: '0 0 100px' }}>
            one
          </div>
          <div data-carousel-page="true" style={{ flex: '0 0 100px' }}>
            two
          </div>
        </div>
      </SliderContext.Provider>
    );
  }
  const { container } = render(<Custom />);
  expect(container.querySelector('[aria-label="custom-next"]')).toBeTruthy();
});

it('SliderTrack renders null outside a Slider', () => {
  let value: SliderContextValue | null = null;
  function Probe() {
    value = useSliderContext();
    return null;
  }
  const { container } = render(
    <>
      <Probe />
      <SliderTrack>
        <div>x</div>
      </SliderTrack>
    </>
  );
  expect(value).toBeNull();
  expect(container.textContent).toBe('');
});
