import { describe, expect, it, vi } from 'vitest';
import { createSliderStore } from './slider-store';

describe('createSliderStore', () => {
  it('starts at the initial state', () => {
    const store = createSliderStore();
    expect(store.getSnapshot()).toEqual({
      currentIndex: 0,
      pageCount: 0,
      reachableCount: null,
      isLastChildVisible: false,
    });
  });

  it('getServerSnapshot returns a stable initial reference', () => {
    const store = createSliderStore();
    expect(store.getServerSnapshot()).toBe(store.getServerSnapshot());
    expect(store.getServerSnapshot().currentIndex).toBe(0);
  });

  it('setState merges, notifies, and returns a new snapshot reference', () => {
    const store = createSliderStore();
    const before = store.getSnapshot();
    const listener = vi.fn();
    const unsub = store.subscribe(listener);
    store.setState({ currentIndex: 2 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).not.toBe(before);
    expect(store.getSnapshot().currentIndex).toBe(2);
    expect(store.getSnapshot().pageCount).toBe(0);
    unsub();
  });

  it('treats 0 and null patches as real values (not nullish-skipped)', () => {
    const store = createSliderStore();
    store.setState({ currentIndex: 3, reachableCount: 5 });
    store.setState({ currentIndex: 0, reachableCount: null });
    expect(store.getSnapshot().currentIndex).toBe(0);
    expect(store.getSnapshot().reachableCount).toBe(null);
  });

  it('does not notify or change the reference when nothing changes', () => {
    const store = createSliderStore();
    store.setState({ pageCount: 4 });
    const snapshot = store.getSnapshot();
    const listener = vi.fn();
    store.subscribe(listener);
    store.setState({ pageCount: 4 });
    expect(listener).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toBe(snapshot);
  });

  it('unsubscribe stops notifications', () => {
    const store = createSliderStore();
    const listener = vi.fn();
    const unsub = store.subscribe(listener);
    unsub();
    store.setState({ pageCount: 9 });
    expect(listener).not.toHaveBeenCalled();
  });
});
