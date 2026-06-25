'use client';
import { type RefObject, useEffect } from 'react';
import type { SliderApi, SliderControl } from '../types';

export function useImperativeApi(
  currentIndexRef: RefObject<number>,
  listenersRef: RefObject<Set<(i: number) => void>>,
  goTo: (control: SliderControl) => void,
  onMounted?: (api: SliderApi) => void,
  onDestroy?: () => void
): void {
  useEffect(() => {
    const listeners = listenersRef.current;
    const api: SliderApi = {
      destroy: () => listeners.clear(),
      get index() {
        return currentIndexRef.current;
      },
      go: goTo,
      on: (event, callback) => {
        // v8 ignore next 2 -- typed callers can only pass 'moved'; guard defends JS callers and is unreachable from TS
        if (event !== 'moved') {
          return () => {};
        }
        listeners.add(callback);
        return () => listeners.delete(callback);
      },
    };
    onMounted?.(api);
    return () => {
      api.destroy();
      onDestroy?.();
    };
  }, [currentIndexRef, listenersRef, goTo, onMounted, onDestroy]);
}
