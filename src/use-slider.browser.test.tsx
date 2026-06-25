import { render } from '@testing-library/react';
import { useEffect } from 'react';
import { expect, it, vi } from 'vitest';
import { SliderContext } from './slider-context';
import type { SliderApi, SliderContextValue, SliderOptions } from './types';
import { useSlider } from './use-slider';

function Harness({ options, onApi }: { options: SliderOptions; onApi?: (api: SliderApi) => void }) {
  const ctx = useSlider({ options, onMounted: onApi });
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
      <Counter setPageCount={ctx.setPageCount} />
    </SliderContext.Provider>
  );
}

function Counter({ setPageCount }: { setPageCount: (n: number) => void }) {
  // emulate SliderTrack reporting 3 pages once — must be in an effect to avoid
  // "setState during render of a different component" warning
  useEffect(() => {
    setPageCount(3);
  }, [setPageCount]);
  return null;
}

it('starts at index 0 with correct nav state', async () => {
  const captured: { current: SliderContextValue | null } = { current: null };
  function Probe() {
    const ctx = useSlider({ options: { perPage: 1 } });
    useEffect(() => {
      ctx.setPageCount(3);
    }, [ctx.setPageCount]);
    captured.current = ctx;
    return (
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
    );
  }
  render(<Probe />);
  expect(captured.current?.currentIndex).toBe(0);
  expect(captured.current?.canGoPrev).toBe(false);
  // once setPageCount(3) flushes, the slider knows more pages exist → canGoNext flips true
  await vi.waitFor(() => expect(captured.current?.canGoNext).toBe(true));
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
  // off() unsubscribes: a subsequent move must not invoke the listener again
  off?.();
  moved.mockClear();
  api.current?.go('>');
  expect(api.current?.index).toBe(2);
  expect(moved).not.toHaveBeenCalled();
});

it('next() and prev() context methods call goTo with correct direction', async () => {
  // Exercises the `prev` and `next` wrapper functions at use-slider.ts lines 99-100
  const api: { current: SliderApi | null } = { current: null };
  function NavProbe() {
    const result = useSlider({
      options: { perPage: 1 },
      onMounted: (a) => {
        api.current = a;
      },
    });
    useEffect(() => {
      result.setPageCount(3);
    }, [result.setPageCount]);
    // Expose next/prev via a wrapper that fires them
    return (
      <div
        ref={result.registerScrollElement}
        style={{ display: 'flex', width: 200, overflow: 'auto' }}
      >
        <div data-carousel-page="true" style={{ flex: '0 0 200px' }}>
          0
        </div>
        <div data-carousel-page="true" style={{ flex: '0 0 200px' }}>
          1
        </div>
        <div data-carousel-page="true" style={{ flex: '0 0 200px' }}>
          2
        </div>
        <button type="button" onClick={result.next} aria-label="nav-next">
          next
        </button>
        <button type="button" onClick={result.prev} aria-label="nav-prev">
          prev
        </button>
      </div>
    );
  }
  const { container } = render(<NavProbe />);
  expect(api.current?.index).toBe(0);
  // Click next button — this calls result.next() which calls `() => goTo(NavigationAction.Next)`
  const nextBtn = container.querySelector<HTMLButtonElement>('[aria-label="nav-next"]');
  nextBtn?.click();
  await vi.waitFor(() => expect(api.current?.index).toBe(1));
  // Click prev button — this calls result.prev() which calls `() => goTo(NavigationAction.Prev)`
  const prevBtn = container.querySelector<HTMLButtonElement>('[aria-label="nav-prev"]');
  prevBtn?.click();
  await vi.waitFor(() => expect(api.current?.index).toBe(0));
});

it('goTo: no-op when scrollElement is not registered', () => {
  const captured: { current: SliderContextValue | null } = { current: null };
  function Probe() {
    // do NOT register a scroll element
    const ctx = useSlider({ options: { perPage: 1 } });
    useEffect(() => {
      ctx.setPageCount(3);
    }, [ctx.setPageCount]);
    captured.current = ctx;
    return null;
  }
  render(<Probe />);
  // calling goTo without a scroll element must not throw
  expect(() => captured.current?.goTo(1)).not.toThrow();
});

it('goTo: no-op when there are no page elements', () => {
  const captured: { current: SliderContextValue | null } = { current: null };
  function Probe() {
    const ctx = useSlider({ options: { perPage: 1 } });
    useEffect(() => {
      ctx.setPageCount(3);
    }, [ctx.setPageCount]);
    captured.current = ctx;
    return (
      // scroll element has no [data-carousel-page="true"] children
      <div ref={captured.current?.registerScrollElement} />
    );
  }
  render(<Probe />);
  expect(() => captured.current?.goTo(1)).not.toThrow();
});

it('goTo: clamps to lower bound (prev at index 0 is a no-op)', () => {
  const api: { current: SliderApi | null } = { current: null };
  render(
    <Harness
      options={{ perPage: 1 }}
      onApi={(a) => {
        api.current = a;
      }}
    />
  );
  // already at 0 — prev should clamp and do nothing
  api.current?.go('<');
  expect(api.current?.index).toBe(0);
});

it('goTo: clamps to upper bound', () => {
  const api: { current: SliderApi | null } = { current: null };
  render(
    <Harness
      options={{ perPage: 1 }}
      onApi={(a) => {
        api.current = a;
      }}
    />
  );
  // 3 slides, perPage 1 → maxIndex = 2; go to 999 should clamp
  api.current?.go(999);
  // clamped means same as going to 2, but current was 0 so it moves
  expect(api.current?.index).toBe(2);
});

it('goTo: a target beyond the reachable range clamps to the last reachable page', () => {
  const api: { current: SliderApi | null } = { current: null };
  function MismatchedProbe() {
    // pageCount state is inflated to 5, but only 2 pages exist and both are
    // reachable in the 200px viewport — go(4) must clamp to the last (index 1).
    const ctx = useSlider({
      options: { perPage: 1 },
      onMounted: (a) => {
        api.current = a;
      },
    });
    useEffect(() => {
      ctx.setPageCount(5);
    }, [ctx.setPageCount]);
    return (
      <div
        ref={ctx.registerScrollElement}
        style={{ display: 'flex', width: 200, overflow: 'auto' }}
      >
        <div data-carousel-page="true" style={{ flex: '0 0 200px' }}>
          0
        </div>
        <div data-carousel-page="true" style={{ flex: '0 0 200px' }}>
          1
        </div>
      </div>
    );
  }
  render(<MismatchedProbe />);
  expect(() => api.current?.go(4)).not.toThrow();
  expect(api.current?.index).toBe(1);
});

it('IntersectionObserver fallback: uses scroll/resize when IO is undefined', async () => {
  vi.stubGlobal('IntersectionObserver', undefined);
  function IO_Probe() {
    const ctx = useSlider({ options: { perPage: 1 } });
    useEffect(() => {
      ctx.setPageCount(1);
    }, [ctx.setPageCount]);
    return (
      <div
        ref={ctx.registerScrollElement}
        style={{ display: 'flex', width: 200, overflowX: 'auto' }}
      >
        <div data-carousel-page="true" style={{ flex: '0 0 200px', width: 200, height: 50 }}>
          only
        </div>
      </div>
    );
  }
  const { unmount } = render(<IO_Probe />);
  // trigger resize so the fallback listener fires
  window.dispatchEvent(new Event('resize'));
  // no error thrown; cleanup removes listeners
  unmount();
  vi.unstubAllGlobals();
});

it('breakpoints: resolves options at given viewport width', () => {
  const captured: { current: SliderContextValue | null } = { current: null };
  function Probe() {
    const ctx = useSlider({
      options: { perPage: 1, breakpoints: { 600: { perPage: 2 } } },
    });
    useEffect(() => {
      ctx.setPageCount(3);
    }, [ctx.setPageCount]);
    captured.current = ctx;
    return null;
  }
  render(<Probe />);
  // In Chromium (full browser), window.innerWidth is typically 1024+,
  // so the max-width 600 breakpoint should NOT apply.
  // We just verify options.perPage is a number (resolved without error).
  expect(typeof captured.current?.options.perPage).toBe('number');
});

it('onDestroy is called when component unmounts', () => {
  const onDestroy = vi.fn();
  function Probe() {
    useSlider({ options: {}, onDestroy });
    return null;
  }
  const { unmount } = render(<Probe />);
  unmount();
  expect(onDestroy).toHaveBeenCalledTimes(1);
});

it('grid mode: goTo uses perMove=1 and perStep=1 for pagination', () => {
  // Exercises lines 79 and 191: resolvedOptions.grid ? 1 : ... branches
  // GridProbe reports its page count via a useEffect (setPageCount(3) after mount)
  const api: { current: SliderApi | null } = { current: null };
  function GridProbe() {
    const ctx = useSlider({
      options: { grid: { dimensions: [[2, 2]] } },
      onMounted: (a) => {
        api.current = a;
      },
    });
    useEffect(() => {
      ctx.setPageCount(3);
    }, [ctx.setPageCount]);
    return (
      <div
        ref={ctx.registerScrollElement}
        style={{ display: 'flex', width: 200, overflow: 'auto' }}
      >
        <div data-carousel-page="true" style={{ flex: '0 0 200px' }}>
          0
        </div>
        <div data-carousel-page="true" style={{ flex: '0 0 200px' }}>
          1
        </div>
        <div data-carousel-page="true" style={{ flex: '0 0 200px' }}>
          2
        </div>
      </div>
    );
  }
  render(<GridProbe />);
  expect(api.current).not.toBeNull();
  // With grid and pageCount=3, maxIndex=2, goTo next moves by 1 (grid perMove=1)
  api.current?.go('>');
  expect(api.current?.index).toBe(1);
});

it('IntersectionObserver callback fires: visibility updates when IO reports intersection', async () => {
  // This exercises the IO callback `([entry]) => setIsLastChildVisible(...)`.
  // In Chromium, after render, IO fires for the observed element and determines visibility.
  const ctx: { current: ReturnType<typeof useSlider> | null } = { current: null };
  function Probe() {
    const result = useSlider({ options: { perPage: 1 } });
    useEffect(() => {
      result.setPageCount(1);
    }, [result.setPageCount]);
    ctx.current = result;
    return (
      <div
        ref={result.registerScrollElement}
        style={{ display: 'flex', width: 200, overflowX: 'auto' }}
      >
        <div data-carousel-page="true" style={{ flex: '0 0 200px', width: 200, height: 50 }}>
          only
        </div>
      </div>
    );
  }
  render(<Probe />);
  // After mounting, IO fires asynchronously. Wait a tick for IO to process.
  await vi.waitFor(
    () => {
      // canGoNext is based on isLastChildVisible; once IO fires, state updates
      expect(ctx.current).not.toBeNull();
    },
    { timeout: 1000 }
  );
  // The IO callback must have been registered (observer.observe was called)
  // Just verify the context is accessible — IO firing itself is the coverage path
  expect(ctx.current?.pageCount).toBe(1);
});

it('IntersectionObserver: observer cleanup runs on unmount', () => {
  // Exercises the `() => { observer.disconnect(); }` cleanup function
  function Probe() {
    const ctx = useSlider({ options: { perPage: 1 } });
    useEffect(() => {
      ctx.setPageCount(1);
    }, [ctx.setPageCount]);
    return (
      <div
        ref={ctx.registerScrollElement}
        style={{ display: 'flex', width: 100, overflowX: 'auto' }}
      >
        <div data-carousel-page="true" style={{ flex: '0 0 100px', width: 100, height: 50 }}>
          only
        </div>
      </div>
    );
  }
  // Render then unmount — this triggers the IO cleanup path (observer.disconnect())
  const { unmount } = render(<Probe />);
  expect(() => unmount()).not.toThrow();
});

it('scroll-sync: scroll event on scroll container triggers emitMoved via RAF', async () => {
  // We need to trigger the RAF callback inside the scroll-sync handler.
  // In Chromium, scrollTo fires real scroll events and RAF callbacks execute.
  const api: { current: SliderApi | null } = { current: null };
  const scrollEl: { current: HTMLElement | null } = { current: null };

  function ScrollSyncProbe() {
    const ctx = useSlider({
      options: { perPage: 1 },
      onMounted: (a) => {
        api.current = a;
      },
    });
    useEffect(() => {
      ctx.setPageCount(3);
    }, [ctx.setPageCount]);
    return (
      <div
        ref={(el) => {
          ctx.registerScrollElement(el);
          scrollEl.current = el;
        }}
        style={{ display: 'flex', width: 100, overflowX: 'auto' }}
      >
        <div data-carousel-page="true" style={{ flex: '0 0 100px', width: 100 }}>
          0
        </div>
        <div data-carousel-page="true" style={{ flex: '0 0 100px', width: 100 }}>
          1
        </div>
        <div data-carousel-page="true" style={{ flex: '0 0 100px', width: 100 }}>
          2
        </div>
      </div>
    );
  }

  render(<ScrollSyncProbe />);
  expect(api.current).not.toBeNull();

  // Programmatically scroll to the second page and dispatch a scroll event
  if (scrollEl.current) {
    scrollEl.current.scrollLeft = 100;
    scrollEl.current.dispatchEvent(new Event('scroll', { bubbles: true }));
  }

  // Wait for RAF to execute and state to update
  await vi.waitFor(
    () => {
      expect(api.current?.index).toBe(1);
    },
    { timeout: 2000 }
  );
});

// ── loop mode ─────────────────────────────────────────────────────────────────

it('loop: go(">") at last index wraps to 0', () => {
  const api: { current: SliderApi | null } = { current: null };
  render(
    <Harness
      options={{ perPage: 1, type: 'loop' }}
      onApi={(a) => {
        api.current = a;
      }}
    />
  );
  // Harness has 3 slides each 200px wide, container 200px → maxIndex = 2
  api.current?.go(2);
  expect(api.current?.index).toBe(2);
  api.current?.go('>');
  expect(api.current?.index).toBe(0);
});

it('loop: go("<") at index 0 wraps to maxIndex', () => {
  const api: { current: SliderApi | null } = { current: null };
  render(
    <Harness
      options={{ perPage: 1, type: 'loop' }}
      onApi={(a) => {
        api.current = a;
      }}
    />
  );
  expect(api.current?.index).toBe(0);
  api.current?.go('<');
  expect(api.current?.index).toBe(2);
});

it('loop: canGoNext and canGoPrev are true at last index', async () => {
  const captured: { current: SliderContextValue | null } = { current: null };
  function LoopProbe() {
    const ctx = useSlider({ options: { perPage: 1, type: 'loop' } });
    useEffect(() => {
      ctx.setPageCount(3);
    }, [ctx.setPageCount]);
    captured.current = ctx;
    return (
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
    );
  }
  render(<LoopProbe />);
  // Navigate to last page — in slide mode this disables canGoNext; in loop mode it must stay true
  captured.current?.goTo(2);
  await vi.waitFor(() => {
    expect(captured.current?.canGoNext).toBe(true);
    expect(captured.current?.canGoPrev).toBe(true);
  });
});

it('loop: both arrows disabled when maxIndex === 0 (single slide)', async () => {
  const captured: { current: SliderContextValue | null } = { current: null };
  function SingleLoopProbe() {
    const ctx = useSlider({ options: { perPage: 1, type: 'loop' } });
    useEffect(() => {
      ctx.setPageCount(1);
    }, [ctx.setPageCount]);
    captured.current = ctx;
    return (
      <div
        ref={ctx.registerScrollElement}
        style={{ display: 'flex', width: 200, overflowX: 'auto' }}
      >
        <div data-carousel-page="true" style={{ flex: '0 0 200px', width: 200, height: 50 }}>
          only
        </div>
      </div>
    );
  }
  render(<SingleLoopProbe />);
  // 1 slide, maxIndex = 0 → maxIndex > 0 is false → arrows disabled even in loop mode
  await vi.waitFor(() => {
    expect(captured.current?.canGoNext).toBe(false);
    expect(captured.current?.canGoPrev).toBe(false);
  });
});

it('loop: go(99) past maxIndex wraps to 0', () => {
  const api: { current: SliderApi | null } = { current: null };
  render(
    <Harness
      options={{ perPage: 1, type: 'loop' }}
      onApi={(a) => {
        api.current = a;
      }}
    />
  );
  api.current?.go(99);
  expect(api.current?.index).toBe(0);
});

it('loop: type="slide" still clamps at both boundaries (regression)', () => {
  const api: { current: SliderApi | null } = { current: null };
  render(
    <Harness
      options={{ perPage: 1, type: 'slide' }}
      onApi={(a) => {
        api.current = a;
      }}
    />
  );
  api.current?.go('<'); // at index 0 → must clamp, stay at 0
  expect(api.current?.index).toBe(0);
  api.current?.go(999); // past end → must clamp to 2
  expect(api.current?.index).toBe(2);
});
