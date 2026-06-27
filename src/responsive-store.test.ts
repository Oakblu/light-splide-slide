import { describe, expect, it, vi } from 'vitest';
import { createResponsiveStore } from './responsive-store';

type FakeMql = {
  matches: boolean;
  addEventListener: (t: string, cb: () => void) => void;
  removeEventListener: (t: string, cb: () => void) => void;
};

function makeFakeWindow(initialWidth: number) {
  const mqls: { cb: () => void }[] = [];
  const removed: (() => void)[] = [];
  const queries: string[] = [];
  const fakeWindow = {
    innerWidth: initialWidth,
    matchMedia: (query: string): FakeMql => {
      queries.push(query);
      const entry = { cb: () => {} };
      return {
        matches: false,
        addEventListener: (_t: string, cb: () => void) => {
          entry.cb = cb;
          mqls.push(entry);
        },
        removeEventListener: (_t: string, cb: () => void) => {
          removed.push(cb);
        },
      };
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  return {
    fakeWindow,
    removed,
    queries,
    fireAll: () => {
      for (const m of mqls) m.cb();
    },
  };
}

describe('createResponsiveStore', () => {
  it('server snapshot is always null', () => {
    expect(createResponsiveStore().getServerSnapshot()).toBeNull();
  });
  it('getSnapshot returns null when window is undefined (node env)', () => {
    expect(createResponsiveStore().getSnapshot()).toBeNull();
  });
  it('subscribe returns an unsubscribe that does not throw without window', () => {
    const store = createResponsiveStore();
    const unsub = store.subscribe(() => {});
    expect(() => unsub()).not.toThrow();
  });
  it('getSnapshot reads the live window width when called before subscribe', () => {
    const { fakeWindow } = makeFakeWindow(800);
    vi.stubGlobal('window', fakeWindow);
    const store = createResponsiveStore([640]);
    expect(store.getSnapshot()).toBe(800);
    vi.unstubAllGlobals();
  });
});

describe('createResponsiveStore (matchMedia)', () => {
  it('notifies only when a breakpoint MQL changes, and caches width between changes', () => {
    const { fakeWindow, fireAll } = makeFakeWindow(800);
    vi.stubGlobal('window', fakeWindow);
    const store = createResponsiveStore([640, 1024], 'max');
    const cb = vi.fn();
    store.subscribe(cb);
    expect(store.getSnapshot()).toBe(800);
    // within-band resize without an MQL change: snapshot stays cached
    fakeWindow.innerWidth = 700;
    expect(store.getSnapshot()).toBe(800);
    expect(cb).not.toHaveBeenCalled();
    // crossing a breakpoint fires the MQL change handler
    fakeWindow.innerWidth = 500;
    fireAll();
    expect(cb).toHaveBeenCalled();
    expect(store.getSnapshot()).toBe(500);
    vi.unstubAllGlobals();
  });

  it('unsubscribe removes the change listener from every breakpoint MQL', () => {
    const { fakeWindow, removed } = makeFakeWindow(800);
    vi.stubGlobal('window', fakeWindow);
    const store = createResponsiveStore([640, 1024], 'max');
    const unsub = store.subscribe(vi.fn());
    expect(removed.length).toBe(0);
    unsub();
    expect(removed.length).toBe(2);
    vi.unstubAllGlobals();
  });

  it('builds min-width queries when mediaQuery is "min"', () => {
    const { fakeWindow, queries } = makeFakeWindow(800);
    vi.stubGlobal('window', fakeWindow);
    const store = createResponsiveStore([640], 'min');
    const unsub = store.subscribe(vi.fn());
    expect(queries).toEqual(['(min-width: 640px)']);
    unsub();
    vi.unstubAllGlobals();
  });
});
