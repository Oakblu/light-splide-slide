'use client';
import { createContext, useContext } from 'react';
import type { SliderContextValue } from './types';

export const SliderContext = createContext<SliderContextValue | null>(null);

export function useSliderContext(): SliderContextValue | null {
  return useContext(SliderContext);
}
