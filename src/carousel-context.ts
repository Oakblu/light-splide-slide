'use client';
import { createContext, useContext } from 'react';

import type { CarouselControl } from './SplideWrapper/types';

export type CarouselPadding = {
  left?: string | number;
  right?: string | number;
};

export type CarouselGrid = {
  gap?: {
    row?: string | number;
    col?: string | number;
  };
  dimensions?: [number, number][];
};

export type CarouselOptions = {
  arrows?: boolean;
  breakpoints?: Record<number, Partial<CarouselOptions>>;
  drag?: boolean;
  fixedHeight?: string | number;
  fixedWidth?: string | number;
  focus?: number;
  gap?: string | number;
  grid?: CarouselGrid;
  keyboard?: boolean;
  lazyLoad?: 'nearby' | 'sequential' | false;
  mediaQuery?: 'max' | 'min';
  omitEnd?: boolean;
  padding?: CarouselPadding | number | string;
  pagination?: boolean;
  perMove?: number;
  perPage?: number;
  preloadPages?: number;
  type?: 'slide';
  waitForTransition?: boolean;
};

export type CarouselContextValue = {
  canGoNext: boolean;
  canGoPrev: boolean;
  currentIndex: number;
  hideArrowsOnMobile: boolean;
  goTo: (control: CarouselControl) => void;
  next: () => void;
  options: CarouselOptions;
  pageCount: number;
  paginationCount: number;
  prev: () => void;
  registerScrollElement: (element: HTMLDivElement | null) => void;
  setPageCount: (count: number) => void;
  topNavigation: boolean;
};

export const CarouselContext = createContext<CarouselContextValue | null>(null);

export function useCarouselContext() {
  return useContext(CarouselContext);
}
