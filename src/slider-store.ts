export type SliderState = {
  currentIndex: number;
  pageCount: number;
  reachableCount: number | null;
  isLastChildVisible: boolean;
};

export type SliderStore = {
  subscribe: (callback: () => void) => () => void;
  getSnapshot: () => SliderState;
  getServerSnapshot: () => SliderState;
  setState: (patch: Partial<SliderState>) => void;
};

const INITIAL_STATE: SliderState = {
  currentIndex: 0,
  pageCount: 0,
  reachableCount: null,
  isLastChildVisible: false,
};

export function createSliderStore(): SliderStore {
  let state: SliderState = INITIAL_STATE;
  const listeners = new Set<() => void>();

  return {
    subscribe(callback) {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    getSnapshot() {
      return state;
    },
    getServerSnapshot() {
      return INITIAL_STATE;
    },
    setState(patch) {
      const next: SliderState = {
        currentIndex: patch.currentIndex ?? state.currentIndex,
        pageCount: patch.pageCount ?? state.pageCount,
        reachableCount:
          patch.reachableCount !== undefined ? patch.reachableCount : state.reachableCount,
        isLastChildVisible: patch.isLastChildVisible ?? state.isLastChildVisible,
      };
      if (
        next.currentIndex === state.currentIndex &&
        next.pageCount === state.pageCount &&
        next.reachableCount === state.reachableCount &&
        next.isLastChildVisible === state.isLastChildVisible
      ) {
        return;
      }
      state = next;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}
