import { describe, expect, it, vi } from 'vitest';
import { createResponsiveStore } from './responsive-store';

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
  it('notifies on resize when window exists', () => {
    const listeners = new Set<() => void>();
    const fakeWindow = {
      innerWidth: 800,
      addEventListener: (_: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    };
    vi.stubGlobal('window', fakeWindow);
    const store = createResponsiveStore();
    expect(store.getSnapshot()).toBe(800);
    const cb = vi.fn();
    store.subscribe(cb);
    fakeWindow.innerWidth = 400;
    for (const l of listeners) {
      l();
    }
    expect(cb).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('unsubscribe removes the resize listener when window exists', () => {
    const listeners = new Set<() => void>();
    const fakeWindow = {
      innerWidth: 1024,
      addEventListener: (_: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    };
    vi.stubGlobal('window', fakeWindow);
    const store = createResponsiveStore();
    const cb = vi.fn();
    const unsub = store.subscribe(cb);
    expect(listeners.size).toBe(1);
    unsub();
    expect(listeners.size).toBe(0);
    vi.unstubAllGlobals();
  });
});
